from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
import os
import asyncio
import json
import secrets
from datetime import datetime, timedelta
from typing import Dict, Set, List, Optional
from collections import defaultdict, deque
import threading
import time
from contextlib import asynccontextmanager

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
from bson import ObjectId
import jwt
from passlib.context import CryptContext
from dotenv import load_dotenv

# Import our modules
from models.user import (
    create_user_schema, create_user, verify_otp, activate_user, 
    verify_password, get_user_by_email, get_user_by_id,
    update_profile, update_profile_image, remove_profile_image,
    save_reset_token, validate_reset_token, reset_password,
    update_user_by_admin
)
from models.history import create_history_schema, save_analysis, get_user_history, get_history_by_id, delete_history
from models.log import create_logs_schema, add_log, get_logs, clear_old_logs
from utils.email_sender import send_otp_email, send_password_reset_email, send_contact_email
from utils.twitch_chat import TwitchChatBot, extract_channel_name
from utils.password_validator import validate_password
from utils.sentiment_analyzer import sentiment_analyzer

load_dotenv()

# Environment detection
is_production = (
    os.getenv('ENVIRONMENT') == 'production' or 
    os.getenv('RAILWAY_ENVIRONMENT') == 'production' or
    os.getenv('NODE_ENV') == 'production' or
    'railway' in os.getenv('HOSTNAME', '').lower()
)
frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
print(f"Environment: {'Production' if is_production else 'Development'}")
print(f"Frontend URL: {frontend_url}")

# JWT Configuration
SECRET_KEY = os.getenv('SECRET_KEY') or secrets.token_hex(32)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Database configuration
db_name = os.getenv('MONGO_DBNAME', 'twitch_sentiment')
mongo_uri = os.getenv('MONGO_URI') or f'mongodb://localhost:27017/{db_name}'

# Global variables for WebSocket connections and bot management
active_bots: Dict[str, Dict] = {}  # channel -> {bot, thread, connected_users}
user_bots: Dict[str, Set[str]] = {}  # user_id -> set of channels
websocket_connections: Dict[str, Set[WebSocket]] = {}  # channel -> set of websockets
message_queues: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))
connection_lock = asyncio.Lock()

# MongoDB clients
mongo_client = None
mongo_db = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global mongo_client, mongo_db
    
    # Startup
    print("Starting up FastAPI application...")
    
    # Initialize MongoDB connection
    mongo_client = AsyncIOMotorClient(mongo_uri)
    mongo_db = mongo_client[db_name]
    
    # Initialize database schemas
    await init_database()
    
    print("FastAPI application started successfully!")
    
    yield
    
    # Shutdown
    print("Shutting down FastAPI application...")
    
    # Disconnect all active bots
    for channel, bot_data in active_bots.items():
        try:
            bot_data['bot'].disconnect()
        except Exception as e:
            print(f"Error disconnecting bot for channel {channel}: {e}")
    
    # Close MongoDB connection
    if mongo_client:
        mongo_client.close()
    
    print("FastAPI application shut down successfully!")

