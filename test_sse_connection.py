#!/usr/bin/env python3
"""
Test script to verify SSE connection and message flow
"""
import requests
import json
import time
import threading
from datetime import datetime

# Configuration
API_URL = "https://backend-production-a3893.up.railway.app"  # Update with your actual backend URL
CHANNEL = "gorgc"

def test_sse_connection():
    """Test SSE connection to the chat stream"""
    print(f"Testing SSE connection to {API_URL}/api/sse/chat/{CHANNEL}")
    
    try:
        response = requests.get(
            f"{API_URL}/api/sse/chat/{CHANNEL}",
            stream=True,
            headers={'Accept': 'text/event-stream'},
            timeout=30
        )
        
        if response.status_code != 200:
            print(f"❌ SSE connection failed with status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
        print("✅ SSE connection established successfully")
        
        # Read SSE messages
        message_count = 0
        start_time = time.time()
        
        for line in response.iter_lines(decode_unicode=True):
            if line:
                print(f"📨 SSE Message: {line}")
                message_count += 1
                
                # Stop after 30 seconds or 10 messages
                if time.time() - start_time > 30 or message_count >= 10:
                    break
                    
        print(f"✅ Received {message_count} messages in {time.time() - start_time:.2f} seconds")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ SSE connection error: {e}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def test_debug_endpoint():
    """Test the debug endpoint to check SSE connection status"""
    print(f"\nTesting debug endpoint: {API_URL}/api/debug/sse")
    
    try:
        response = requests.get(f"{API_URL}/api/debug/sse", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Debug endpoint response:")
            print(json.dumps(data, indent=2))
            return True
        else:
            print(f"❌ Debug endpoint failed with status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Debug endpoint error: {e}")
        return False

def test_twitch_connect():
    """Test the Twitch connect endpoint"""
    print(f"\nTesting Twitch connect endpoint: {API_URL}/api/twitch/connect")
    
    try:
        response = requests.post(
            f"{API_URL}/api/twitch/connect",
            json={"url": f"https://www.twitch.tv/{CHANNEL}"},
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Twitch connect successful:")
            print(json.dumps(data, indent=2))
            return True
        else:
            print(f"❌ Twitch connect failed with status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Twitch connect error: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 Testing SSE Connection and Message Flow")
    print("=" * 50)
    
    # Test 1: Debug endpoint
    test_debug_endpoint()
    
    # Test 2: Twitch connect
    test_twitch_connect()
    
    # Test 3: SSE connection
    test_sse_connection()
    
    print("\n" + "=" * 50)
    print("🏁 Testing completed")

if __name__ == "__main__":
    main()
