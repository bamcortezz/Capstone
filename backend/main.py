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
    update_user_by_admin, is_valid_password_hash, fix_corrupted_password_hash
)
from models.history import create_history_schema, save_analysis, get_user_history, get_history_by_id, delete_history
from models.log import create_logs_schema, add_log, get_logs, clear_old_logs
from utils.email_sender import send_otp_email, send_password_reset_email, send_contact_email
from utils.twitch_chat import TwitchChatBot, extract_channel_name
from utils.password_validator import validate_password
from utils.sentiment_analyzer import sentiment_analyzer
from utils.gemini_analyzer import generate_analysis_summary

# PDF generation imports
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from io import BytesIO
from fastapi.responses import Response

load_dotenv()

# Environment detection
is_production = (
    os.getenv('ENVIRONMENT') == 'production' or 
    os.getenv('RAILWAY_ENVIRONMENT') == 'production' or
    os.getenv('NODE_ENV') == 'production' or
    'railway' in os.getenv('HOSTNAME', '').lower()
)
frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
# Environment configuration loaded

# JWT Configuration
SECRET_KEY = os.getenv('SECRET_KEY') or secrets.token_hex(32)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120  # Extended to 2 hours for long analyses

# JWT configuration loaded

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
main_event_loop = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global mongo_client, mongo_db, main_event_loop
    
    # Startup
    # Store the main event loop for use in other threads
    main_event_loop = asyncio.get_running_loop()
    
    # Initialize MongoDB connection
    mongo_client = AsyncIOMotorClient(mongo_uri)
    mongo_db = mongo_client[db_name]
    
    # Initialize database schemas
    await init_database()
    
    yield
    
    # Shutdown
    # Disconnect all active bots
    for channel, bot_data in active_bots.items():
        try:
            bot_data['bot'].disconnect()
        except Exception as e:
            # Error disconnecting bot (non-critical)
            pass
    
    # Close MongoDB connection
    if mongo_client:
        mongo_client.close()

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

async def remove_websocket_connection(channel: str, websocket: WebSocket):
    """Remove a WebSocket connection for a channel"""
    async with connection_lock:
        if channel in websocket_connections:
            websocket_connections[channel].discard(websocket)
            if not websocket_connections[channel]:
                del websocket_connections[channel]

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
            
            # Message broadcasted to WebSocket connections

async def init_database():
    """Initialize database schemas"""
    try:
        # Create indexes
        await mongo_db.users.create_index('email', unique=True)
        await mongo_db.history.create_index('user_id')
        await mongo_db.history.create_index('created_at')
        await mongo_db.logs.create_index('user_id')
        await mongo_db.logs.create_index('created_at')
    except Exception as e:
        # Database initialization error (critical)
        raise e

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

# Test endpoint for debugging
@app.get("/api/test/db-status")
async def test_db_status():
    """Test database connection and status"""
    try:
        # Test MongoDB connection
        await mongo_db.command('ping')
        
        # Count users
        user_count = await mongo_db.users.count_documents({})
        
        return {
            "database": "connected",
            "user_count": user_count,
            "mongo_uri": mongo_uri,
            "db_name": db_name
        }
    except Exception as e:
        return {"error": str(e), "database": "disconnected"}

@app.post("/api/test/create-user")
async def create_test_user():
    """Create a test user for debugging"""
    try:
        test_user_data = {
            'email': 'test@example.com',
            'password': 'TestPassword123!',
            'first_name': 'Test',
            'last_name': 'User'
        }
        
        # Check if user already exists
        existing_user = await get_user_by_email(mongo_db, test_user_data['email'])
        if existing_user:
            # Activate the user if it exists
            await activate_user(mongo_db, test_user_data['email'])
            return {"message": "Test user already exists and has been activated", "email": test_user_data['email']}
        
        # Create new user
        result, otp = await create_user(mongo_db, test_user_data)
        
        # Activate the user immediately for testing
        await activate_user(mongo_db, test_user_data['email'])
        
        return {
            "message": "Test user created and activated successfully",
            "email": test_user_data['email'],
            "password": test_user_data['password']
        }
        
    except Exception as e:
        print(f"Error creating test user: {e}")
        return {"error": str(e)}

