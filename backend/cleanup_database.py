#!/usr/bin/env python3
"""
Database Cleanup Script for Twitch Insight
==========================================

This script will delete ALL data from the following MongoDB collections:
- logs
- history  
- users

WARNING: This action is IRREVERSIBLE and will permanently delete all data!

Usage:
    python cleanup_database.py

Requirements:
    - MongoDB connection configured in .env file
    - All dependencies from requirements.txt installed
"""

import os
import sys
from datetime import datetime
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId

# Load environment variables
load_dotenv()

def get_database_connection():
    """Establish connection to MongoDB database"""
    try:
        # Get MongoDB URI from environment variables
        mongo_uri = os.getenv('MONGO_URI')
        db_name = os.getenv('MONGO_DBNAME', 'twitch_sentiment')
        
        if not mongo_uri:
            print("❌ Error: MONGO_URI not found in environment variables")
            print("Please ensure your .env file contains MONGO_URI")
            sys.exit(1)
        
        # Connect to MongoDB
        client = MongoClient(mongo_uri)
        db = client[db_name]
        
        # Test connection
        client.admin.command('ping')
        print(f"✅ Successfully connected to MongoDB: {db_name}")
        
        return db, client
        
    except Exception as e:
        print(f"❌ Error connecting to MongoDB: {e}")
        sys.exit(1)

def get_collection_stats(db):
    """Get current statistics for each collection"""
    collections = ['users', 'history', 'logs']
    stats = {}
    
    for collection_name in collections:
        try:
            collection = db[collection_name]
            count = collection.count_documents({})
            stats[collection_name] = count
            print(f"📊 {collection_name}: {count} documents")
        except Exception as e:
            print(f"⚠️  Warning: Could not get stats for {collection_name}: {e}")
            stats[collection_name] = 0
    
    return stats

def confirm_deletion(stats):
    """Ask for user confirmation before deletion"""
    total_docs = sum(stats.values())
    
    if total_docs == 0:
        print("ℹ️  No data found in any collection. Nothing to delete.")
        return False
    
    print("\n" + "="*60)
    print("⚠️  WARNING: DATABASE CLEANUP")
    print("="*60)
    print(f"Total documents to be deleted: {total_docs}")
    print("\nCollections to be cleared:")
    for collection, count in stats.items():
        if count > 0:
            print(f"  - {collection}: {count} documents")
    
    print("\n🚨 THIS ACTION IS IRREVERSIBLE! 🚨")
    print("All data in these collections will be permanently deleted.")
    
    # Double confirmation
    print("\n" + "-"*40)
    confirmation1 = input("Type 'DELETE' to confirm: ").strip()
    
    if confirmation1 != 'DELETE':
        print("❌ Operation cancelled.")
        return False
    
    confirmation2 = input("Type 'YES' for final confirmation: ").strip()
    
    if confirmation2 != 'YES':
        print("❌ Operation cancelled.")
        return False
    
    return True

def cleanup_collections(db):
    """Delete all documents from specified collections"""
    collections = ['users', 'history', 'logs']
    results = {}
    
    print("\n🗑️  Starting cleanup process...")
    print("-" * 40)
    
    for collection_name in collections:
        try:
            collection = db[collection_name]
            
            # Get count before deletion
            count_before = collection.count_documents({})
            
            if count_before == 0:
                print(f"✅ {collection_name}: No documents to delete")
                results[collection_name] = 0
                continue
            
            # Delete all documents
            result = collection.delete_many({})
            deleted_count = result.deleted_count
            
            print(f"✅ {collection_name}: Deleted {deleted_count} documents")
            results[collection_name] = deleted_count
            
        except Exception as e:
            print(f"❌ Error deleting from {collection_name}: {e}")
            results[collection_name] = -1
    
    return results

def verify_cleanup(db):
    """Verify that all collections are empty"""
    print("\n🔍 Verifying cleanup...")
    print("-" * 40)
    
    collections = ['users', 'history', 'logs']
    all_empty = True
    
    for collection_name in collections:
        try:
            collection = db[collection_name]
            count = collection.count_documents({})
            
            if count == 0:
                print(f"✅ {collection_name}: Empty")
            else:
                print(f"⚠️  {collection_name}: {count} documents remaining")
                all_empty = False
                
        except Exception as e:
            print(f"❌ Error checking {collection_name}: {e}")
            all_empty = False
    
    return all_empty

def main():
    """Main function to execute the cleanup process"""
    print("🧹 Twitch Insight Database Cleanup Tool")
    print("=" * 50)
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Connect to database
    db, client = get_database_connection()
    
    try:
        # Get current statistics
        print("📈 Current database statistics:")
        stats = get_collection_stats(db)
        
        # Confirm deletion
        if not confirm_deletion(stats):
            return
        
        # Perform cleanup
        results = cleanup_collections(db)
        
        # Verify cleanup
        all_empty = verify_cleanup(db)
        
        # Summary
        print("\n" + "="*60)
        print("📋 CLEANUP SUMMARY")
        print("="*60)
        
        total_deleted = sum(count for count in results.values() if count > 0)
        print(f"Total documents deleted: {total_deleted}")
        
        for collection, count in results.items():
            if count > 0:
                print(f"  - {collection}: {count} documents deleted")
            elif count == 0:
                print(f"  - {collection}: No documents found")
            else:
                print(f"  - {collection}: Error occurred")
        
        if all_empty:
            print("\n✅ Database cleanup completed successfully!")
            print("All specified collections are now empty.")
        else:
            print("\n⚠️  Cleanup completed with warnings.")
            print("Some collections may still contain data.")
        
        print(f"\nCleanup completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
    except KeyboardInterrupt:
        print("\n\n❌ Operation cancelled by user.")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
    finally:
        # Close database connection
        client.close()
        print("\n🔌 Database connection closed.")

if __name__ == "__main__":
    main()
