#!/usr/bin/env python3
"""
Test script for backend calendar and scheduling features.
Run this from the backend directory: python test_backend.py
"""

import requests
from datetime import datetime, timedelta, date

BASE_URL = "http://localhost:8000/api/v1"

# Test credentials
import time
TEST_EMAIL = f"test{int(time.time())}@example.com"  # Unique email
TEST_PASSWORD = "testpassword123"


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)


def register_and_login():
    """Register a test user and get auth token"""
    print_section("1. User Registration & Login")

    # Try to register (will fail if user exists)
    register_data = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "full_name": "Test User"
    }

    response = requests.post(f"{BASE_URL}/auth/register", json=register_data)
    if response.status_code == 200:
        print("✓ New user registered successfully")
    else:
        print("ℹ User already exists, proceeding to login")

    # Login
    login_data = {
        "username": TEST_EMAIL,
        "password": TEST_PASSWORD
    }

    response = requests.post(
        f"{BASE_URL}/auth/login",
        data=login_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )

    if response.status_code == 200:
        token = response.json()["access_token"]
        print(f"✓ Login successful")
        return token
    else:
        print(f"✗ Login failed: {response.text}")
        return None


def test_working_hours(token):
    """Test working hours functionality"""
    print_section("2. Working Hours Configuration")

    headers = {"Authorization": f"Bearer {token}"}

    # Get current user info
    response = requests.get(f"{BASE_URL}/users/me", headers=headers)
    if response.status_code == 200:
        user = response.json()
        print(f"✓ Current working hours: {user['working_hours_start']} - {user['working_hours_end']}")
        print(f"✓ Working days: {', '.join(user['working_days'])}")
        print(f"✓ Default task duration: {user['default_task_duration']} minutes")

    # Update working hours
    update_data = {
        "working_hours_start": "08:00:00",
        "working_hours_end": "18:00:00",
        "working_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
        "default_task_duration": 60
    }

    response = requests.patch(f"{BASE_URL}/users/me", json=update_data, headers=headers)
    if response.status_code == 200:
        print("✓ Working hours updated successfully")
    else:
        print(f"✗ Failed to update: {response.text}")


def create_test_tasks(token):
    """Create some test tasks"""
    print_section("3. Creating Test Tasks")

    headers = {"Authorization": f"Bearer {token}"}

    # Sample tasks
    tasks = [
        {
            "title": "Call Anna",
            "estimated_duration_minutes": 30,
            "priority": 8,
            "deadline": (datetime.now() + timedelta(days=2)).isoformat(),
            "category": "work",
            "energy_required": "medium"
        },
        {
            "title": "Shop for new clothes",
            "estimated_duration_minutes": 120,
            "priority": 5,
            "category": "personal",
            "energy_required": "medium"
        },
        {
            "title": "Review project proposal",
            "estimated_duration_minutes": 90,
            "priority": 9,
            "deadline": (datetime.now() + timedelta(days=1)).isoformat(),
            "category": "work",
            "energy_required": "high"
        },
        {
            "title": "Gym workout",
            "estimated_duration_minutes": 60,
            "priority": 6,
            "category": "personal",
            "energy_required": "high"
        },
        {
            "title": "Plan weekend trip",
            "estimated_duration_minutes": 45,
            "priority": 4,
            "category": "personal",
            "energy_required": "low"
        }
    ]

    task_ids = []
    for task_data in tasks:
        response = requests.post(f"{BASE_URL}/tasks/", json=task_data, headers=headers)
        if response.status_code == 200:
            task_id = response.json()["id"]
            task_ids.append(task_id)
            print(f"✓ Created task: {task_data['title']} (ID: {task_id})")
        else:
            print(f"✗ Failed to create task: {response.text}")

    return task_ids


