from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from bson.objectid import ObjectId
from typing import List, Optional

async def create_history_schema(db: AsyncIOMotorDatabase):
    """Create history schema and indexes"""
    try:
        await db.history.create_index('user_id')
        await db.history.create_index('created_at')
        print("History schema created successfully")
    except Exception as e:
        print(f"History schema creation failed: {str(e)}")

async def save_analysis(db: AsyncIOMotorDatabase, analysis_data: dict) -> str:
    """Save analysis data to history"""
    try:
        now = datetime.utcnow()
        
        history_doc = {
            'user_id': analysis_data['user_id'],
            'streamer_name': analysis_data['streamer_name'],
            'total_chats': analysis_data['total_chats'],
            'sentiment_count': analysis_data['sentiment_count'],
            'top_positive': analysis_data['top_positive'],
            'top_negative': analysis_data['top_negative'],
            'top_neutral': analysis_data['top_neutral'],
            'duration': analysis_data.get('duration', 0),
            'summary': analysis_data.get('summary', ''),
            'status': 'active',
            'created_at': now,
            'updated_at': now
        }
        
        result = await db.history.insert_one(history_doc)
        return str(result.inserted_id)
    except Exception as e:
        print(f"Error saving analysis: {e}")
        raise

async def get_user_history(db: AsyncIOMotorDatabase, user_id: str) -> List[dict]:
    """Get user's analysis history"""
    try:
        history = []
        async for doc in db.history.find(
            {'user_id': user_id, 'status': 'active'}
        ).sort('created_at', -1):
            history.append(doc)
        return history
    except Exception as e:
        print(f"Error getting user history: {e}")
        return []

async def get_history_by_id(db: AsyncIOMotorDatabase, history_id: str) -> Optional[dict]:
    """Get specific history by ID"""
    try:
        return await db.history.find_one({'_id': ObjectId(history_id), 'status': 'active'})
    except Exception as e:
        print(f"Error getting history by ID: {e}")
        return None

async def delete_history(db: AsyncIOMotorDatabase, history_id: str, user_id: str) -> bool:
    """Delete history (soft delete)"""
    try:
        result = await db.history.update_one(
            {'_id': ObjectId(history_id), 'user_id': user_id},
            {'$set': {'status': 'deleted', 'updated_at': datetime.utcnow()}}
        )
        return result.modified_count > 0
    except Exception as e:
        print(f"Error deleting history: {e}")
        return False