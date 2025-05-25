from datetime import datetime, timedelta
from bson.objectid import ObjectId
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

def create_logs_schema(mongo):
    """
    Create necessary indexes for the logs collection
    """
    try:
        # Create indexes for efficient querying
        mongo.db.logs.create_index([('user_id', 1)])  # Index for user_id
        mongo.db.logs.create_index([('timestamp', -1)])  # Index for sorting by date
        mongo.db.logs.create_index([('activity', 1)])  # Index for filtering by activity
    except Exception as e:
        logger.error(f"Logs index creation failed: {str(e)}")

def add_log(mongo, user_id, activity, details=None):
    try:
        # Get user info for the log
        user = mongo.db.users.find_one({'_id': ObjectId(user_id)})
        user_name = f"{user['first_name']} {user['last_name']}" if user else "Unknown User"
        
        log_entry = {
            'user_id': ObjectId(user_id),
            'user_name': user_name,
            'activity': activity,
            'details': details,
            'timestamp': datetime.utcnow()
        }
        
        result = mongo.db.logs.insert_one(log_entry)
        return result.inserted_id
    except Exception as e:
        logger.error(f"Error adding log: {str(e)}")
        # Don't raise the exception - logging should not block normal operation
        return None

def get_logs(mongo, page=1, limit=10, search=None, sort_field='timestamp', sort_direction='desc', activity=None):

    try:
        # Build query
        query = {}
        
        # Add search filter if provided
        if search:
            query['$or'] = [
                {'user_name': {'$regex': search, '$options': 'i'}},
                {'activity': {'$regex': search, '$options': 'i'}},
                {'details': {'$regex': search, '$options': 'i'}}
            ]
            
        # Add activity filter if provided
        if activity and activity != 'all':
            query['activity'] = {'$regex': activity, '$options': 'i'}
        
        # Set up sorting
        sort_order = 1 if sort_direction == 'asc' else -1
        
        # Count total matching documents
        total_items = mongo.db.logs.count_documents(query)
        
        # Calculate skip value for pagination
        skip = (page - 1) * limit
        
        # Get paginated and sorted results
        logs = mongo.db.logs.find(query).sort(sort_field, sort_order).skip(skip).limit(limit)
        
        # Convert to list and process ObjectIds for JSON serialization
        logs_list = []
        for log in logs:
            log['_id'] = str(log['_id'])
            log['user_id'] = str(log['user_id'])
            # Convert timestamp to ISO format string for easier frontend handling
            log['timestamp'] = log['timestamp'].isoformat() if log.get('timestamp') else None
            logs_list.append(log)
        
        return {
            'logs': logs_list,
            'totalItems': total_items
        }
    
    except Exception as e:
        logger.error(f"Error getting logs: {str(e)}")
        return {
            'logs': [],
            'totalItems': 0
        }

def clear_old_logs(mongo, days_to_keep=90):
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
        result = mongo.db.logs.delete_many({'timestamp': {'$lt': cutoff_date}})
        return result.deleted_count
    except Exception as e:
        logger.error(f"Error clearing old logs: {str(e)}")
        return 0 