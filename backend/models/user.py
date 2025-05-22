from flask_pymongo import PyMongo
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import secrets
import pyotp
from bson.objectid import ObjectId

def create_user_schema(mongo):
    try:
        # Create a unique index on email to prevent duplicate registrations
        mongo.db.users.create_index('email', unique=True)
    except Exception as e:
        print(f"Index creation failed: {str(e)}")

def generate_otp():
    # Generate a random base32 secret key
    secret = pyotp.random_base32()
    # Create a TOTP object with 6-digit OTP that expires in 10 minutes
    totp = pyotp.TOTP(secret, interval=600)  # 600 seconds = 10 minutes
    return secret, totp.now()

def verify_otp(secret, otp):
    totp = pyotp.TOTP(secret, interval=600)
    return totp.verify(otp)

def create_user(mongo, user_data):
    now = datetime.utcnow()
    secret, otp = generate_otp()
    
    user = {
        'first_name': user_data.get('first_name'),
        'last_name': user_data.get('last_name'),
        'email': user_data.get('email'),
        'password_hash': generate_password_hash(user_data.get('password'), method='pbkdf2:sha256'),
        'role': user_data.get('role', 'user'),  # Default to 'user' if not specified
        'status': 'not_active',  # Always start as not_active
        'reset_token': None,
        'token_expire': None,
        'otp_secret': secret,  # Store the OTP secret
        'otp_created_at': now,  # Track when OTP was created
        'created_at': now,
        'updated_at': now,
        'profile_image': None  # Add profile image field
    }
    result = mongo.db.users.insert_one(user)
    return result, otp

def activate_user(mongo, email):
    now = datetime.utcnow()
    return mongo.db.users.update_one(
        {'email': email},
        {
            '$set': {
                'status': 'active',
                'otp_secret': None,  # Clear OTP secret after verification
                'otp_created_at': None,
                'updated_at': now
            }
        }
    )

def generate_reset_token():
    token = secrets.token_urlsafe(32)
    expire = datetime.utcnow() + timedelta(hours=24)  # Token expires in 24 hours
    return token, expire

def get_user_by_email(mongo, email):
    return mongo.db.users.find_one({'email': email})

def verify_password(user, password):
    if not user or not password:
        return False
    return check_password_hash(user['password_hash'], password)

def get_user_by_id(mongo, user_id):
    try:
        return mongo.db.users.find_one({'_id': ObjectId(user_id)})
    except:
        return None

def update_profile(mongo, user_id, profile_data):
    try:
        now = datetime.utcnow()
        update_fields = {
            'first_name': profile_data.get('first_name'),
            'last_name': profile_data.get('last_name'),
            'email': profile_data.get('email'),
            'updated_at': now
        }
        
        # Remove None values
        update_fields = {k: v for k, v in update_fields.items() if v is not None}
        
        if not update_fields:
            return False
            
        # Check if email is being updated and if it's already taken
        if 'email' in update_fields:
            existing_user = mongo.db.users.find_one({
                'email': update_fields['email'],
                '_id': {'$ne': ObjectId(user_id)}
            })
            if existing_user:
                raise ValueError('Email is already taken')
            
        result = mongo.db.users.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': update_fields}
        )
        return result.modified_count > 0
    except ValueError as e:
        raise e
    except:
        return False

def update_profile_image(mongo, user_id, image_data):
    try:
        now = datetime.utcnow()
        result = mongo.db.users.update_one(
            {'_id': ObjectId(user_id)},
            {
                '$set': {
                    'profile_image': image_data,
                    'updated_at': now
                }
            }
        )
        return result.modified_count > 0
    except:
        return False

def remove_profile_image(mongo, user_id):
    try:
        now = datetime.utcnow()
        result = mongo.db.users.update_one(
            {'_id': ObjectId(user_id)},
            {
                '$set': {
                    'profile_image': None,
                    'updated_at': now
                }
            }
        )
        return result.modified_count > 0
    except:
        return False
