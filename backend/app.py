from flask import Flask, request, jsonify, session, make_response
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
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from io import BytesIO

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
# Map user_id to list of channels they started
user_bots = {}

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
    create_logs_schema(mongo)

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
        
        # Validate password with enhanced policy
        is_valid, error_message = validate_password(data['password'])
        if not is_valid:
            return jsonify({'error': error_message}), 400
            
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

        # Check account status and return appropriate message
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
        user_id = session.get('user_id')
        # Disconnect all bots started by this user
        if user_id and user_id in user_bots:
            channels = list(user_bots[user_id])
            for channel in channels:
                if channel in active_bots:
                    try:
                        bot, thread = active_bots[channel]
                        bot.disconnect()
                        bot.die()
                    except Exception as e:
                        print(f"Error during bot disconnection on logout: {e}")
                    finally:
                        active_bots.pop(channel, None)
                        # Optionally emit disconnect notification
                        socketio.emit('disconnect_notification', {'channel': channel})
            user_bots.pop(user_id, None)
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
            
        import random
        bot_username = f"justinfan{random.randint(1000, 999999)}"
        
        try:
            bot = TwitchChatBot(
                token="SCHMOOPIIE",
                username=bot_username,
                channel=channel,
                socket_handler=broadcast_message
            )
            
            # Start bot in a separate thread
            thread = threading.Thread(target=bot.start)
            thread.daemon = True
            thread.start()
            
            active_bots[channel] = (bot, thread)
            # Track which user started this bot
            user_id = session.get('user_id')
            if user_id:
                user_bots.setdefault(user_id, set()).add(channel)
            
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
                bot.disconnect()
                bot.die()
            except Exception as e:
                print(f"Error during bot disconnection: {e}")
            finally:
                active_bots.pop(channel, None)
                socketio.emit('disconnect_notification', {'channel': channel})
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
        
        # Validate required fields
        required_fields = ['streamer_name', 'total_chats', 'sentiment_count', 
                         'top_positive', 'top_negative', 'top_neutral']
        
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Add user_id to the data
        data['user_id'] = current_user_id
        
        # Optionally: Accept duration from frontend (if present)
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
            
            # Log that the user accessed this analysis if authenticated
            if 'user_id' in session:
                add_log(
                    mongo, 
                    session['user_id'], 
                    'Viewed analysis', 
                    f"Channel: {history.get('streamer_name', 'Unknown')}"
                )
            
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
        if verify_otp(user['otp'], otp):
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
        streamer = data.get('streamer')
        
        if not streamer:
            return jsonify({'error': 'Streamer name is required'}), 400
        
        # Log the activity
        add_log(
            mongo, 
            session['user_id'], 
            'Started an analysis', 
            f"Channel: {streamer}"
        )
        
        return jsonify({'message': 'Activity logged successfully'}), 200
        
    except Exception as e:
        print(f"Error logging analysis start: {str(e)}")
        return jsonify({'error': str(e)}), 500

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
    import os
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, debug=True, allow_unsafe_werkzeug=True)
