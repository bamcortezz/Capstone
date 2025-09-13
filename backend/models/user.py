from motor.motor_asyncio import AsyncIOMotorDatabase
from passlib.context import CryptContext
from datetime import datetime, timedelta
import secrets
import pyotp
from bson.objectid import ObjectId
from typing import Optional, Tuple

# Password hashing context
pwd_context = CryptContext(
    schemes=["bcrypt"], 
    deprecated="auto",
    bcrypt__default_rounds=12,
    bcrypt__min_rounds=10,
    bcrypt__max_rounds=15
)

async def create_user_schema(db: AsyncIOMotorDatabase):
    """Create user schema and indexes"""
    try:
        await db.users.create_index('email', unique=True)
        print("User schema created successfully")
    except Exception as e:
        print(f"User schema creation failed: {str(e)}")

def generate_otp() -> Tuple[str, str]:
    """Generate OTP secret and code"""
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret, interval=600)  # 600 seconds = 10 minutes
    return secret, totp.now()

def verify_otp(secret: str, otp: str) -> bool:
    """Verify OTP code"""
    totp = pyotp.TOTP(secret, interval=600)
    return totp.verify(otp)

async def create_user(db: AsyncIOMotorDatabase, user_data: dict) -> Tuple[dict, str]:
    """Create a new user"""
    now = datetime.utcnow()
    secret, otp = generate_otp()
    
    # Hash password with error handling
    try:
        password_hash = pwd_context.hash(user_data.get('password'))
    except Exception as e:
        print(f"Error hashing password: {e}")
        raise ValueError("Failed to hash password")
    
    user = {
        'first_name': user_data.get('first_name'),
        'last_name': user_data.get('last_name'),
        'email': user_data.get('email'),
        'password_hash': password_hash,
        'role': user_data.get('role', 'user'),  
        'status': 'not_active',  
        'reset_token': None,
        'token_expire': None,
        'otp': secret,  
        'otp_created_at': now,  
        'created_at': now,
        'updated_at': now,
        'profile_image': None 
    }
    result = await db.users.insert_one(user)
    return result, otp

async def activate_user(db: AsyncIOMotorDatabase, email: str) -> bool:
    """Activate user account"""
    now = datetime.utcnow()
    result = await db.users.update_one(
        {'email': email},
        {
            '$set': {
                'status': 'active',
                'otp': None, 
                'otp_created_at': None,
                'updated_at': now
            }
        }
    )
    return result.modified_count > 0

def generate_reset_token() -> Tuple[str, datetime]:
    """Generate password reset token"""
    token = secrets.token_urlsafe(32)
    expire = datetime.utcnow() + timedelta(hours=24)  
    return token, expire

async def get_user_by_email(db: AsyncIOMotorDatabase, email: str) -> Optional[dict]:
    """Get user by email"""
    return await db.users.find_one({'email': email})

def verify_password(user: dict, password: str) -> bool:
    """Verify user password"""
    if not user or not password:
        return False
    
    # Check if password_hash exists and is not empty
    password_hash = user.get('password_hash')
    if not password_hash:
        print("No password hash found for user")
        return False
    
    try:
        return pwd_context.verify(password, password_hash)
    except Exception as e:
        print(f"Password verification error: {e}")
        # If hash is corrupted or invalid, return False
        return False

def is_valid_password_hash(password_hash: str) -> bool:
    """Check if a password hash is valid and can be identified by passlib"""
    if not password_hash:
        return False
    
    try:
        # Try to identify the hash - this will raise an exception if invalid
        pwd_context.identify(password_hash)
        return True
    except Exception:
        return False

