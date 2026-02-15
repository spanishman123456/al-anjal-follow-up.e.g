#!/usr/bin/env python3
import requests
import json

base_url = "https://progress-pulse-172.preview.emergentagent.com"

# Common usernames to try
usernames_to_try = [
    "admin",
    "administrator", 
    "2297033843",
    "root",
    "user",
    "test",
    "demo"
]

passwords_to_try = [
    "Admin@123",
    "admin",
    "password",
    "123456",
    "admin123"
]

def test_login(username, password):
    """Test login with given credentials"""
    try:
        response = requests.post(
            f"{base_url}/api/auth/login",
            json={"username": username, "password": password},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ SUCCESS: {username}/{password}")
            print(f"   Token: {data.get('access_token', 'No token')[:50]}...")
            return data.get('access_token')
        else:
            print(f"❌ FAILED: {username}/{password} - Status: {response.status_code}")
            if response.content:
                try:
                    error = response.json()
                    print(f"   Error: {error}")
                except:
                    print(f"   Response: {response.text[:100]}")
    except Exception as e:
        print(f"❌ ERROR: {username}/{password} - {str(e)}")
    
    return None

def main():
    print("🔍 Testing login credentials...")
    
    # Try the specific credentials first
    token = test_login("2297033843", "Admin@123")
    if token:
        return token
        
    token = test_login("admin", "Admin@123")
    if token:
        return token
    
    # Try other combinations
    for username in usernames_to_try:
        for password in passwords_to_try:
            token = test_login(username, password)
            if token:
                return token
    
    print("\n❌ No valid credentials found")
    return None

if __name__ == "__main__":
    main()