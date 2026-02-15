"""
Test MongoDB connection
Run this file to check if MongoDB connection is working
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from urllib.parse import quote_plus
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def test_connection():
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'school_db')
    
    if not mongo_url:
        print("ERROR: MONGO_URL not found in .env file")
        return False
    
    print(f"Testing connection to: {mongo_url[:50]}...")
    print(f"Database name: {db_name}")
    
    try:
        # Try to connect
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=10000)
        
        # Test connection
        await client.admin.command('ping')
        print("SUCCESS: MongoDB connection successful!")
        
        # List databases
        db_list = await client.list_database_names()
        print(f"Available databases: {db_list}")
        
        # Test database access
        db = client[db_name]
        collections = await db.list_collection_names()
        print(f"Collections in '{db_name}': {collections}")
        
        client.close()
        return True
        
    except Exception as e:
        print(f"ERROR: Connection failed: {e}")
        print("\nTroubleshooting tips:")
        print("1. Check your MONGO_URL in .env file")
        print("2. Ensure MongoDB Atlas Network Access allows your IP (or 0.0.0.0/0)")
        print("3. Verify username and password are correct")
        print("4. Check if password contains special characters that need URL encoding")
        print("5. Ensure internet connection is working")
        return False

if __name__ == "__main__":
    asyncio.run(test_connection())