async def fix_corrupted_password_hash(db: AsyncIOMotorDatabase, email: str, new_password: str) -> bool:
    """Fix a corrupted password hash by setting a new password"""
    try:
        user = await get_user_by_email(db, email)
        if not user:
            return False
        
        # Generate a new password hash
        try:
            new_password_hash = pwd_context.hash(new_password)
        except Exception as e:
            print(f"Error hashing new password: {e}")
            return False
        
        # Update the user's password hash
        result = await db.users.update_one(
            {'email': email},
            {
                '$set': {
                    'password_hash': new_password_hash,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        return result.modified_count > 0
    except Exception as e:
        print(f"Error fixing corrupted password hash: {e}")
        return False

async def get_user_by_id(db: AsyncIOMotorDatabase, user_id: str) -> Optional[dict]:
    """Get user by ID"""
    try:
        return await db.users.find_one({'_id': ObjectId(user_id)})
    except:
        return None

async def update_profile(db: AsyncIOMotorDatabase, user_id: str, profile_data: dict) -> bool:
    """Update user profile"""
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
            existing_user = await db.users.find_one({
                'email': update_fields['email'],
                '_id': {'$ne': ObjectId(user_id)}
            })
            if existing_user:
                raise ValueError('Email is already taken')
            
        result = await db.users.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': update_fields}
        )
        return result.modified_count > 0
    except ValueError as e:
        raise e
    except:
        return False

async def update_profile_image(db: AsyncIOMotorDatabase, user_id: str, image_data: str) -> bool:
    """Update user profile image"""
    try:
        now = datetime.utcnow()
        result = await db.users.update_one(
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

async def remove_profile_image(db: AsyncIOMotorDatabase, user_id: str) -> bool:
    """Remove user profile image"""
    try:
        now = datetime.utcnow()
        result = await db.users.update_one(
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

async def save_reset_token(db: AsyncIOMotorDatabase, email: str) -> Tuple[Optional[dict], Optional[str]]:
    """Save password reset token for user"""
    try:
        user = await get_user_by_email(db, email)
        if not user:
            return None, None
            
        # Generate reset token and expiration
        token, expire = generate_reset_token()
        
        # Update the user document
        result = await db.users.update_one(
            {'_id': user['_id']},
            {
                '$set': {
                    'reset_token': token,
                    'token_expire': expire,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        if result.modified_count > 0:
            return user, token
        return None, None
    except Exception as e:
        print(f"Error saving reset token: {e}")
        return None, None

async def validate_reset_token(db: AsyncIOMotorDatabase, user_id: str, token: str) -> bool:
    """Validate password reset token"""
    try:
        user = await db.users.find_one({
            '_id': ObjectId(user_id),
            'reset_token': token,
            'token_expire': {'$gt': datetime.utcnow()}
        })
        return user is not None
    except Exception as e:
        print(f"Error validating reset token: {e}")
        return False

async def reset_password(db: AsyncIOMotorDatabase, user_id: str, token: str, new_password: str) -> bool:
    """Reset user password"""
    try:
        # Check if the token is valid
        if not await validate_reset_token(db, user_id, token):
            return False
            
        # Update the password and clear the reset token
        try:
            password_hash = pwd_context.hash(new_password)
        except Exception as e:
            print(f"Error hashing new password: {e}")
            return False
            
        result = await db.users.update_one(
            {'_id': ObjectId(user_id), 'reset_token': token},
            {
                '$set': {
                    'password_hash': password_hash,
                    'reset_token': None,
                    'token_expire': None,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        return result.modified_count > 0
    except Exception as e:
        print(f"Error resetting password: {e}")
        return False

async def update_user_by_admin(db: AsyncIOMotorDatabase, user_id: str, user_data: dict) -> Optional[dict]:
    """Update user by admin"""
    try:
        now = datetime.utcnow()
        
        # Validate status value
        status = user_data.get('status')
        valid_statuses = ['active', 'not_active', 'suspended']
            
        if status and status not in valid_statuses:
            raise ValueError(f'Status must be one of: {", ".join(valid_statuses)}')
            
        # Update the status in the user_data
        if status:
            user_data['status'] = status
            
        update_fields = {
            'first_name': user_data.get('first_name'),
            'last_name': user_data.get('last_name'),
            'email': user_data.get('email'),
            'role': user_data.get('role'),
            'status': status,
            'updated_at': now
        }
        
        # Remove None values
        update_fields = {k: v for k, v in update_fields.items() if v is not None}
        
        if not update_fields:
            return None
        
        # Check if email is being updated and if it's already taken
        if 'email' in update_fields:
            existing_user = await db.users.find_one({
                'email': update_fields['email'],
                '_id': {'$ne': ObjectId(user_id)}
            })
            if existing_user:
                raise ValueError('Email is already taken')
        
        result = await db.users.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': update_fields}
        )
        
        if result.modified_count > 0:
            updated_user = await db.users.find_one({'_id': ObjectId(user_id)})
            if updated_user:
                updated_user['_id'] = str(updated_user['_id'])
                # Remove sensitive information
                if 'password_hash' in updated_user:
                    del updated_user['password_hash']
                if 'reset_token' in updated_user:
                    del updated_user['reset_token']
                if 'token_expire' in updated_user:
                    del updated_user['token_expire']
                if 'otp' in updated_user:
                    del updated_user['otp']
                if 'otp_created_at' in updated_user:
                    del updated_user['otp_created_at']
            return updated_user
        return None
    except ValueError as e:
        raise e
    except Exception as e:
        print(f"Error updating user by admin: {e}")
        return None