# Create FastAPI app
app = FastAPI(
    title="Twitch Sentiment Analysis API",
    description="Real-time Twitch chat sentiment analysis with WebSocket support",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configuration
if is_production:
    origins = [frontend_url]
else:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Utility functions
def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user_id
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(user_id: str = Depends(verify_token)):
    """Get current user from token"""
    user = await get_user_by_id(mongo_db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    """Get admin user"""
    if current_user.get('role') != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user

# WebSocket connection management
async def add_websocket_connection(channel: str, websocket: WebSocket):
    """Add a WebSocket connection for a channel"""
    async with connection_lock:
        if channel not in websocket_connections:
            websocket_connections[channel] = set()
        websocket_connections[channel].add(websocket)
        print(f"Added WebSocket connection for channel {channel}")

async def remove_websocket_connection(channel: str, websocket: WebSocket):
    """Remove a WebSocket connection for a channel"""
    async with connection_lock:
        if channel in websocket_connections:
            websocket_connections[channel].discard(websocket)
            if not websocket_connections[channel]:
                del websocket_connections[channel]
        print(f"Removed WebSocket connection for channel {channel}")

async def broadcast_message_to_channel(channel: str, message_data: dict):
    """Broadcast a message to all WebSocket connections for a channel"""
    async with connection_lock:
        if channel in websocket_connections:
            # Add message to queue for new connections
            message_queues[channel].append(message_data)
            
            # Send to all connected WebSockets
            disconnected_websockets = set()
            for websocket in websocket_connections[channel]:
                try:
                    await websocket.send_text(json.dumps({
                        'type': 'message',
                        'data': message_data
                    }))
                except Exception as e:
                    print(f"Error sending message to WebSocket: {e}")
                    disconnected_websockets.add(websocket)
            
            # Remove disconnected WebSockets
            for websocket in disconnected_websockets:
                websocket_connections[channel].discard(websocket)
            
            print(f"Broadcasted message to {len(websocket_connections[channel])} WebSocket connections for channel {channel}")

async def init_database():
    """Initialize database schemas"""
    try:
        # Create indexes
        await mongo_db.users.create_index('email', unique=True)
        await mongo_db.history.create_index('user_id')
        await mongo_db.history.create_index('created_at')
        await mongo_db.logs.create_index('user_id')
        await mongo_db.logs.create_index('created_at')
        print("MongoDB connection and schemas initialized successfully.")
    except Exception as e:
        print(f"Database initialization error: {e}")

# WebSocket endpoint
@app.websocket("/ws/chat/{channel}")
async def websocket_chat_endpoint(websocket: WebSocket, channel: str):
    """WebSocket endpoint for real-time chat messages"""
    await websocket.accept()
    await add_websocket_connection(channel, websocket)
    
    try:
        # Send any existing messages in the queue
        if channel in message_queues:
            for message in list(message_queues[channel]):
                await websocket.send_text(json.dumps({
                    'type': 'message',
                    'data': message
                }))
        
        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Wait for messages from client (heartbeat, etc.)
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                message = json.loads(data)
                
                if message.get('type') == 'ping':
                    await websocket.send_text(json.dumps({
                        'type': 'pong',
                        'timestamp': datetime.now().isoformat()
                    }))
                    
            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_text(json.dumps({
                    'type': 'heartbeat',
                    'timestamp': datetime.now().isoformat()
                }))
            except WebSocketDisconnect:
                break
                
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error for channel {channel}: {e}")
    finally:
        await remove_websocket_connection(channel, websocket)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test MongoDB connection
        await mongo_db.command('ping')
        return {
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'database': 'connected',
            'active_bots': len(active_bots),
            'active_websockets': sum(len(conns) for conns in websocket_connections.values())
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                'status': 'unhealthy',
                'timestamp': datetime.now().isoformat(),
                'error': str(e)
            }
        )

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Welcome to FastAPI Twitch Sentiment Analysis API", "status": "running"}

# Authentication endpoints
@app.post("/api/register")
async def register(user_data: dict):
    """Register a new user"""
    try:
        required_fields = ['email', 'password', 'first_name', 'last_name']
        
        # Check if all required fields are present
        for field in required_fields:
            if not user_data.get(field):
                raise HTTPException(status_code=400, detail=f'{field} is required')

        # Check if user already exists
        existing_user = await get_user_by_email(mongo_db, user_data['email'])
        if existing_user:
            raise HTTPException(status_code=400, detail='Email already registered')
        
        # Validate password 
        is_valid, error_message = validate_password(user_data['password'])
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_message)
            
        # Create new user and get OTP
        result, otp = await create_user(mongo_db, user_data)
        
        # Send OTP via email
        email_sent = send_otp_email(user_data['email'], otp)
        
        if not email_sent:
            await mongo_db.users.delete_one({'_id': result.inserted_id})
            raise HTTPException(status_code=500, detail='Failed to send verification email')
            
        return {
            'message': 'Registration successful. Please check your email for verification code.',
            'email': user_data['email'] 
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/login")
async def login(credentials: dict):
    """Login user and return JWT token"""
    try:
        email = credentials.get('email')
        password = credentials.get('password')

        if not email or not password:
            raise HTTPException(status_code=400, detail='Email and password are required')

        user = await get_user_by_email(mongo_db, email)
        if not user:
            raise HTTPException(status_code=401, detail='No Email Found.')

        if not verify_password(user, password):
            raise HTTPException(status_code=401, detail='Incorrect Password.')

        if user['status'] == 'not_active':
            raise HTTPException(status_code=403, detail='Account is not active. Please verify your email.')
        elif user['status'] == 'suspended':
            raise HTTPException(status_code=403, detail='Account is suspended.')

        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user['_id'])}, expires_delta=access_token_expires
        )
        
        # Log user login activity
        await add_log(mongo_db, str(user['_id']), 'Logged in')
        
        return {
            'access_token': access_token,
            'token_type': 'bearer',
            'user': {
                'id': str(user['_id']),
                'email': user['email'],
                'first_name': user['first_name'],
                'last_name': user['last_name'],
                'role': user['role'],
                'profile_image': user.get('profile_image')
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/authenticate")
async def authenticate(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    return {
        'user': {
            'id': str(current_user['_id']),
            'email': current_user['email'],
            'first_name': current_user['first_name'],
            'last_name': current_user['last_name'],
            'role': current_user['role'],
            'profile_image': current_user.get('profile_image')
        }
    }

@app.post("/api/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout user and disconnect from all channels"""
    try:
        user_id = str(current_user['_id'])

        if user_id in user_bots:
            channels = list(user_bots[user_id])
            for channel in channels:
                if channel in active_bots:
                    # Remove user from connected users
                    active_bots[channel]['connected_users'].discard(user_id)
                    
                    # If no users left, disconnect the bot
                    if not active_bots[channel]['connected_users']:
                        try:
                            bot = active_bots[channel]['bot']
                            bot.disconnect()
                        except Exception as e:
                            print(f"Error during bot disconnection on logout: {e}")
                        finally:
                            del active_bots[channel]
                            # Send disconnect notification via WebSocket
                            disconnect_data = {
                                'type': 'disconnect',
                                'channel': channel,
                                'timestamp': datetime.now().isoformat()
                            }
                            await broadcast_message_to_channel(channel, disconnect_data)
            del user_bots[user_id]
            
        return {"message": "Successfully logged out"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Twitch connection endpoints
@app.post("/api/twitch/connect")
async def connect_to_twitch(twitch_data: dict, current_user: dict = Depends(get_current_user)):
    """Connect to Twitch chat channel"""
    try:
        twitch_url = twitch_data.get('url')
        
        if not twitch_url:
            raise HTTPException(status_code=400, detail='Twitch URL is required')
            
        channel = extract_channel_name(twitch_url)
        if not channel:
            raise HTTPException(status_code=400, detail='Invalid Twitch URL')
            
        user_id = str(current_user['_id'])
        
        # Check if a bot is already active for this channel
        if channel in active_bots:
            # Add user to existing bot connection
            active_bots[channel]['connected_users'].add(user_id)
            user_bots.setdefault(user_id, set()).add(channel)
            print(f'User {user_id} joined existing bot for channel {channel}')
            return {'message': f'Connected to {channel}\'s chat', 'channel': channel}
            
        import random
        bot_username = f"justinfan{random.randint(1000, 999999)}"
        
        try:
            # Create bot with channel-specific message handler
            def channel_message_handler(message_data):
                try:
                    # Run the broadcast in the event loop
                    asyncio.create_task(broadcast_message_to_channel(channel, message_data))
                except Exception as e:
                    print(f"Error in channel_message_handler: {e}")
                
            bot = TwitchChatBot(
                token="SCHMOOPIIE",
                username=bot_username,
                channel=channel,
                message_handler=channel_message_handler
            )

            thread = threading.Thread(target=bot.start)
            thread.daemon = True
            thread.start()
            
            # Store bot with connected users set
            active_bots[channel] = {
                'bot': bot,
                'thread': thread,
                'connected_users': {user_id}
            }
            
            user_bots.setdefault(user_id, set()).add(channel)
            
            return {'message': f'Connected to {channel}\'s chat', 'channel': channel}
        except Exception as e:
            print(f"Error creating Twitch bot: {e}")
            # Clean up any partial state
            if channel in active_bots:
                del active_bots[channel]
            if user_id in user_bots and channel in user_bots[user_id]:
                user_bots[user_id].discard(channel)
            raise HTTPException(status_code=500, detail=f'Failed to connect to Twitch chat: {str(e)}')
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in connect_to_twitch: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/twitch/disconnect")
async def disconnect_from_twitch(disconnect_data: dict, current_user: dict = Depends(get_current_user)):
    """Disconnect from Twitch chat channel"""
    try:
        channel = disconnect_data.get('channel')
        
        if not channel:
            raise HTTPException(status_code=400, detail='Channel name is required')
            
        user_id = str(current_user['_id'])
        
        if channel in active_bots:
            # Remove user from connected users
            active_bots[channel]['connected_users'].discard(user_id)
            
            # Remove from user's bot list
            if user_id in user_bots:
                user_bots[user_id].discard(channel)
                if not user_bots[user_id]:  # If no channels left, remove user
                    del user_bots[user_id]
            
            # If no users left connected to this channel, disconnect the bot
            if not active_bots[channel]['connected_users']:
                try:
                    bot = active_bots[channel]['bot']
                    bot.disconnect()
                except Exception as e:
                    print(f"Error during bot disconnection: {e}")
                finally:
                    del active_bots[channel]
                    # Send disconnect notification via WebSocket
                    disconnect_data = {
                        'type': 'disconnect',
                        'channel': channel,
                        'timestamp': datetime.now().isoformat()
                    }
                    await broadcast_message_to_channel(channel, disconnect_data)
        else:
            return {'message': 'Already disconnected'}
        
        return {'message': f'Disconnected from {channel}\'s chat'}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in disconnect_from_twitch: {e}")
        return {'message': 'Attempted to disconnect from chat'}

# History endpoints
@app.post("/api/history/save")
async def save_analysis_history(history_data: dict, current_user: dict = Depends(get_current_user)):
    """Save analysis history"""
    try:
        current_user_id = str(current_user['_id'])
        
        required_fields = ['streamer_name', 'total_chats', 'sentiment_count', 
                         'top_positive', 'top_negative', 'top_neutral']
        
        for field in required_fields:
            if field not in history_data:
                raise HTTPException(status_code=400, detail=f'Missing required field: {field}')
        
        history_data['user_id'] = current_user_id
        
        if 'duration' in history_data:
            try:
                history_data['duration'] = int(history_data['duration'])
            except Exception:
                history_data['duration'] = 0
        
        # Save the analysis
        history_id = await save_analysis(mongo_db, history_data)
        
        # Log the analysis activity
        await add_log(
            mongo_db, 
            current_user_id, 
            'Saved an Analysis', 
            f"Channel: {history_data['streamer_name']}, Messages: {history_data['total_chats']}"
        )
        
        return {
            'message': 'Analysis saved successfully',
            'history_id': str(history_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history")
async def get_user_analysis_history(current_user: dict = Depends(get_current_user)):
    """Get user's analysis history"""
    try:
        current_user_id = str(current_user['_id'])
        history = await get_user_history(mongo_db, current_user_id)

        for item in history:
            item['_id'] = str(item['_id'])
            item['user_id'] = str(item['user_id'])
        
        return history
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history/{history_id}")
async def get_history_by_id_endpoint(history_id: str, current_user: dict = Depends(get_current_user)):
    """Get specific history by ID"""
    try:
        history = await get_history_by_id(mongo_db, history_id)
        
        if not history:
            raise HTTPException(status_code=404, detail='History not found')
            
        history['_id'] = str(history['_id'])
        history['user_id'] = str(history['user_id'])
        
        # Log the view activity
        await add_log(
            mongo_db, 
            str(current_user['_id']), 
            'Viewed analysis', 
            f"Channel: {history.get('streamer_name', 'Unknown')}"
        )
        
        return history
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/history/{history_id}")
async def delete_history_endpoint(history_id: str, current_user: dict = Depends(get_current_user)):
    """Delete specific history by ID"""
    try:
        success = await delete_history(mongo_db, history_id, str(current_user['_id']))
        
        if not success:
            raise HTTPException(status_code=404, detail='Failed to delete history or history not found')
            
        return {'message': 'History deleted successfully'}
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# OTP verification endpoint
@app.post("/api/verify-otp")
async def verify_otp_route(otp_data: dict):
    """Verify OTP for user activation"""
    try:
        email = otp_data.get('email')
        otp = otp_data.get('otp')
        
        if not email or not otp:
            raise HTTPException(status_code=400, detail='Email and OTP are required')
            
        user = await get_user_by_email(mongo_db, email)
        if not user:
            raise HTTPException(status_code=404, detail='User not found')
            
        if user['status'] == 'active':
            raise HTTPException(status_code=400, detail='User is already verified')
            
        # Verify OTP
        if verify_otp(user['otp'], otp):
            await activate_user(mongo_db, email)
            return {'message': 'Email verified successfully'}
        else:
            raise HTTPException(status_code=400, detail='Invalid or expired OTP')
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in verify_otp_route: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# User profile endpoints
@app.put("/api/user/profile")
async def update_user_profile(profile_data: dict, current_user: dict = Depends(get_current_user)):
    """Update user profile"""
    try:
        if not profile_data:
            raise HTTPException(status_code=400, detail='No data provided')
            
        # Update profile
        try:
            success = await update_profile(mongo_db, str(current_user['_id']), profile_data)
            if not success:
                raise HTTPException(status_code=500, detail='Failed to update profile')
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
            
        # Get updated user data
        user = await get_user_by_id(mongo_db, str(current_user['_id']))
        if not user:
            raise HTTPException(status_code=404, detail='User not found')
            
        return {
            'message': 'Profile updated successfully',
            'user': {
                'id': str(user['_id']),
                'email': user['email'],
                'first_name': user['first_name'],
                'last_name': user['last_name'],
                'role': user['role'],
                'profile_image': user.get('profile_image')
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/user/profile-image")
async def update_profile_image_endpoint(image_data: dict, current_user: dict = Depends(get_current_user)):
    """Update user profile image"""
    try:
        if not image_data or 'image' not in image_data:
            raise HTTPException(status_code=400, detail='No image data provided')
            
        # Update profile image
        success = await update_profile_image(mongo_db, str(current_user['_id']), image_data['image'])
        if not success:
            raise HTTPException(status_code=500, detail='Failed to update profile image')
            
        # Get updated user data
        user = await get_user_by_id(mongo_db, str(current_user['_id']))
        if not user:
            raise HTTPException(status_code=404, detail='User not found')
            
        return {
            'message': 'Profile image updated successfully',
            'user': {
                'id': str(user['_id']),
                'email': user['email'],
                'first_name': user['first_name'],
                'last_name': user['last_name'],
                'role': user['role'],
                'profile_image': user.get('profile_image')
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/user/profile-image")
async def remove_profile_image_endpoint(current_user: dict = Depends(get_current_user)):
    """Remove user profile image"""
    try:
        success = await remove_profile_image(mongo_db, str(current_user['_id']))
        if not success:
            raise HTTPException(status_code=500, detail='Failed to remove profile image')
            
        # Get updated user data
        user = await get_user_by_id(mongo_db, str(current_user['_id']))
        if not user:
            raise HTTPException(status_code=404, detail='User not found')
            
        return {
            'message': 'Profile image removed successfully',
            'user': {
                'id': str(user['_id']),
                'email': user['email'],
                'first_name': user['first_name'],
                'last_name': user['last_name'],
                'role': user['role'],
                'profile_image': user.get('profile_image')
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Password reset endpoints
@app.post("/api/forgot-password")
async def forgot_password(email_data: dict):
    """Send password reset email"""
    try:
        email = email_data.get('email')
        
        if not email:
            raise HTTPException(status_code=400, detail='Email is required')
            
        # Check if user exists but don't reveal this information
        user, token = await save_reset_token(mongo_db, email)
        
        if user and token:
            # Send password reset email
            email_sent = send_password_reset_email(email, str(user['_id']), token)
            
            if not email_sent:
                raise HTTPException(status_code=500, detail='Failed to send password reset email')
                
            return {'message': 'Password reset instructions sent to email'}
            
        # Still return success even if email not found for security reasons
        return {'message': 'Password reset instructions sent to email if account exists'}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Password reset error: {str(e)}")
        raise HTTPException(status_code=500, detail='An unexpected error occurred')

@app.get("/api/validate-reset-token/{user_id}/{token}")
async def validate_reset_token_route(user_id: str, token: str):
    """Validate password reset token"""
    try:
        if not user_id or not token:
            raise HTTPException(status_code=400, detail='Invalid reset link')
            
        is_valid = await validate_reset_token(mongo_db, user_id, token)
        
        if not is_valid:
            raise HTTPException(status_code=400, detail='Invalid or expired reset link')
            
        return {'message': 'Valid reset token'}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/reset-password")
async def reset_password_route(reset_data: dict):
    """Reset user password"""
    try:
        user_id = reset_data.get('userId')
        token = reset_data.get('token')
        password = reset_data.get('password')
        
        if not user_id or not token or not password:
            raise HTTPException(status_code=400, detail='User ID, token and password are required')
            
        # Validate password with enhanced policy
        is_valid, error_message = validate_password(password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_message)
            
        # Reset the password
        success = await reset_password(mongo_db, user_id, token, password)
        
        if not success:
            raise HTTPException(status_code=400, detail='Invalid or expired reset link')
            
        return {'message': 'Password has been reset successfully'}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Admin endpoints
@app.get("/api/admin/users")
async def get_all_users(admin_user: dict = Depends(get_admin_user)):
    """Get all users (admin only)"""
    try:
        users = []
        async for user in mongo_db.users.find({}):
            user['_id'] = str(user['_id'])
            # Remove sensitive information
            if 'password_hash' in user:
                del user['password_hash']
            if 'reset_token' in user:
                del user['reset_token']
            if 'token_expire' in user:
                del user['token_expire']
            if 'otp' in user:
                del user['otp']
            if 'otp_created_at' in user:
                del user['otp_created_at']
            users.append(user)
        
        return users
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/users/count")
async def get_users_count(admin_user: dict = Depends(get_admin_user)):
    """Get user count statistics (admin only)"""
    try:
        total_users = await mongo_db.users.count_documents({})
        active_users = await mongo_db.users.count_documents({'status': 'active'})
        
        return {
            'total': total_users,
            'active': active_users
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/comments/count")
async def get_comments_count(admin_user: dict = Depends(get_admin_user)):
    """Get comment count statistics (admin only)"""
    try:
        history_records = mongo_db.history.find({'status': 'active'})
        
        total_comments = 0
        async for record in history_records:
            total_comments += record.get('total_chats', 0)
        
        return {
            'total': total_comments
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/usage/count")
async def get_usage_count(admin_user: dict = Depends(get_admin_user)):
    """Get usage count statistics (admin only)"""
    try:
        total_requests = await mongo_db.history.count_documents({'status': 'active'})
        
        return {
            'total': total_requests
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/admin/users/{user_id}")
async def update_user(user_id: str, user_data: dict, admin_user: dict = Depends(get_admin_user)):
    """Update user (admin only)"""
    try:
        if not user_data:
            raise HTTPException(status_code=400, detail='No data provided')
            
        # Validate required fields
        required_fields = ['first_name', 'last_name', 'email', 'role', 'status']
        for field in required_fields:
            if field not in user_data or not user_data[field]:
                raise HTTPException(status_code=400, detail=f'{field} is required')
        
        # Get original user data for comparison and logging
        original_user = await get_user_by_id(mongo_db, user_id)
        if not original_user:
            raise HTTPException(status_code=404, detail='User not found')
                
        # Update the user
        try:
            updated_user = await update_user_by_admin(mongo_db, user_id, user_data)
            if not updated_user:
                raise HTTPException(status_code=400, detail='Failed to update user')
            
            # Prepare log details about what changed
            changes = []
            if original_user['first_name'] != updated_user['first_name'] or original_user['last_name'] != updated_user['last_name']:
                changes.append(f"Name: {original_user['first_name']} {original_user['last_name']} → {updated_user['first_name']} {updated_user['last_name']}")
            
            if original_user['email'] != updated_user['email']:
                changes.append(f"Email: {original_user['email']} → {updated_user['email']}")
                
            if original_user['role'] != updated_user['role']:
                changes.append(f"Role: {original_user['role']} → {updated_user['role']}")
                
            if original_user['status'] != updated_user['status']:
                changes.append(f"Status: {original_user['status']} → {updated_user['status']}")
            
            # Log the admin action with details about what was changed
            details = f"Updated user: {updated_user['email']}"
            if changes:
                details += f" - Changes: {'; '.join(changes)}"
                
            await add_log(
                mongo_db,
                str(admin_user['_id']),
                'Updated user profile',
                details
            )
                
            return updated_user
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/logs")
async def get_admin_logs(admin_user: dict = Depends(get_admin_user)):
    """Get admin logs with pagination"""
    try:
        # Get pagination parameters from query
        page = 1  # Default values - would need to implement query parameter parsing
        limit = 10
        search = None
        sort_field = 'created_at'
        sort_direction = 'desc'
        activity = None
        
        # Get logs with pagination
        logs_data = await get_logs(
            mongo_db, 
            page=page, 
            limit=limit, 
            search=search, 
            sort_field=sort_field, 
            sort_direction=sort_direction,
            activity=activity
        )
        
        return logs_data
        
    except Exception as e:
        print(f"Error getting logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/logs/cleanup")
async def cleanup_logs(cleanup_data: dict, admin_user: dict = Depends(get_admin_user)):
    """Cleanup old logs (admin only)"""
    try:
        # Get days to keep from request or use default (90 days)
        days_to_keep = cleanup_data.get('days_to_keep', 90)
        
        # Clear old logs
        deleted_count = await clear_old_logs(mongo_db, days_to_keep)
        
        return {
            'message': f'Successfully cleaned up logs',
            'deleted_count': deleted_count
        }
        
    except Exception as e:
        print(f"Error cleaning up logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Log analysis start endpoint
@app.post("/api/log/analysis-start")
async def log_analysis_start(log_data: dict, current_user: dict = Depends(get_current_user)):
    """Log when a user starts an analysis session"""
    try:
        streamer = log_data.get('streamer')
        
        if not streamer:
            raise HTTPException(status_code=400, detail='Streamer name is required')
        
        # Log the activity with error handling
        try:
            log_id = await add_log(
                mongo_db, 
                str(current_user['_id']), 
                'Started an analysis', 
                f"Channel: {streamer}"
            )
            
            if log_id:
                return {'message': 'Activity logged successfully'}
            else:
                raise HTTPException(status_code=500, detail='Failed to log activity')
                
        except Exception as log_error:
            print(f"Error adding log entry: {str(log_error)}")
            raise HTTPException(status_code=500, detail='Failed to log activity')
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error logging analysis start: {str(e)}")
        raise HTTPException(status_code=500, detail='Internal server error')

# Contact endpoint
@app.post("/api/contact")
async def contact(contact_data: dict):
    """Send contact message"""
    try:
        name = contact_data.get('name')
        email = contact_data.get('email')
        subject = contact_data.get('subject')
        message = contact_data.get('message')

        # Validate all fields
        if not all([name, email, subject, message]):
            raise HTTPException(status_code=400, detail='All fields are required.')

        email_sent = send_contact_email(name, email, subject, message)
        if not email_sent:
            raise HTTPException(status_code=500, detail='Failed to send message.')

        return {'message': 'Message sent successfully!'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Resend OTP endpoint
@app.post("/api/resend-otp")
async def resend_otp(otp_data: dict):
    """Resend OTP to user"""
    try:
        email = otp_data.get('email')
        if not email:
            raise HTTPException(status_code=400, detail='Email is required')

        # Get user by email
        user = await get_user_by_email(mongo_db, email)
        if not user:
            raise HTTPException(status_code=404, detail='User not found')
        if user['status'] == 'active':
            raise HTTPException(status_code=400, detail='User is already verified')

        # Generate new OTP and update user
        from models.user import generate_otp
        secret, otp = generate_otp()
        now = datetime.utcnow()
        await mongo_db.users.update_one(
            {'_id': user['_id']},
            {'$set': {'otp': secret, 'otp_created_at': now, 'updated_at': now}}
        )

        # Send OTP via email
        email_sent = send_otp_email(email, otp)
        if not email_sent:
            raise HTTPException(status_code=500, detail='Failed to send OTP email')

        return {'message': 'OTP resent successfully'}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in resend_otp: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Change password endpoint
@app.post("/api/user/change-password")
async def change_password(password_data: dict, current_user: dict = Depends(get_current_user)):
    """Change user password"""
    try:
        old_password = password_data.get('old_password')
        new_password = password_data.get('new_password')
        if not old_password or not new_password:
            raise HTTPException(status_code=400, detail='Old and new password are required')
        
        if not verify_password(current_user, old_password):
            raise HTTPException(status_code=401, detail='Incorrect old password')
        
        # Validate new password
        is_valid, error_message = validate_password(new_password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_message)
        
        # Update password hash
        password_hash = pwd_context.hash(new_password)
        result = await mongo_db.users.update_one(
            {'_id': current_user['_id']},
            {'$set': {'password_hash': password_hash, 'updated_at': datetime.utcnow()}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail='Failed to update password')
        return {'message': 'Password changed successfully'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Delete account endpoint
@app.delete("/api/user/delete-account")
async def delete_account(delete_data: dict, current_user: dict = Depends(get_current_user)):
    """Delete user account"""
    try:
        password = delete_data.get('password')
        if not password:
            raise HTTPException(status_code=400, detail='Password is required')
        
        if not verify_password(current_user, password):
            raise HTTPException(status_code=401, detail='Incorrect password')
        
        # Delete the user
        result = await mongo_db.users.delete_one({'_id': current_user['_id']})
        if result.deleted_count == 0:
            raise HTTPException(status_code=500, detail='Failed to delete account')
        return {'message': 'Account deleted successfully'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    print(f"Starting FastAPI server on port {port}")
    print(f"Environment: {'Production' if is_production else 'Development'}")
    print(f"Frontend URL: {frontend_url}")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=not is_production,
        log_level="info" if is_production else "debug"
    )
