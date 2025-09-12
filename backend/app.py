from flask import Flask, request, jsonify, session, make_response, Response
from flask_pymongo import PyMongo
import os
from flask_cors import CORS
from models.user import (
    create_user_schema, create_user, verify_otp, activate_user, 
    verify_password, get_user_by_email, get_user_by_id,
    update_profile, update_profile_image, remove_profile_image,
    save_reset_token, validate_reset_token, reset_password,
    update_user_by_admin
)
from models.history import create_history_schema, save_analysis, get_user_history, get_history_by_id, delete_history
from models.log import create_logs_schema, add_log, get_logs, clear_old_logs
from werkzeug.security import generate_password_hash
from utils.email_sender import send_otp_email, send_password_reset_email, send_contact_email
from utils.twitch_chat import TwitchChatBot, extract_channel_name
from utils.password_validator import validate_password
from dotenv import load_dotenv
from datetime import timedelta
import secrets
from pymongo import MongoClient
from bson import ObjectId
import bcrypt
import base64
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from io import BytesIO
import json
import threading
import time
import queue
from collections import defaultdict, deque
load_dotenv()

app = Flask(__name__)

# Environment detection - check multiple possible environment variables
is_production = (
    os.getenv('ENVIRONMENT') == 'production' or 
    os.getenv('RAILWAY_ENVIRONMENT') == 'production' or
    os.getenv('NODE_ENV') == 'production' or
    'railway' in os.getenv('HOSTNAME', '').lower()
)
frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
print(f"Environment: {'Production' if is_production else 'Development'}")
print(f"Frontend URL: {frontend_url}")
print("Port: ", os.environ.get("PORT"))

# Debug CORS configuration
print(f"CORS will allow origins: {[frontend_url] if is_production else '*'}")
# Environment-aware CORS configuration
if is_production:
    # Strict CORS for production
    CORS(app, 
         supports_credentials=True, 
         origins=[frontend_url],  # Only allow specific frontend URL
         allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         expose_headers=["Content-Type"],
         vary_header=True)
else:
    # Permissive CORS for development
    CORS(app, 
         supports_credentials=True, 
         origins="*",  # Allow all origins for local development
         allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         expose_headers=["Content-Type"],
         vary_header=True)

db_name = os.getenv('MONGO_DBNAME', 'twitch_sentiment')
mongo_uri = os.getenv('MONGO_URI') or f'mongodb://localhost:27017/{db_name}'
app.config["MONGO_URI"] = mongo_uri

# Environment-aware session security settings
secret_key = os.getenv('SECRET_KEY')
if is_production and not secret_key:
    raise ValueError("SECRET_KEY environment variable is not set.")
app.config['SECRET_KEY'] = secret_key or secrets.token_hex(32)
app.config['SESSION_COOKIE_SECURE'] = is_production
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'None' if is_production else 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)

mongo = PyMongo(app)

# Manual CORS handler for additional security
@app.after_request
def after_request(response):
    # Only add CORS headers if they're not already set by Flask-CORS
    if 'Access-Control-Allow-Origin' not in response.headers:
        if is_production:
            response.headers.add('Access-Control-Allow-Origin', frontend_url)
        else:
            response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Access-Control-Expose-Headers', 'Content-Type')
    return response

cors_origins = [frontend_url] if is_production else "*"

# Multi-user bot management
active_bots = {}  # channel -> {bot, thread, connected_users}
user_bots = {}    # user_id -> set of channels
user_sessions = {}  # session_id -> user_id mapping

# SSE infrastructure
sse_connections = {}  # channel -> set of SSE connections
message_queues = defaultdict(deque)  # channel -> deque of messages
connection_lock = threading.Lock()
sse_message_queues = {}  # channel -> {connection_id: queue.Queue()}

def add_sse_connection(channel, connection_id):
    """Add an SSE connection for a channel"""
    with connection_lock:
        if channel not in sse_connections:
            sse_connections[channel] = set()
            sse_message_queues[channel] = {}
        sse_connections[channel].add(connection_id)
        sse_message_queues[channel][connection_id] = queue.Queue(maxsize=100)  # Limit queue size
        print(f"Added SSE connection {connection_id} for channel {channel}")
        print(f"Total SSE connections for {channel}: {len(sse_connections[channel])}")
        print(f"SSE message queues for {channel}: {list(sse_message_queues[channel].keys())}")

def remove_sse_connection(channel, connection_id):
    """Remove an SSE connection for a channel"""
    with connection_lock:
        if channel in sse_connections:
            sse_connections[channel].discard(connection_id)
            if connection_id in sse_message_queues.get(channel, {}):
                del sse_message_queues[channel][connection_id]
            if not sse_connections[channel]:
                del sse_connections[channel]
                if channel in sse_message_queues:
                    del sse_message_queues[channel]
        print(f"Removed SSE connection {connection_id} for channel {channel}")

