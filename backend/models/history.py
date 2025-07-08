from datetime import datetime
from bson.objectid import ObjectId
from utils.gemini_analyzer import generate_analysis_summary
import traceback
import logging
import os

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

def create_history_schema(mongo):
    try:
        mongo.db.history.create_index([('user_id', 1)])  
        mongo.db.history.create_index([('created_at', -1)])  
        mongo.db.history.create_index([('status', 1)]) 
    except Exception as e:
        logger.error(f"History index creation failed: {str(e)}")

def validate_top_contributors(contributors):
    if not contributors or not isinstance(contributors, list):
        return []
    return contributors[:5]  

def save_analysis(mongo, data):
    try:
        now = datetime.utcnow()
        
        # Validate required data
        if not data.get('user_id'):
            raise ValueError("user_id is required")
            
        # Log incoming data for debugging
        logger.debug(f"Saving analysis for user_id: {data.get('user_id')}")
        logger.debug(f"Data keys: {list(data.keys())}")
        
        # Validate MongoDB connection
        try:
            mongo.db.command('ping')
        except Exception as e:
            logger.error(f"MongoDB connection error: {str(e)}")
            raise ConnectionError("Failed to connect to MongoDB")

        # Validate contributors with error handling
        try:
            data['top_positive'] = validate_top_contributors(data['top_positive'])
            data['top_negative'] = validate_top_contributors(data['top_negative'])
            data['top_neutral'] = validate_top_contributors(data['top_neutral'])
        except Exception as e:
            logger.error(f"Error validating contributors: {str(e)}")
            
            data['top_positive'] = data.get('top_positive', [])[:5]
            data['top_negative'] = data.get('top_negative', [])[:5]
            data['top_neutral'] = data.get('top_neutral', [])[:5]

        summary = "Summary generation failed. Please try again later."
        try:
            # Check if Gemini API key is configured
            if not os.getenv('GEMINI_API_KEY'):
                logger.warning("GEMINI_API_KEY not found in environment variables")
                summary = "Summary generation skipped: API key not configured"
            else:
                summary = generate_analysis_summary(data)
                if "Unable to generate summary" in summary:
                    logger.warning(f"Gemini API warning: {summary}")
        except Exception as e:
            logger.error(f"Error generating summary: {str(e)}")
            logger.error(traceback.format_exc())

        try:
            history = {
                'user_id': ObjectId(data['user_id']),
                'streamer_name': data.get('streamer_name', 'Unknown Streamer'),
                'total_chats': data.get('total_chats', 0),
                'sentiment_count': {
                    'positive': data.get('sentiment_count', {}).get('positive', 0),
                    'negative': data.get('sentiment_count', {}).get('negative', 0),
                    'neutral': data.get('sentiment_count', {}).get('neutral', 0)
                },
                'top_positive': data.get('top_positive', []),
                'top_negative': data.get('top_negative', []),
                'top_neutral': data.get('top_neutral', []),
                'summary': summary,
                'status': 'active',
                'duration': data.get('duration', 0),
                'created_at': now,
                'updated_at': now
            }
        except Exception as e:
            logger.error(f"Error constructing history document: {str(e)}")
            raise ValueError("Failed to construct history document")
        
        # Insert into database
        try:
            logger.debug("Inserting history document into database")
            result = mongo.db.history.insert_one(history)
            logger.debug(f"Inserted document with ID: {result.inserted_id}")
            return result.inserted_id
        except Exception as e:
            logger.error(f"Error inserting document into MongoDB: {str(e)}")
            raise
        
    except Exception as e:
        logger.error(f"Unhandled error in save_analysis: {str(e)}")
        logger.error(traceback.format_exc())
        raise  

def get_user_history(mongo, user_id):
    try:
        history = mongo.db.history.find({
            'user_id': ObjectId(user_id),
            'status': 'active'
        }).sort('created_at', -1)
        return list(history)
    except Exception as e:
        logger.error(f"Error fetching history: {str(e)}")
        return []

def get_history_by_id(mongo, history_id):
    try:
        return mongo.db.history.find_one({'_id': ObjectId(history_id)})
    except Exception as e:
        logger.error(f"Error fetching history by id: {str(e)}")
        return None

def delete_history(mongo, history_id, user_id):
    try:
        result = mongo.db.history.update_one(
            {
                '_id': ObjectId(history_id),
                'user_id': ObjectId(user_id) 
            },
            {
                '$set': {
                    'status': 'deleted',
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        if result.modified_count == 0:
            logger.warning(f"No history found for id: {history_id} and user_id: {user_id}")
            return False
            
        logger.debug(f"Successfully deleted history id: {history_id}")
        return True
        
    except Exception as e:
        logger.error(f"Error deleting history: {str(e)}")
        return False
