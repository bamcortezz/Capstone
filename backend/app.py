from flask import Flask, request, jsonify, session, make_response
from flask_pymongo import PyMongo
import os
from flask_cors import CORS
from models.user import (
    create_user_schema, create_user, verify_otp, activate_user, 
    verify_password, get_user_by_email, get_user_by_id,
    update_profile, update_profile_image, remove_profile_image
)
from models.history import create_history_schema, save_analysis, get_user_history, get_history_by_id, delete_history
from werkzeug.security import generate_password_hash
from utils.email_sender import send_otp_email
from utils.twitch_chat import TwitchChatBot, extract_channel_name
from flask_socketio import SocketIO
from dotenv import load_dotenv
from datetime import timedelta
import threading
import secrets
from pymongo import MongoClient
from bson import ObjectId
import bcrypt
import base64
from datetime import datetime

load_dotenv()

app = Flask(__name__)
CORS(app, supports_credentials=True)  # Enable CORS for all routes with credentials

# MongoDB Configuration
app.config["MONGO_URI"] = os.getenv('MONGO_URI')
# Set a strong secret key for sessions
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', secrets.token_hex(32))
# Configure session
app.config['SESSION_COOKIE_SECURE'] = True  # Only send cookies over HTTPS in production
app.config['SESSION_COOKIE_HTTPONLY'] = True  # Prevent JavaScript access to session cookie
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # Prevent CSRF
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)  # Session lasts 30 days

mongo = PyMongo(app)

# Initialize Socket.IO with CORS support and other necessary settings
socketio = SocketIO(app, 
                   cors_allowed_origins="*", 
                   async_mode='threading',
                   ping_timeout=60,
                   ping_interval=25)

# Store active bots
active_bots = {}

# MongoDB connection
client = MongoClient('mongodb://localhost:27017/')
db = client['twitch_sentiment']

def broadcast_message(message_data):
    """Broadcast a chat message to all connected clients"""
    socketio.emit('chat_message', message_data)

# Ensure the MongoDB connection is established before creating schema
with app.app_context():
    # Initialize schemas
    create_user_schema(mongo)
    create_history_schema(mongo)

@app.route('/')
def index():
    return "Welcome to Flask MongoDB API"

@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        required_fields = ['email', 'password', 'first_name', 'last_name']
        
        # Check if all required fields are present
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400

        # Check if user already exists
        if mongo.db.users.find_one({'email': data['email']}):
            return jsonify({'error': 'Email already registered'}), 400
        
        # Create new user with default role and status
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
            # If email fails, delete the user and return error
            mongo.db.users.delete_one({'_id': result.inserted_id})
            return jsonify({'error': 'Failed to send verification email'}), 500
            
        return jsonify({
            'message': 'Registration successful. Please check your email for verification code.',
            'email': data['email']  # Return email for OTP verification
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

        if user['status'] != 'active':
            return jsonify({'error': 'Please verify your email before logging in'}), 403

        # Set session data
        session.permanent = True  # Use permanent session
        session['user_id'] = str(user['_id'])
        session['email'] = user['email']
        session['first_name'] = user['first_name']
        session['last_name'] = user['last_name']
        session['role'] = user['role']
        
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
            
        # Get user data to include profile image
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
            
        # Check if a bot is already active for this channel
        if channel in active_bots:
            # If already connected, just return success
            return jsonify({'message': f'Already connected to {channel}\'s chat', 'channel': channel}), 200
            
        # Use anonymous authentication with justinfan prefix
        # This is allowed by Twitch for read-only chat access
        import random
        bot_username = f"justinfan{random.randint(1000, 999999)}"
        
        try:
            bot = TwitchChatBot(
                token="SCHMOOPIIE",  # Special anonymous token for justinfan
                username=bot_username,
                channel=channel,
                socket_handler=broadcast_message
            )
            
            # Start bot in a separate thread
            thread = threading.Thread(target=bot.start)
            thread.daemon = True
            thread.start()
            
            active_bots[channel] = (bot, thread)
            
            return jsonify({'message': f'Connected to {channel}\'s chat', 'channel': channel}), 200
        except Exception as e:
            print(f"Error creating Twitch bot: {e}")
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
        
        if channel in active_bots:
            try:
                bot, thread = active_bots[channel]
                # Gracefully disconnect the bot
                bot.disconnect()
                bot.die()
            except Exception as e:
                print(f"Error during bot disconnection: {e}")
            finally:
                # Always remove from active bots and notify clients
                active_bots.pop(channel, None)
                socketio.emit('disconnect_notification', {'channel': channel})
        else:
            # Already disconnected, no need to do anything
            return jsonify({'message': 'Already disconnected'}), 200
        
        return jsonify({'message': f'Disconnected from {channel}\'s chat'}), 200
    
    except Exception as e:
        print(f"Error in disconnect_from_twitch: {e}")
        # Still return success even if we encounter errors, as we've tried to clean up
        return jsonify({'message': 'Attempted to disconnect from chat'}), 200

@app.route('/api/history/save', methods=['POST'])
def save_analysis_history():
    try:
        current_user_id = session['user_id']
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['streamer_name', 'total_chats', 'sentiment_count', 
                         'top_positive', 'top_negative', 'top_neutral']
        
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Add user_id to the data
        data['user_id'] = current_user_id
        
        # Save the analysis
        history_id = save_analysis(mongo, data)
        
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
        
        # Convert ObjectId to string for JSON serialization
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
                
            # Convert ObjectId to string for JSON serialization
            history['_id'] = str(history['_id'])
            history['user_id'] = str(history['user_id'])
            
            return jsonify(history), 200
        
        elif request.method == 'DELETE':
            # Ensure user is authenticated
            if 'user_id' not in session:
                return jsonify({'error': 'Unauthorized'}), 401
            
            # Delete the history item
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
            
        # Get user by email
        user = get_user_by_email(mongo, email)
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        # Check if user is already verified
        if user['status'] == 'active':
            return jsonify({'error': 'User is already verified'}), 400
            
        # Verify OTP
        if verify_otp(user['otp_secret'], otp):
            # Activate user
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
            # Remove profile image
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
        
        # Handle PUT request (existing image update logic)
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

if __name__ == '__main__':
    socketio.run(app, debug=True, allow_unsafe_werkzeug=True)