# Authentication endpoints
@app.post("/api/register")
async def register(user_data: dict):
    """Register a new user"""
    try:
        required_fields = ['email', 'password', 'first_name', 'last_name']
        
        # Check if all required fields are present
        for field in required_fields:
            if not user_data.get(field) or not user_data.get(field).strip():
                field_name = field.replace('_', ' ').title()
                raise HTTPException(status_code=400, detail=f'{field_name} is required')

        # Validate email format
        import re
        email_pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        if not re.match(email_pattern, user_data['email']):
            raise HTTPException(status_code=400, detail='Please enter a valid email address')

        # Check if user already exists
        existing_user = await get_user_by_email(mongo_db, user_data['email'])
        if existing_user:
            raise HTTPException(status_code=400, detail='An account with this email address already exists')
        
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
            raise HTTPException(status_code=500, detail='Failed to send verification email. Please try again later.')
            
        return {
            'message': 'Registration successful. Please check your email for verification code.',
            'email': user_data['email'] 
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Registration error: {str(e)}")
        raise HTTPException(status_code=500, detail='An unexpected error occurred. Please try again later.')

@app.post("/api/login")
async def login(credentials: dict):
    """Login user and return JWT token"""
    try:
        print(f"Login attempt for email: {credentials.get('email')}")
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
        try:
            user_name = f"{user['first_name']} {user['last_name']}"
            await add_log(mongo_db, str(user['_id']), 'Logged in', user_name=user_name)
        except Exception as log_error:
            # Don't fail the login if logging fails
            pass
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
        print(f"Login error: {e}")
        import traceback
        traceback.print_exc()
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

@app.post("/api/refresh-token")
async def refresh_token(current_user: dict = Depends(get_current_user)):
    """Refresh JWT token"""
    try:
        # Create new access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(current_user['_id'])}, expires_delta=access_token_expires
        )
        
        return {
            'access_token': access_token,
            'token_type': 'bearer'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
            
        # Handle both authenticated and non-authenticated users
        user_id = str(current_user['_id']) if current_user else f"guest_{secrets.token_hex(8)}"
        
        # Check if a bot is already active for this channel
        if channel in active_bots:
            # Add user to existing bot connection
            active_bots[channel]['connected_users'].add(user_id)
            user_bots.setdefault(user_id, set()).add(channel)
            return {'message': f'Connected to {channel}\'s chat', 'channel': channel}
            
        import random
        bot_username = f"justinfan{random.randint(1000, 999999)}"
        
        try:
            # Create bot with channel-specific message handler
            def channel_message_handler(message_data):
                try:
                    # Schedule the coroutine to run in the main event loop
                    # This works from any thread
                    asyncio.run_coroutine_threadsafe(
                        broadcast_message_to_channel(channel, message_data), 
                        main_event_loop
                    )
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

@app.post("/api/twitch/connect-guest")
async def connect_to_twitch_guest(twitch_data: dict):
    """Connect to Twitch chat channel for guest users"""
    try:
        twitch_url = twitch_data.get('url')
        
        if not twitch_url:
            raise HTTPException(status_code=400, detail='Twitch URL is required')
            
        channel = extract_channel_name(twitch_url)
        if not channel:
            raise HTTPException(status_code=400, detail='Invalid Twitch URL')
            
        # Generate a unique guest user ID
        user_id = f"guest_{secrets.token_hex(8)}"
        
        # Check if a bot is already active for this channel
        if channel in active_bots:
            # Add user to existing bot connection
            active_bots[channel]['connected_users'].add(user_id)
            user_bots.setdefault(user_id, set()).add(channel)
            return {'message': f'Connected to {channel}\'s chat', 'channel': channel}
            
        import random
        bot_username = f"justinfan{random.randint(1000, 999999)}"
        
        try:
            # Create bot with channel-specific message handler
            def channel_message_handler(message_data):
                try:
                    # Schedule the coroutine to run in the main event loop
                    # This works from any thread
                    asyncio.run_coroutine_threadsafe(
                        broadcast_message_to_channel(channel, message_data), 
                        main_event_loop
                    )
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
        print(f"Error in connect_to_twitch_guest: {e}")
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

@app.post("/api/twitch/disconnect-guest")
async def disconnect_from_twitch_guest(disconnect_data: dict):
    """Disconnect from Twitch chat channel for guest users"""
    try:
        channel = disconnect_data.get('channel')
        
        if not channel:
            raise HTTPException(status_code=400, detail='Channel name is required')
            
        # For guest users, we'll use a simple approach - just remove from any active connections
        # Since guest users don't have persistent IDs, we'll clean up based on channel
        if channel in active_bots:
            # For guest users, we'll just remove the channel if it exists
            # In a real implementation, you might want to track guest sessions differently
            try:
                bot = active_bots[channel]['bot']
                if hasattr(bot, 'stop'):
                    bot.stop()
                thread = active_bots[channel]['thread']
                if thread.is_alive():
                    # Note: We can't forcefully stop threads, but the bot should stop naturally
                    pass
            except Exception as e:
                print(f"Error stopping bot: {e}")
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
        print(f"Error in disconnect_from_twitch_guest: {e}")
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
        
        # Generate AI summary using Gemini
        try:
            summary = generate_analysis_summary(history_data)
            history_data['summary'] = summary
        except Exception as e:
            history_data['summary'] = "Unable to generate summary at this time."
        
        # Save the analysis
        history_id = await save_analysis(mongo_db, history_data)
        
        # Log the analysis activity
        user_name = f"{current_user['first_name']} {current_user['last_name']}"
        await add_log(
            mongo_db, 
            current_user_id, 
            'Saved an Analysis', 
            f"Channel: {history_data['streamer_name']}, Messages: {history_data['total_chats']}",
            user_name=user_name
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
        user_name = f"{current_user['first_name']} {current_user['last_name']}"
        await add_log(
            mongo_db, 
            str(current_user['_id']), 
            'Viewed analysis', 
            f"Channel: {history.get('streamer_name', 'Unknown')}",
            user_name=user_name
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

@app.get("/api/history/{history_id}/pdf")
async def generate_analysis_pdf(history_id: str, current_user: dict = Depends(get_current_user)):
    """Generate PDF for analysis history"""
    try:
        # Get the analysis history
        history = await get_history_by_id(mongo_db, history_id)
        if not history:
            raise HTTPException(status_code=404, detail='History not found')

        # Create a BytesIO buffer for the PDF
        buffer = BytesIO()

        # Create the PDF document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72
        )
        
        # Define styles
        styles = getSampleStyleSheet()
        
        # Create custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            spaceAfter=30,
            alignment=1,  # Center alignment
            fontName='Helvetica-Bold'
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            spaceBefore=20,
            spaceAfter=10,
            fontName='Helvetica-Bold'
        )
        
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontSize=12,
            spaceBefore=6,
            spaceAfter=6,
            fontName='Helvetica'
        )
        
        elements = []

        # Format dates and duration
        current_date = datetime.now().strftime('%B %d, %Y %H:%M')
        analysis_date = datetime.strptime(str(history['created_at']), '%Y-%m-%d %H:%M:%S.%f').strftime('%B %d, %Y %H:%M') if isinstance(history['created_at'], str) else history['created_at'].strftime('%B %d, %Y %H:%M')
        
        # Format duration
        duration_seconds = history.get('duration', 0)
        hours = int(duration_seconds // 3600)
        minutes = int((duration_seconds % 3600) // 60)
        seconds = int(duration_seconds % 60)
        formatted_duration = f"{hours:02d}:{minutes:02d}:{seconds:02d}"

        # Add title and date
        elements.append(Paragraph("Chat Analysis Report", title_style))
        elements.append(Paragraph(f"Generated on: {current_date}", normal_style))
        elements.append(Spacer(1, 20))

        # Add analysis details in a clean format
        elements.append(Paragraph(f"Channel: {history.get('streamer_name', 'Unknown')}", normal_style))
        elements.append(Paragraph(f"Analysis Date: {analysis_date}", normal_style))
        elements.append(Paragraph(f"Duration: {formatted_duration}", normal_style))
        elements.append(Paragraph(f"Total Messages Analyzed: {history.get('total_chats', 0)}", normal_style))
        elements.append(Spacer(1, 20))

        # Add sentiment analysis summary
        elements.append(Paragraph("Sentiment Analysis Summary", heading_style))
        sentiment_data = [
            ['Category', 'Count', 'Percentage'],
            ['Positive', str(history.get('sentiment_count', {}).get('positive', 0)), 
             f"{(history.get('sentiment_count', {}).get('positive', 0) / max(history.get('total_chats', 1), 1) * 100):.1f}%"],
            ['Neutral', str(history.get('sentiment_count', {}).get('neutral', 0)), 
             f"{(history.get('sentiment_count', {}).get('neutral', 0) / max(history.get('total_chats', 1), 1) * 100):.1f}%"],
            ['Negative', str(history.get('sentiment_count', {}).get('negative', 0)), 
             f"{(history.get('sentiment_count', {}).get('negative', 0) / max(history.get('total_chats', 1), 1) * 100):.1f}%"]
        ]
        
        sentiment_table = Table(sentiment_data, colWidths=[150, 100, 100])
        sentiment_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'CENTER'),
            ('ALIGN', (2, 0), (2, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('BOX', (0, 0), (-1, -1), 2, colors.black),
            ('LINEBELOW', (0, 0), (-1, 0), 2, colors.black),
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(sentiment_table)
        elements.append(Spacer(1, 20))

        # Add analysis summary
        elements.append(Paragraph("Analysis Summary", heading_style))
        summary_text = history.get('summary', 'No summary available')
        elements.append(Paragraph(summary_text, normal_style))
        elements.append(Spacer(1, 20))

        # Add top contributors
        elements.append(Paragraph("Top Contributors Analysis", heading_style))

        # Function to create contributor table
        def create_contributor_table(title, contributors):
            elements.append(Paragraph(title, normal_style))
            data = [['Username', 'Message Count']]
            for contributor in contributors:
                data.append([contributor['username'], str(contributor['count'])])
            
            table = Table(data, colWidths=[300, 100])
            table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 12),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('ALIGN', (1, 0), (1, -1), 'CENTER'),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('BOX', (0, 0), (-1, -1), 2, colors.black),
                ('LINEBELOW', (0, 0), (-1, 0), 2, colors.black),
                ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ]))
            return table

        # Add contributor tables
        elements.append(create_contributor_table("Most Positive Contributors", history.get('top_positive', [])))
        elements.append(Spacer(1, 10))
        elements.append(create_contributor_table("Most Neutral Contributors", history.get('top_neutral', [])))
        elements.append(Spacer(1, 10))
        elements.append(create_contributor_table("Most Negative Contributors", history.get('top_negative', [])))

        # Build the PDF
        doc.build(elements)

        pdf_value = buffer.getvalue()
        buffer.close()

        # Log the PDF download
        user_name = f"{current_user['first_name']} {current_user['last_name']}"
        await add_log(
            mongo_db,
            str(current_user['_id']),
            'Downloaded analysis PDF',
            f"Channel: {history.get('streamer_name', 'Unknown')}",
            user_name=user_name
        )

        # Create the response
        return Response(
            content=pdf_value,
            media_type='application/pdf',
            headers={'Content-Disposition': f'attachment; filename=chat_analysis_{history_id}.pdf'}
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"PDF Generation Error: {str(e)}")  # Add detailed error logging
        raise HTTPException(status_code=500, detail=f'Failed to generate PDF: {str(e)}')

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
        
        # Validate required fields with detailed messages
        required_fields = ['first_name', 'last_name', 'email']
        for field in required_fields:
            if field not in profile_data or not profile_data[field] or not str(profile_data[field]).strip():
                field_name = field.replace('_', ' ').title()
                raise HTTPException(status_code=400, detail=f'{field_name} is required')
        
        # Validate email format
        import re
        email_pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        if not re.match(email_pattern, profile_data['email']):
            raise HTTPException(status_code=400, detail='Please enter a valid email address')
        
        # Validate name fields (no special characters, reasonable length)
        if len(profile_data['first_name'].strip()) < 2:
            raise HTTPException(status_code=400, detail='First name must be at least 2 characters long')
        if len(profile_data['last_name'].strip()) < 2:
            raise HTTPException(status_code=400, detail='Last name must be at least 2 characters long')
        if len(profile_data['first_name'].strip()) > 50:
            raise HTTPException(status_code=400, detail='First name must not exceed 50 characters')
        if len(profile_data['last_name'].strip()) > 50:
            raise HTTPException(status_code=400, detail='Last name must not exceed 50 characters')
            
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
        print(f"Profile update error: {str(e)}")
        raise HTTPException(status_code=500, detail='An unexpected error occurred. Please try again later.')

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
        
        # Validate email format
        import re
        email_pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        if not re.match(email_pattern, email):
            raise HTTPException(status_code=400, detail='Please enter a valid email address')
            
        # Check if user exists in database
        user = await get_user_by_email(mongo_db, email)
        if not user:
            raise HTTPException(status_code=404, detail='No account found with this email address')
        
        # Check if user account is active
        if user['status'] == 'not_active':
            raise HTTPException(status_code=400, detail='Account is not active. Please verify your email first.')
        elif user['status'] == 'suspended':
            raise HTTPException(status_code=400, detail='Account is suspended. Please contact support.')
            
        # Generate reset token
        user_with_token, token = await save_reset_token(mongo_db, email)
        
        if user_with_token and token:
            # Send password reset email
            email_sent = send_password_reset_email(email, str(user['_id']), token)
            
            if not email_sent:
                raise HTTPException(status_code=500, detail='Failed to send password reset email. Please try again later.')
                
            return {'message': 'Password reset instructions sent to your email'}
        else:
            raise HTTPException(status_code=500, detail='Failed to generate reset token. Please try again.')
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Password reset error: {str(e)}")
        raise HTTPException(status_code=500, detail='An unexpected error occurred. Please try again later.')

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
            
        # Validate required fields with detailed messages
        required_fields = ['first_name', 'last_name', 'email', 'role', 'status']
        for field in required_fields:
            if field not in user_data or not user_data[field] or not str(user_data[field]).strip():
                field_name = field.replace('_', ' ').title()
                raise HTTPException(status_code=400, detail=f'{field_name} is required')
        
        # Validate email format
        import re
        email_pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        if not re.match(email_pattern, user_data['email']):
            raise HTTPException(status_code=400, detail='Please enter a valid email address')
        
        # Validate role
        valid_roles = ['user', 'admin']
        if user_data['role'] not in valid_roles:
            raise HTTPException(status_code=400, detail=f'Role must be one of: {", ".join(valid_roles)}')
        
        # Validate status
        valid_statuses = ['active', 'not_active', 'suspended']
        if user_data['status'] not in valid_statuses:
            raise HTTPException(status_code=400, detail=f'Status must be one of: {", ".join(valid_statuses)}')
        
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
                
            admin_name = f"{admin_user['first_name']} {admin_user['last_name']}"
            await add_log(
                mongo_db,
                str(admin_user['_id']),
                'Updated user profile',
                details,
                user_name=admin_name
            )
                
            return updated_user
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Admin user update error: {str(e)}")
        raise HTTPException(status_code=500, detail='An unexpected error occurred. Please try again later.')

