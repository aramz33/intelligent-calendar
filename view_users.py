#!/usr/bin/env python3
"""
Script to view all users in the database
Usage: python view_users.py
"""
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from app.database import SessionLocal
from app.models.user import User
from sqlalchemy import select

def main():
    db = SessionLocal()
    try:
        # Query all users
        result = db.execute(select(User))
        users = result.scalars().all()

        if not users:
            print("No users found in database")
            return

        print(f"\n{'='*80}")
        print(f"{'ID':<5} {'Email':<30} {'Full Name':<25} {'Created':<20}")
        print(f"{'='*80}")

        for user in users:
            created = user.created_at.strftime('%Y-%m-%d %H:%M:%S') if user.created_at else 'N/A'
            print(f"{user.id:<5} {user.email:<30} {user.full_name:<25} {created:<20}")

        print(f"{'='*80}")
        print(f"\nTotal users: {len(users)}\n")

        # Show detailed info for each user
        for user in users:
            print(f"\nUser ID: {user.id}")
            print(f"  Email: {user.email}")
            print(f"  Full Name: {user.full_name}")
            print(f"  Timezone: {user.timezone}")
            print(f"  Working Hours: {user.working_hours_start} - {user.working_hours_end}")
            print(f"  Working Days: {user.working_days}")
            print(f"  Calendar Sources: {len(user.calendar_sources)}")
            print(f"  Hard Events: {len(user.hard_events)}")
            print(f"  Soft Tasks: {len(user.soft_tasks)}")
            print(f"  Created: {user.created_at}")

    finally:
        db.close()

if __name__ == "__main__":
    main()
