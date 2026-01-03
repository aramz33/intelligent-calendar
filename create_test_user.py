#!/usr/bin/env python3
"""
Script to create a test user
Usage: python create_test_user.py [email] [password] [full_name]
"""
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from app.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash
from datetime import datetime

def create_test_user(email: str, password: str, full_name: str):
    db = SessionLocal()
    try:
        # Check if user exists
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            print(f"❌ User with email {email} already exists!")
            print(f"   User ID: {existing_user.id}")
            return

        # Create new user
        hashed_password = get_password_hash(password)
        user = User(
            email=email,
            hashed_password=hashed_password,
            full_name=full_name,
            timezone="UTC",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        print(f"✅ Test user created successfully!")
        print(f"   ID: {user.id}")
        print(f"   Email: {user.email}")
        print(f"   Full Name: {user.full_name}")
        print(f"   Password: {password}")

    except Exception as e:
        db.rollback()
        print(f"❌ Error creating user: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) == 4:
        email = sys.argv[1]
        password = sys.argv[2]
        full_name = sys.argv[3]
    else:
        # Default test user
        email = "test@example.com"
        password = "testpassword123"
        full_name = "Test User"
        print(f"Using default test user: {email} / {password}")

    create_test_user(email, password, full_name)