def broadcast_message_to_channel(channel, message_data):
    """Broadcast a message to all SSE connections for a channel"""
    with connection_lock:
        if channel in sse_connections and sse_connections[channel]:
            # Add message to queue for new connections
            message_queues[channel].append(message_data)
            # Keep only last 100 messages to prevent memory issues
            if len(message_queues[channel]) > 100:
                message_queues[channel].popleft()
            
            # Send message to all individual SSE connection queues
            successful_sends = 0
            failed_sends = 0
            connections_to_remove = []
            
            for connection_id in list(sse_connections[channel]):  # Create a copy to avoid modification during iteration
                try:
                    if (channel in sse_message_queues and 
                        connection_id in sse_message_queues[channel]):
                        sse_message_queues[channel][connection_id].put(message_data, timeout=1)
                        successful_sends += 1
                    else:
                        failed_sends += 1
                        connections_to_remove.append(connection_id)
                except queue.Full:
                    failed_sends += 1
                    print(f"SSE message queue full for connection {connection_id} in channel {channel}")
                    connections_to_remove.append(connection_id)
                except Exception as e:
                    failed_sends += 1
                    print(f"Error queuing message for connection {connection_id}: {e}")
                    connections_to_remove.append(connection_id)
            
            # Remove failed connections
            for connection_id in connections_to_remove:
                sse_connections[channel].discard(connection_id)
                if channel in sse_message_queues and connection_id in sse_message_queues[channel]:
                    del sse_message_queues[channel][connection_id]
            
            # Clean up empty channel entries
            if not sse_connections[channel]:
                del sse_connections[channel]
                if channel in sse_message_queues:
                    del sse_message_queues[channel]
            
            print(f"Broadcasted message to {successful_sends} SSE connections for channel {channel} (failed: {failed_sends})")
        else:
            print(f"No SSE connections found for channel {channel}, message not broadcasted")

def get_messages_for_channel(channel, last_message_id=None):
    """Get messages for a channel, optionally starting from a specific message ID"""
    with connection_lock:
        if channel not in message_queues:
            return []
        
        messages = list(message_queues[channel])
        if last_message_id is not None:
            # Find the index of the last message ID and return messages after it
            try:
                last_index = next(i for i, msg in enumerate(messages) if msg.get('id') == last_message_id)
                return messages[last_index + 1:]
            except StopIteration:
                return messages
        
        return messages

# SSE doesn't need keepalive - it has built-in reconnection

