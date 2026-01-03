#!/usr/bin/env python3
"""
Script to test authentication endpoints
Usage: python test_auth.py
"""
import requests
import json

# Configuration
BASE_URL = "http://localhost:8000/api/v1"

def test_register(email: str, password: str, full_name: str):
    """Test user registration"""
    print(f"\n{'='*60}")
    print("Testing Registration")
    print(f"{'='*60}")

    url = f"{BASE_URL}/auth/register"
    data = {
        "email": email,
        "password": password,
        "full_name": full_name
    }

    try:
        response = requests.post(url, json=data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_login(email: str, password: str):
    """Test user login"""
    print(f"\n{'='*60}")
    print("Testing Login")
    print(f"{'='*60}")

    url = f"{BASE_URL}/auth/login"
    data = {
        "username": email,  # OAuth2 expects 'username' field
        "password": password
    }

    try:
        response = requests.post(url, data=data)  # Note: data, not json
        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            token_data = response.json()
            print(f"✅ Login successful!")
            print(f"Access Token: {token_data['access_token'][:50]}...")
            print(f"Token Type: {token_data['token_type']}")
            return token_data['access_token']
        else:
            print(f"❌ Login failed: {response.json()}")
            return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def test_get_current_user(token: str):
    """Test getting current user info"""
    print(f"\n{'='*60}")
    print("Testing Get Current User")
    print(f"{'='*60}")

    url = f"{BASE_URL}/users/me"
    headers = {"Authorization": f"Bearer {token}"}

    try:
        response = requests.get(url, headers=headers)
        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            user_data = response.json()
            print(f"✅ User info retrieved!")
            print(f"User: {json.dumps(user_data, indent=2)}")
            return True
        else:
            print(f"❌ Failed: {response.json()}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    """Run all authentication tests"""
    print("\n" + "="*60)
    print("AUTHENTICATION TEST SUITE")
    print("="*60)
    print(f"Backend URL: {BASE_URL}")

    # Test credentials
    email = "testauth@example.com"
    password = "securepassword123"
    full_name = "Auth Test User"

    # Test 1: Register
    register_success = test_register(email, password, full_name)

    # Test 2: Login
    token = test_login(email, password)

    # Test 3: Get current user
    if token:
        test_get_current_user(token)

    # Test 4: Test with wrong password
    print(f"\n{'='*60}")
    print("Testing Invalid Credentials")
    print(f"{'='*60}")
    test_login(email, "wrongpassword")

    print("\n" + "="*60)
    print("TEST SUITE COMPLETE")
    print("="*60 + "\n")

if __name__ == "__main__":
    main()