def test_calendar_view(token):
    """Test calendar view endpoint"""
    print_section("4. Calendar View")

    headers = {"Authorization": f"Bearer {token}"}

    # Get calendar for next 7 days
    today = date.today()
    end_date = today + timedelta(days=7)

    params = {
        "start_date": today.isoformat(),
        "end_date": end_date.isoformat()
    }

    response = requests.get(f"{BASE_URL}/calendar/", params=params, headers=headers)

    if response.status_code == 200:
        data = response.json()
        print(f"✓ Calendar view retrieved successfully")
        print(f"  - Scheduled events/tasks: {len(data['events'])}")
        print(f"  - Unscheduled tasks: {len(data['unscheduled_tasks'])}")

        if data['unscheduled_tasks']:
            print("\n  Unscheduled tasks:")
            for task in data['unscheduled_tasks']:
                deadline = f", Deadline: {task['deadline']}" if task['deadline'] else ""
                print(f"    • {task['title']} ({task['estimated_duration_minutes']}min, Priority: {task['priority']}{deadline})")

        return data
    else:
        print(f"✗ Failed to get calendar: {response.text}")
        return None


def test_auto_scheduling(token, task_ids):
    """Test auto-scheduling algorithm"""
    print_section("5. Auto-Scheduling")

    headers = {"Authorization": f"Bearer {token}"}

    # Auto-schedule tasks
    schedule_data = {
        "task_ids": task_ids,
        "days_ahead": 7
    }

    response = requests.post(f"{BASE_URL}/schedule/auto", json=schedule_data, headers=headers)

    if response.status_code == 200:
        result = response.json()
        print(f"✓ Auto-scheduling completed!")
        print(f"  - Successfully scheduled: {result['scheduled_count']} tasks")
        print(f"  - Failed to schedule: {result['failed_count']} tasks")
        print(f"  - Message: {result['message']}")

        if result['scheduled_task_ids']:
            print(f"\n  Scheduled task IDs: {result['scheduled_task_ids']}")
        if result['failed_task_ids']:
            print(f"  Failed task IDs: {result['failed_task_ids']}")
    else:
        print(f"✗ Auto-scheduling failed: {response.text}")


def test_calendar_after_scheduling(token):
    """View calendar after scheduling to see the results"""
    print_section("6. Calendar After Auto-Scheduling")

    headers = {"Authorization": f"Bearer {token}"}

    today = date.today()
    end_date = today + timedelta(days=7)

    params = {
        "start_date": today.isoformat(),
        "end_date": end_date.isoformat()
    }

    response = requests.get(f"{BASE_URL}/calendar/", params=params, headers=headers)

    if response.status_code == 200:
        data = response.json()
        print(f"✓ Updated calendar view:")
        print(f"  - Scheduled events/tasks: {len(data['events'])}")
        print(f"  - Unscheduled tasks: {len(data['unscheduled_tasks'])}")

        if data['events']:
            print("\n  Scheduled items:")
            for event in data['events'][:10]:  # Show first 10
                start = datetime.fromisoformat(event['start'].replace('Z', '+00:00'))
                end = datetime.fromisoformat(event['end'].replace('Z', '+00:00'))
                type_emoji = "📅" if event['type'] == 'hard_event' else "✅"
                print(f"    {type_emoji} {event['title']}")
                print(f"       {start.strftime('%a %b %d, %I:%M %p')} - {end.strftime('%I:%M %p')}")
    else:
        print(f"✗ Failed to get updated calendar: {response.text}")


def main():
    """Run all tests"""
    print("\n🚀 Testing Intelligent Calendar Backend")
    print(f"Base URL: {BASE_URL}")

    # 1. Register and login
    token = register_and_login()
    if not token:
        print("\n❌ Cannot proceed without authentication")
        return

    # 2. Test working hours
    test_working_hours(token)

    # 3. Create test tasks
    task_ids = create_test_tasks(token)

    # 4. View calendar before scheduling
    test_calendar_view(token)

    # 5. Auto-schedule tasks
    if task_ids:
        test_auto_scheduling(token, task_ids)

        # 6. View calendar after scheduling
        test_calendar_after_scheduling(token)

    print_section("✅ All Tests Complete!")
    print("\n💡 You can now:")
    print("   - Visit http://localhost:3000 to see the UI")
    print("   - Check http://localhost:8000/docs for API documentation")
    print("   - View scheduled tasks in the frontend calendar (once built)")


if __name__ == "__main__":
    main()