@app.post("/api/admin/debug/fix-password-hash")
async def fix_corrupted_password_hash_endpoint(request_data: dict, admin_user: dict = Depends(get_admin_user)):
    """Fix corrupted password hash for a user (admin debug endpoint)"""
    try:
        email = request_data.get('email')
        new_password = request_data.get('new_password')
        
        if not email or not new_password:
            raise HTTPException(status_code=400, detail='Email and new_password are required')
        
        # Check if user exists
        user = await get_user_by_email(mongo_db, email)
        if not user:
            raise HTTPException(status_code=404, detail='User not found')
        
        # Check if current password hash is valid
        current_hash = user.get('password_hash', '')
        is_valid = is_valid_password_hash(current_hash)
        
        if is_valid:
            return {
                'message': 'Password hash is already valid',
                'email': email,
                'hash_valid': True
            }
        
        # Fix the corrupted password hash
        success = await fix_corrupted_password_hash(mongo_db, email, new_password)
        
        if success:
            return {
                'message': 'Password hash fixed successfully',
                'email': email,
                'hash_valid': False,
                'fixed': True
            }
        else:
            raise HTTPException(status_code=500, detail='Failed to fix password hash')
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/logs")
async def get_admin_logs(
    page: int = 1,
    limit: int = 10,
    search: str = None,
    sortField: str = 'created_at',
    sortDirection: str = 'desc',
    activity: str = None,
    admin_user: dict = Depends(get_admin_user)
):
    """Get admin logs with pagination"""
    try:
        # Get logs with pagination
        logs_data = await get_logs(
            mongo_db, 
            page=page, 
            limit=limit, 
            search=search, 
            sort_field=sortField, 
            sort_direction=sortDirection,
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
            user_name = f"{current_user['first_name']} {current_user['last_name']}"
            log_id = await add_log(
                mongo_db, 
                str(current_user['_id']), 
                'Started an analysis', 
                f"Channel: {streamer}",
                user_name=user_name
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
    """Soft delete user account by setting status to not_active"""
    try:
        password = delete_data.get('password')
        if not password:
            raise HTTPException(status_code=400, detail='Password is required')
        
        if not verify_password(current_user, password):
            raise HTTPException(status_code=401, detail='Incorrect password')
        
        # Soft delete: Set user status to not_active instead of deleting
        result = await mongo_db.users.update_one(
            {'_id': current_user['_id']},
            {
                '$set': {
                    'status': 'not_active',
                    'updated_at': datetime.utcnow()
                }
            }
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail='Failed to deactivate account')
        
        # Log the account deactivation
        user_name = f"{current_user['first_name']} {current_user['last_name']}"
        await add_log(
            mongo_db,
            str(current_user['_id']),
            'Account deactivated',
            'User account was deactivated (soft delete)',
            user_name=user_name
        )
        
        return {'message': 'Account deactivated successfully'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=not is_production,
        log_level="info" if is_production else "debug"
    )