# Test endpoint for SSE
@app.route('/api/test/sse')
def test_sse():
    """Test endpoint to verify SSE is working"""
    def generate():
        for i in range(5):
            yield f"data: {json.dumps({'type': 'test', 'message': f'Test message {i+1}', 'timestamp': datetime.now().isoformat()})}\n\n"
            time.sleep(1)
        yield f"data: {json.dumps({'type': 'test', 'message': 'Test completed', 'timestamp': datetime.now().isoformat()})}\n\n"
    
    response = Response(generate(), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['Connection'] = 'keep-alive'
    response.headers['Access-Control-Allow-Origin'] = frontend_url if is_production else '*'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response

# Debug endpoint for SSE connections
@app.route('/api/debug/sse')
def debug_sse():
    """Debug endpoint to check SSE connection status"""
    with connection_lock:
        debug_info = {
            'channels': {},
            'total_connections': 0
        }
        
        for channel, connections in sse_connections.items():
            debug_info['channels'][channel] = {
                'connection_count': len(connections),
                'connection_ids': list(connections),
                'has_message_queues': channel in sse_message_queues,
                'queue_count': len(sse_message_queues.get(channel, {})),
                'message_history_count': len(message_queues.get(channel, []))
            }
            debug_info['total_connections'] += len(connections)
    
    return jsonify(debug_info)

# Global error handlers
@app.errorhandler(500)
def internal_error(error):
    print(f"Internal server error: {error}")
    return jsonify({'error': 'Internal server error'}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(400)
def bad_request(error):
    return jsonify({'error': 'Bad request'}), 400

# Handle preflight OPTIONS requests
@app.route('/<path:path>', methods=['OPTIONS'])
def handle_preflight(path):
    response = make_response()
    if is_production:
        response.headers['Access-Control-Allow-Origin'] = frontend_url
    else:
        response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    try:
        # Test MongoDB connection
        mongo.db.command('ping')
        return jsonify({
            'status': 'healthy', 
            'timestamp': datetime.now().isoformat(),
            'database': 'connected',
            'active_bots': len(active_bots),
            'active_sessions': len(user_sessions)
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'unhealthy', 
            'timestamp': datetime.now().isoformat(),
            'error': str(e)
        }), 500

# Debug endpoint for checking bot and session status
@app.route('/debug/status', methods=['GET'])
def debug_status():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
            
        current_user = get_user_by_id(mongo, session['user_id'])
        if not current_user or current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin privileges required'}), 403
        
        return jsonify({
            'active_bots': {
                channel: {
                    'connected_users': list(bot_data['connected_users']),
                    'bot_active': bot_data['bot']._should_disconnect == False if hasattr(bot_data['bot'], '_should_disconnect') else 'unknown'
                } for channel, bot_data in active_bots.items()
            },
            'user_sessions': user_sessions,
            'user_bots': {user_id: list(channels) for user_id, channels in user_bots.items()},
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# SSE endpoint for chat messages
@app.route('/api/sse/chat/<channel>')
def sse_chat_stream(channel):
    """Server-Sent Events endpoint for real-time chat messages"""
    def generate():
        connection_id = f"{channel}_{datetime.now().timestamp()}_{secrets.token_hex(4)}"
        add_sse_connection(channel, connection_id)
        
        try:
            # Send initial connection message
            yield f"data: {json.dumps({'type': 'connection', 'status': 'connected', 'channel': channel, 'timestamp': datetime.now().isoformat()})}\n\n"
            
            # Send any existing messages in the queue
            existing_messages = get_messages_for_channel(channel)
            for message in existing_messages:
                yield f"data: {json.dumps({'type': 'message', 'data': message})}\n\n"
            
            # Real-time message delivery using individual connection queue
            last_heartbeat = time.time()
            while True:
                try:
                    # Get queue reference with proper locking
                    queue_ref = None
                    with connection_lock:
                        if (channel in sse_message_queues and 
                            connection_id in sse_message_queues[channel] and
                            channel in sse_connections and 
                            connection_id in sse_connections[channel]):
                            queue_ref = sse_message_queues[channel][connection_id]
                    
                    if queue_ref:
                        try:
                            message_data = queue_ref.get(timeout=1.0)
                            yield f"data: {json.dumps({'type': 'message', 'data': message_data})}\n\n"
                        except queue.Empty:
                            # No new messages, send heartbeat if needed
                            current_time = time.time()
                            if current_time - last_heartbeat >= 30:  # Send heartbeat every 30 seconds
                                yield f"data: {json.dumps({'type': 'heartbeat', 'timestamp': datetime.now().isoformat()})}\n\n"
                                last_heartbeat = current_time
                            continue
                    else:
                        # Connection queue not found or connection removed, check if we should continue
                        with connection_lock:
                            if (channel not in sse_connections or 
                                connection_id not in sse_connections[channel]):
                                print(f"SSE connection {connection_id} for channel {channel} no longer exists, exiting")
                                break
                        # Wait a bit before retrying
                        time.sleep(0.1)
                        continue
                
        except GeneratorExit:
            # Client disconnected
            remove_sse_connection(channel, connection_id)
            print(f"SSE connection {connection_id} for channel {channel} closed")
        except Exception as e:
            print(f"Error in SSE stream for channel {channel}: {e}")
            remove_sse_connection(channel, connection_id)
    
    response = Response(generate(), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['Connection'] = 'keep-alive'
    response.headers['Access-Control-Allow-Origin'] = frontend_url if is_production else '*'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response

# SSE endpoint for connection status
@app.route('/api/sse/status')
def sse_status_stream():
    """Server-Sent Events endpoint for connection status updates"""
    def generate():
        connection_id = f"status_{datetime.now().timestamp()}_{secrets.token_hex(4)}"
        
        try:
            # Send initial status
            yield f"data: {json.dumps({'type': 'status', 'status': 'connected', 'timestamp': datetime.now().isoformat()})}\n\n"
            
            # Send periodic status updates
            while True:
                yield f"data: {json.dumps({'type': 'status', 'status': 'alive', 'timestamp': datetime.now().isoformat()})}\n\n"
                time.sleep(60)  # Send status every minute
                
        except GeneratorExit:
            print(f"SSE status connection {connection_id} closed")
        except Exception as e:
            print(f"Error in SSE status stream: {e}")
    
    response = Response(generate(), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['Connection'] = 'keep-alive'
    response.headers['Access-Control-Allow-Origin'] = frontend_url if is_production else '*'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response

def broadcast_message(message_data, channel=None):
    """Broadcast message using SSE instead of SocketIO"""
    try:
        if channel:
            # Add unique ID to message for tracking
            message_data['id'] = f"{channel}_{datetime.now().timestamp()}_{secrets.token_hex(4)}"
            message_data['timestamp'] = datetime.now().isoformat()
            
            # Broadcast to SSE connections for this channel
            broadcast_message_to_channel(channel, message_data)
            print(f"Broadcasted message to SSE connections for channel {channel}")
        else:
            print("No channel specified for message broadcast")
    except Exception as e:
        print(f"Error in broadcast_message: {e}")

# Example of checking MongoDB URI configuration
print("MongoDB URI:", mongo_uri)  # Check the MongoDB URI

# Initialize database schemas
def init_database():
    with app.app_context():
        create_user_schema(mongo)
        create_history_schema(mongo)
        create_logs_schema(mongo)
        print("MongoDB connection successful.")

# Call the initialization function
init_database()

# Check environment type
print(f"Running in {'Production' if is_production else 'Development'} environment.")


@app.route('/')
def index():
    return jsonify({"message": "Welcome to Flask MongoDB API", "status": "running"})

@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        required_fields = ['email', 'password', 'first_name', 'last_name']
        
        # Check if all required fields
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400

        # Check if user already exists
        if mongo.db.users.find_one({'email': data['email']}):
            return jsonify({'error': 'Email already registered'}), 400
        
        # Validate password 
        is_valid, error_message = validate_password(data['password'])
        if not is_valid:
            return jsonify({'error': error_message}), 400
            
        user_data = {
            'first_name': data['first_name'],
            'last_name': data['last_name'],
            'email': data['email'],
            'password': data['password'],
            'role': 'user',
            'status': 'not_active'
        }
        
        # Create new user and get OTP
        result, otp = create_user(mongo, user_data)
        
        # Send OTP via email
        email_sent = send_otp_email(data['email'], otp)
        
        if not email_sent:
            mongo.db.users.delete_one({'_id': result.inserted_id})
            return jsonify({'error': 'Failed to send verification email'}), 500
            
        return jsonify({
            'message': 'Registration successful. Please check your email for verification code.',
            'email': data['email'] 
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400

        user = get_user_by_email(mongo, email)
        if not user:
            return jsonify({'error': 'No Email Found.'}), 401

        if not verify_password(user, password):
            return jsonify({'error': 'Incorrect Password.'}), 401

        if user['status'] == 'not_active':
            return jsonify({'error': 'Account is not active. Please verify your email.'}), 403
        elif user['status'] == 'suspended':
            return jsonify({'error': 'Account is suspended.'}), 403

        # Set session data
        session.permanent = True  # Use permanent session
        session['user_id'] = str(user['_id'])
        session['email'] = user['email']
        session['first_name'] = user['first_name']
        session['last_name'] = user['last_name']
        session['role'] = user['role']
        
        # Log user login activity
        add_log(mongo, str(user['_id']), 'Logged in')
        
        return jsonify({
            'user': {
                'id': str(user['_id']),
                'email': user['email'],
                'first_name': user['first_name'],
                'last_name': user['last_name'],
                'role': user['role'],
                'profile_image': user.get('profile_image')
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/authenticate', methods=['GET'])
def authenticate():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
            
        user = get_user_by_id(mongo, session['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        return jsonify({
            'user': {
                'id': str(user['_id']),
                'email': user['email'],
                'first_name': user['first_name'],
                'last_name': user['last_name'],
                'role': user['role'],
                'profile_image': user.get('profile_image')
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/logout', methods=['POST'])
def logout():
    try:
        user_id = session.get('user_id')

        if user_id and user_id in user_bots:
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
                            # Don't call bot.die() as it calls sys.exit() which kills the worker
                        except Exception as e:
                            print(f"Error during bot disconnection on logout: {e}")
                        finally:
                            del active_bots[channel]
                            # Send disconnect notification via SSE
                            disconnect_data = {
                                'type': 'disconnect',
                                'channel': channel,
                                'timestamp': datetime.now().isoformat()
                            }
                            broadcast_message_to_channel(channel, disconnect_data)
            del user_bots[user_id]
            
        # Clean up session mapping (handled in Socket.IO disconnect)
        # if request.sid in user_sessions:
        #     del user_sessions[request.sid]
            
        session.clear()
        return jsonify({"message": "Successfully logged out"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/twitch/connect', methods=['POST'])
def connect_to_twitch():
    try:
        data = request.get_json()
        twitch_url = data.get('url')
        
        if not twitch_url:
            return jsonify({'error': 'Twitch URL is required'}), 400
            
        channel = extract_channel_name(twitch_url)
        if not channel:
            return jsonify({'error': 'Invalid Twitch URL'}), 400
            
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Authentication required'}), 401
            
        # Map session to user for Socket.IO (will be set when Socket.IO connects)
        # user_sessions[request.sid] = user_id  # This will be handled in Socket.IO connect
        
        # Check if a bot is already active for this channel
        if channel in active_bots:
            # Add user to existing bot connection
            active_bots[channel]['connected_users'].add(user_id)
            user_bots.setdefault(user_id, set()).add(channel)
            print(f'User {user_id} joined existing bot for channel {channel}')
            return jsonify({'message': f'Connected to {channel}\'s chat', 'channel': channel}), 200
            
        import random
        bot_username = f"justinfan{random.randint(1000, 999999)}"
        
        try:
            # Create bot with channel-specific message handler
            def channel_message_handler(message_data, channel_name):
                try:
                    broadcast_message(message_data, channel_name)
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
            
            return jsonify({'message': f'Connected to {channel}\'s chat', 'channel': channel}), 200
        except Exception as e:
            print(f"Error creating Twitch bot: {e}")
            # Clean up any partial state
            if channel in active_bots:
                del active_bots[channel]
            if user_id in user_bots and channel in user_bots[user_id]:
                user_bots[user_id].discard(channel)
            return jsonify({'error': f'Failed to connect to Twitch chat: {str(e)}'}), 500
        
    except Exception as e:
        print(f"Error in connect_to_twitch: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/twitch/disconnect', methods=['POST'])
def disconnect_from_twitch():
    try:
        data = request.get_json()
        channel = data.get('channel')
        
        if not channel:
            return jsonify({'error': 'Channel name is required'}), 400
            
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Authentication required'}), 401
        
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
                    # Don't call bot.die() as it calls sys.exit() which kills the worker
                except Exception as e:
                    print(f"Error during bot disconnection: {e}")
                finally:
                    del active_bots[channel]
                    # Send disconnect notification via SSE
                    disconnect_data = {
                        'type': 'disconnect',
                        'channel': channel,
                        'timestamp': datetime.now().isoformat()
                    }
                    broadcast_message_to_channel(channel, disconnect_data)
        else:
            return jsonify({'message': 'Already disconnected'}), 200
        
        return jsonify({'message': f'Disconnected from {channel}\'s chat'}), 200
    
    except Exception as e:
        print(f"Error in disconnect_from_twitch: {e}")
        return jsonify({'message': 'Attempted to disconnect from chat'}), 200

@app.route('/api/history/save', methods=['POST'])
def save_analysis_history():
    try:
        current_user_id = session['user_id']
        data = request.get_json()
        
        required_fields = ['streamer_name', 'total_chats', 'sentiment_count', 
                         'top_positive', 'top_negative', 'top_neutral']
        
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        data['user_id'] = current_user_id
        
        if 'duration' in data:
            try:
                data['duration'] = int(data['duration'])
            except Exception:
                data['duration'] = 0
        
        # Save the analysis
        history_id = save_analysis(mongo, data)
        
        # Log the analysis activity
        add_log(
            mongo, 
            current_user_id, 
            'Saved an Analysis', 
            f"Channel: {data['streamer_name']}, Messages: {data['total_chats']}"
        )
        
        return jsonify({
            'message': 'Analysis saved successfully',
            'history_id': str(history_id)
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/history', methods=['GET'])
def get_user_analysis_history():
    try:
        current_user_id = session['user_id']
        history = get_user_history(mongo, current_user_id)

        for item in history:
            item['_id'] = str(item['_id'])
            item['user_id'] = str(item['user_id'])
        
        return jsonify(history), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/history/<history_id>', methods=['GET', 'DELETE'])
def handle_history_by_id(history_id):
    try:
        if request.method == 'GET':
            history = get_history_by_id(mongo, history_id)
            
            if not history:
                return jsonify({'error': 'History not found'}), 404
                
            history['_id'] = str(history['_id'])
            history['user_id'] = str(history['user_id'])
            
            if 'user_id' in session:
                add_log(
                    mongo, 
                    session['user_id'], 
                    'Viewed analysis', 
                    f"Channel: {history.get('streamer_name', 'Unknown')}"
                )
            
            return jsonify(history), 200
        
        elif request.method == 'DELETE':
            if 'user_id' not in session:
                return jsonify({'error': 'Unauthorized'}), 401
            
            success = delete_history(mongo, history_id, session['user_id'])
            
            if not success:
                return jsonify({'error': 'Failed to delete history or history not found'}), 404
                
            return jsonify({'message': 'History deleted successfully'}), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/verify-otp', methods=['POST'])
def verify_otp_route():
    try:
        data = request.get_json()
        email = data.get('email')
        otp = data.get('otp')
        
        if not email or not otp:
            return jsonify({'error': 'Email and OTP are required'}), 400
            
        user = get_user_by_email(mongo, email)
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        if user['status'] == 'active':
            return jsonify({'error': 'User is already verified'}), 400
            
        # Verify OTP
        if verify_otp(user['otp'], otp):

            activate_user(mongo, email)
            return jsonify({'message': 'Email verified successfully'}), 200
        else:
            return jsonify({'error': 'Invalid or expired OTP'}), 400
            
    except Exception as e:
        print(f"Error in verify_otp_route: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/profile', methods=['PUT'])
def update_user_profile():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
            
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        # Update profile
        try:
            success = update_profile(mongo, session['user_id'], data)
            if not success:
                return jsonify({'error': 'Failed to update profile'}), 500
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
            
        # Get updated user data
        user = get_user_by_id(mongo, session['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        # Update session data
        session['first_name'] = user['first_name']
        session['last_name'] = user['last_name']
        session['email'] = user['email']
        
        return jsonify({
            'message': 'Profile updated successfully',
            'user': {
                'id': str(user['_id']),
                'email': user['email'],
                'first_name': user['first_name'],
                'last_name': user['last_name'],
                'role': user['role'],
                'profile_image': user.get('profile_image')
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/profile-image', methods=['PUT', 'DELETE'])
def handle_profile_image():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
            
        if request.method == 'DELETE':
            
            success = remove_profile_image(mongo, session['user_id'])
            if not success:
                return jsonify({'error': 'Failed to remove profile image'}), 500
                
            # Get updated user data
            user = get_user_by_id(mongo, session['user_id'])
            if not user:
                return jsonify({'error': 'User not found'}), 404
                
            return jsonify({
                'message': 'Profile image removed successfully',
                'user': {
                    'id': str(user['_id']),
                    'email': user['email'],
                    'first_name': user['first_name'],
                    'last_name': user['last_name'],
                    'role': user['role'],
                    'profile_image': user.get('profile_image')
                }
            }), 200
        
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400
            
        # Update profile image
        success = update_profile_image(mongo, session['user_id'], data['image'])
        if not success:
            return jsonify({'error': 'Failed to update profile image'}), 500
            
        # Get updated user data
        user = get_user_by_id(mongo, session['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        return jsonify({
            'message': 'Profile image updated successfully',
            'user': {
                'id': str(user['_id']),
                'email': user['email'],
                'first_name': user['first_name'],
                'last_name': user['last_name'],
                'role': user['role'],
                'profile_image': user.get('profile_image')
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
            
        # Check if user exists but don't reveal this information
        user, token = save_reset_token(mongo, email)
        
        if user and token:
            # Send password reset email
            email_sent = send_password_reset_email(email, str(user['_id']), token)
            
            if not email_sent:
                return jsonify({'error': 'Failed to send password reset email'}), 500
                
            return jsonify({'message': 'Password reset instructions sent to email'}), 200
            
        # Still return success even if email not found for security reasons
        return jsonify({'message': 'Password reset instructions sent to email if account exists'}), 200
        
    except Exception as e:
        print(f"Password reset error: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred'}), 500

@app.route('/api/validate-reset-token/<userId>/<token>', methods=['GET'])
def validate_reset_token_route(userId, token):
    try:
        if not userId or not token:
            return jsonify({'error': 'Invalid reset link'}), 400
            
        is_valid = validate_reset_token(mongo, userId, token)
        
        if not is_valid:
            return jsonify({'error': 'Invalid or expired reset link'}), 400
            
        return jsonify({'message': 'Valid reset token'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/reset-password', methods=['POST'])
def reset_password_route():
    try:
        data = request.get_json()
        userId = data.get('userId')
        token = data.get('token')
        password = data.get('password')
        
        if not userId or not token or not password:
            return jsonify({'error': 'User ID, token and password are required'}), 400
            
        # Validate password with enhanced policy
        is_valid, error_message = validate_password(password)
        if not is_valid:
            return jsonify({'error': error_message}), 400
            
        # Reset the password
        success = reset_password(mongo, userId, token, password)
        
        if not success:
            return jsonify({'error': 'Invalid or expired reset link'}), 400
            
        return jsonify({'message': 'Password has been reset successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users', methods=['GET'])
def get_all_users():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
            
        current_user = get_user_by_id(mongo, session['user_id'])
        if not current_user or current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin privileges required'}), 403
        
        users = list(mongo.db.users.find({}))
        
        for user in users:
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
        
        return jsonify(users), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/count', methods=['GET'])
def get_users_count():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
            
        current_user = get_user_by_id(mongo, session['user_id'])
        if not current_user or current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin privileges required'}), 403
        
        total_users = mongo.db.users.count_documents({})
        active_users = mongo.db.users.count_documents({'status': 'active'})
        
        return jsonify({
            'total': total_users,
            'active': active_users
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/comments/count', methods=['GET'])
def get_comments_count():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
            
        current_user = get_user_by_id(mongo, session['user_id'])
        if not current_user or current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin privileges required'}), 403
        
        history_records = mongo.db.history.find({'status': 'active'})
        
        total_comments = sum(record.get('total_chats', 0) for record in history_records)
        
        return jsonify({
            'total': total_comments
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/usage/count', methods=['GET'])
def get_usage_count():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
            
        current_user = get_user_by_id(mongo, session['user_id'])
        if not current_user or current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin privileges required'}), 403
        
        total_requests = mongo.db.history.count_documents({'status': 'active'})
        
        return jsonify({
            'total': total_requests
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<user_id>', methods=['PUT'])
def update_user(user_id):
    try:
        # Check if user is authenticated
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
            
        # Check if user is an admin
        current_user = get_user_by_id(mongo, session['user_id'])
        if not current_user or current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin privileges required'}), 403
        
        # Get request data
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        # Validate required fields
        required_fields = ['first_name', 'last_name', 'email', 'role', 'status']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Get original user data for comparison and logging
        original_user = get_user_by_id(mongo, user_id)
        if not original_user:
            return jsonify({'error': 'User not found'}), 404
                
        # Update the user
        try:
            updated_user = update_user_by_admin(mongo, user_id, data)
            if not updated_user:
                return jsonify({'error': 'Failed to update user'}), 400
            
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
                
            add_log(
                mongo,
                session['user_id'],
                'Updated user profile',
                details
            )
                
            return jsonify(updated_user), 200
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Add new route for admin to get logs
@app.route('/api/admin/logs', methods=['GET'])
def get_admin_logs():
    try:
        # Check if user is admin
        if 'role' not in session or session['role'] != 'admin':
            return jsonify({'error': 'Admin privileges required'}), 403
            
        # Get pagination parameters
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        search = request.args.get('search')
        sort_field = request.args.get('sortField', 'created_at')
        sort_direction = request.args.get('sortDirection', 'desc')
        activity = request.args.get('activity')
        
        # Get logs with pagination
        logs_data = get_logs(
            mongo, 
            page=page, 
            limit=limit, 
            search=search, 
            sort_field=sort_field, 
            sort_direction=sort_direction,
            activity=activity
        )
        
        return jsonify(logs_data), 200
        
    except Exception as e:
        print(f"Error getting logs: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Maintenance route to clear old logs (can be called manually or set up as a scheduled task)
@app.route('/api/admin/logs/cleanup', methods=['POST'])
def cleanup_logs():
    try:
        # Check if user is admin
        if 'role' not in session or session['role'] != 'admin':
            return jsonify({'error': 'Admin privileges required'}), 403
            
        # Get days to keep from request or use default (90 days)
        data = request.get_json()
        days_to_keep = data.get('days_to_keep', 90)
        
        # Clear old logs
        deleted_count = clear_old_logs(mongo, days_to_keep)
        
        return jsonify({
            'message': f'Successfully cleaned up logs',
            'deleted_count': deleted_count
        }), 200
        
    except Exception as e:
        print(f"Error cleaning up logs: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Add new route to log when a user starts an analysis session
@app.route('/api/log/analysis-start', methods=['POST'])
def log_analysis_start():
    try:
        # Check if user is authenticated
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        streamer = data.get('streamer')
        
        if not streamer:
            return jsonify({'error': 'Streamer name is required'}), 400
        
        # Log the activity with error handling
        try:
            log_id = add_log(
                mongo, 
                session['user_id'], 
                'Started an analysis', 
                f"Channel: {streamer}"
            )
            
            if log_id:
                return jsonify({'message': 'Activity logged successfully'}), 200
            else:
                return jsonify({'error': 'Failed to log activity'}), 500
                
        except Exception as log_error:
            print(f"Error adding log entry: {str(log_error)}")
            return jsonify({'error': 'Failed to log activity'}), 500
        
    except Exception as e:
        print(f"Error logging analysis start: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/history/<history_id>/pdf', methods=['GET'])
def generate_analysis_pdf(history_id):
    try:
        # Ensure user is authenticated
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401

        # Get the analysis history
        history = get_history_by_id(mongo, history_id)
        if not history:
            return jsonify({'error': 'History not found'}), 404

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

        # Format dates
        current_date = datetime.now().strftime('%B %d, %Y %H:%M')
        analysis_date = datetime.strptime(str(history['created_at']), '%Y-%m-%d %H:%M:%S.%f').strftime('%B %d, %Y %H:%M') if isinstance(history['created_at'], str) else history['created_at'].strftime('%B %d, %Y %H:%M')

        # Add title and date
        elements.append(Paragraph("Chat Analysis Report", title_style))
        elements.append(Paragraph(f"Generated on: {current_date}", normal_style))
        elements.append(Spacer(1, 20))

        # Add streamer info
        elements.append(Paragraph(f"Channel: {history['streamer_name']}", heading_style))
        elements.append(Paragraph(f"Analysis Date: {analysis_date}", normal_style))
        # Add duration (format as HH:MM:SS)
        def format_duration(seconds):
            h = int(seconds) // 3600
            m = (int(seconds) % 3600) // 60
            s = int(seconds) % 60
            return f"{h:02d}:{m:02d}:{s:02d}"
        duration_val = history.get('duration', 0)
        elements.append(Paragraph(f"Duration: {format_duration(duration_val)}", normal_style))
        elements.append(Paragraph(f"Total Messages Analyzed: {history['total_chats']}", normal_style))
        elements.append(Spacer(1, 20))

        # Calculate total messages for percentage
        total_messages = history['total_chats']
        if total_messages == 0:  # Prevent division by zero
            total_messages = 1

        # Add sentiment analysis
        elements.append(Paragraph("Sentiment Analysis Summary", heading_style))
        sentiment_data = [
            ['Category', 'Count', 'Percentage'],
            ['Positive', 
             str(history['sentiment_count']['positive']),
             f"{(history['sentiment_count']['positive'] / total_messages * 100):.1f}%"],
            ['Neutral', 
             str(history['sentiment_count']['neutral']),
             f"{(history['sentiment_count']['neutral'] / total_messages * 100):.1f}%"],
            ['Negative', 
             str(history['sentiment_count']['negative']),
             f"{(history['sentiment_count']['negative'] / total_messages * 100):.1f}%"]
        ]
        
        # Create and style the sentiment table
        sentiment_table = Table(sentiment_data, colWidths=[200, 100, 100])
        sentiment_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('BOX', (0, 0), (-1, -1), 2, colors.black),
            ('LINEBELOW', (0, 0), (-1, 0), 2, colors.black),
            ('BACKGROUND', (0, 0), (-1, 0), colors.white),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(sentiment_table)
        elements.append(Spacer(1, 20))

        # Add AI Summary
        elements.append(Paragraph("Analysis Summary", heading_style))
        elements.append(Paragraph(history.get('summary', 'No summary available'), normal_style))
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
                ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('BOX', (0, 0), (-1, -1), 2, colors.black),
                ('LINEBELOW', (0, 0), (-1, 0), 2, colors.black),
                ('BACKGROUND', (0, 0), (-1, 0), colors.white),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ]))
            return table

        # Add contributor tables
        elements.append(create_contributor_table("Most Positive Contributors", history['top_positive']))
        elements.append(Spacer(1, 10))
        elements.append(create_contributor_table("Most Neutral Contributors", history['top_neutral']))
        elements.append(Spacer(1, 10))
        elements.append(create_contributor_table("Most Negative Contributors", history['top_negative']))

        # Build the PDF
        doc.build(elements)

        # Get the value from the BytesIO buffer
        pdf_value = buffer.getvalue()
        buffer.close()

        # Log the PDF download
        add_log(
            mongo,
            session['user_id'],
            'Downloaded analysis PDF',
            f"Channel: {history.get('streamer_name', 'Unknown')}"
        )

        # Create the response
        response = make_response(pdf_value)
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename=chat_analysis_{history_id}.pdf'
        
        return response

    except Exception as e:
        print(f"PDF Generation Error: {str(e)}")  # Add detailed error logging
        return jsonify({'error': f'Failed to generate PDF: {str(e)}'}), 500

@app.route('/api/resend-otp', methods=['POST'])
def resend_otp():
    try:
        data = request.get_json()
        email = data.get('email')
        if not email:
            return jsonify({'error': 'Email is required'}), 400

        # Get user by email
        user = get_user_by_email(mongo, email)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        if user['status'] == 'active':
            return jsonify({'error': 'User is already verified'}), 400

        # Generate new OTP and update user
        from models.user import generate_otp
        secret, otp = generate_otp()
        now = datetime.utcnow()
        mongo.db.users.update_one(
            {'_id': user['_id']},
            {'$set': {'otp': secret, 'otp_created_at': now, 'updated_at': now}}
        )

        # Send OTP via email
        email_sent = send_otp_email(email, otp)
        if not email_sent:
            return jsonify({'error': 'Failed to send OTP email'}), 500

        return jsonify({'message': 'OTP resent successfully'}), 200
    except Exception as e:
        print(f"Error in resend_otp: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/contact', methods=['POST'])
def contact():
    try:
        data = request.get_json()
        name = data.get('name')
        email = data.get('email')
        subject = data.get('subject')
        message = data.get('message')

        # Validate all fields
        if not all([name, email, subject, message]):
            return jsonify({'error': 'All fields are required.'}), 400

        email_sent = send_contact_email(name, email, subject, message)
        if not email_sent:
            return jsonify({'error': 'Failed to send message.'}), 500

        return jsonify({'message': 'Message sent successfully!'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/change-password', methods=['POST'])
def change_password():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        data = request.get_json()
        old_password = data.get('old_password')
        new_password = data.get('new_password')
        if not old_password or not new_password:
            return jsonify({'error': 'Old and new password are required'}), 400
        user = get_user_by_id(mongo, session['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404
        if not verify_password(user, old_password):
            return jsonify({'error': 'Incorrect old password'}), 401
        # Validate new password
        is_valid, error_message = validate_password(new_password)
        if not is_valid:
            return jsonify({'error': error_message}), 400
        # Update password hash
        password_hash = generate_password_hash(new_password, method='pbkdf2:sha256')
        result = mongo.db.users.update_one(
            {'_id': user['_id']},
            {'$set': {'password_hash': password_hash, 'updated_at': datetime.utcnow()}}
        )
        if result.modified_count == 0:
            return jsonify({'error': 'Failed to update password'}), 500
        return jsonify({'message': 'Password changed successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/delete-account', methods=['DELETE'])
def delete_account():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        data = request.get_json()
        password = data.get('password')
        if not password:
            return jsonify({'error': 'Password is required'}), 400
        user = get_user_by_id(mongo, session['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404
        if not verify_password(user, password):
            return jsonify({'error': 'Incorrect password'}), 401
        # Delete the user
        result = mongo.db.users.delete_one({'_id': user['_id']})
        session.clear()
        if result.deleted_count == 0:
            return jsonify({'error': 'Failed to delete account'}), 500
        return jsonify({'message': 'Account deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    try:
        print("Starting Flask app...")
        print("App: ", app)
        print("Mongo: ", mongo)
        print("Active bots: ", active_bots)
        print("User bots: ", user_bots)
        import os
        port = int(os.environ.get("PORT", 8080))
        print("Port: ", os.environ.get("PORT"))
        print("Port: ", port)
        print(f"Environment: {'Production' if is_production else 'Development'}")
        print(f"Frontend URL: {frontend_url}")
        
        if is_production:
            app.debug = False
            app.run(host="0.0.0.0", port=port, debug=False)
        else:
            app.debug = True
            app.run(host="0.0.0.0", port=port, debug=True)
    except Exception as e:
        print(f"Failed to start server: {e}")
        raise
