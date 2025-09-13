from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timedelta
from typing import Dict, List, Optional

async def create_logs_schema(db: AsyncIOMotorDatabase):
    """Create logs schema and indexes"""
    try:
        await db.logs.create_index('user_id')
        await db.logs.create_index('created_at')
        print("Logs schema created successfully")
    except Exception as e:
        print(f"Logs schema creation failed: {str(e)}")

async def add_log(db: AsyncIOMotorDatabase, user_id: str, activity: str, details: str = "") -> Optional[str]:
    """Add a log entry"""
    try:
        now = datetime.utcnow()
        
        log_doc = {
            'user_id': user_id,
            'activity': activity,
            'details': details,
            'created_at': now
        }
        
        result = await db.logs.insert_one(log_doc)
        return str(result.inserted_id)
    except Exception as e:
        print(f"Error adding log: {e}")
        return None

async def get_logs(
    db: AsyncIOMotorDatabase, 
    page: int = 1, 
    limit: int = 10, 
    search: Optional[str] = None,
    sort_field: str = 'created_at',
    sort_direction: str = 'desc',
    activity: Optional[str] = None
) -> Dict:
    """Get logs with pagination and filtering"""
    try:
        # Build query
        query = {}
        
        if search:
            query['$or'] = [
                {'activity': {'$regex': search, '$options': 'i'}},
                {'details': {'$regex': search, '$options': 'i'}}
            ]
        
        if activity:
            query['activity'] = activity
        
        # Calculate skip
        skip = (page - 1) * limit
        
        # Determine sort direction
        sort_direction_value = -1 if sort_direction == 'desc' else 1
        
        # Get logs
        logs = []
        total_count = await db.logs.count_documents(query)
        
        async for log in db.logs.find(query).sort(sort_field, sort_direction_value).skip(skip).limit(limit):
            log['_id'] = str(log['_id'])
            logs.append(log)
        
        # Calculate pagination info
        total_pages = (total_count + limit - 1) // limit
        has_next = page < total_pages
        has_prev = page > 1
        
        return {
            'logs': logs,
            'pagination': {
                'current_page': page,
                'total_pages': total_pages,
                'total_count': total_count,
                'has_next': has_next,
                'has_prev': has_prev,
                'limit': limit
            }
        }
    except Exception as e:
        print(f"Error getting logs: {e}")
        return {
            'logs': [],
            'pagination': {
                'current_page': 1,
                'total_pages': 0,
                'total_count': 0,
                'has_next': False,
                'has_prev': False,
                'limit': limit
            }
        }

async def clear_old_logs(db: AsyncIOMotorDatabase, days_to_keep: int = 90) -> int:
    """Clear logs older than specified days"""
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
        
        result = await db.logs.delete_many({
            'created_at': {'$lt': cutoff_date}
        })
        
        return result.deleted_count
    except Exception as e:
        print(f"Error clearing old logs: {e}")
        return 0