"""Quick auto-scheduling test"""
import requests
from datetime import datetime, timedelta, date
import json

BASE_URL = "http://localhost:8000/api/v1"

def test_auto_schedule():
    print("🧪 Testing Auto-Scheduling\n")

    # Use a fixed test user email
    TEST_EMAIL = "testuser@example.com"
    TEST_PASSWORD = "testpass123"

    # Step 1: Register user (or skip if exists)
    print("1. Setting up test user...")
    reg_data = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "full_name": "Test User"
    }
    requests.post(f"{BASE_URL}/auth/register", json=reg_data)

    # Step 2: Login
    print("2. Logging in...")
    login_response = requests.post(
        f"{BASE_URL}/auth/login",
        data={"username": TEST_EMAIL, "password": TEST_PASSWORD}
    )

    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.text}")
        return

    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"✓ Logged in successfully\n")

    # Step 3: Get existing tasks or create new ones
    print("3. Getting/creating tasks...")
    tasks_response = requests.get(f"{BASE_URL}/tasks/", headers=headers)
    existing_tasks = tasks_response.json()

    # Filter for unscheduled tasks
    unscheduled = [t for t in existing_tasks if not t.get('scheduled_start')]

    if len(unscheduled) < 3:
        print(f"   Found {len(unscheduled)} unscheduled tasks, creating more...")
        # Create some test tasks
        test_tasks = [
            {
                "title": "Morning standup meeting",
                "estimated_duration_minutes": 30,
                "priority": 8,
                "deadline": (datetime.now() + timedelta(days=1)).isoformat(),
                "energy_required": "medium"
            },
            {
                "title": "Code review session",
                "estimated_duration_minutes": 60,
                "priority": 7,
                "energy_required": "high"
            },
            {
                "title": "Lunch break planning",
                "estimated_duration_minutes": 45,
                "priority": 5,
                "energy_required": "low"
            },
            {
                "title": "Team retrospective",
                "estimated_duration_minutes": 90,
                "priority": 9,
                "deadline": (datetime.now() + timedelta(days=2)).isoformat(),
                "energy_required": "medium"
            }
        ]

        for task_data in test_tasks:
            resp = requests.post(f"{BASE_URL}/tasks/", json=task_data, headers=headers)
            if resp.status_code == 200:
                task = resp.json()
                unscheduled.append(task)
                print(f"   ✓ Created: {task['title']}")

        # Refresh task list
        tasks_response = requests.get(f"{BASE_URL}/tasks/", headers=headers)
        existing_tasks = tasks_response.json()
        unscheduled = [t for t in existing_tasks if not t.get('scheduled_start')]

    task_ids = [t['id'] for t in unscheduled[:5]]  # Take first 5
    print(f"\n   Tasks to schedule: {len(task_ids)}")
    for t in unscheduled[:5]:
        deadline_str = f" (deadline: {t['deadline'][:10]})" if t.get('deadline') else ""
        print(f"   • [{t['id']}] {t['title']} - {t['estimated_duration_minutes']}min, Priority: {t['priority']}{deadline_str}")

    # Step 4: Auto-schedule tasks
    print(f"\n4. Running auto-scheduler...")
    schedule_data = {
        "task_ids": task_ids,
        "days_ahead": 7
    }

    schedule_response = requests.post(
        f"{BASE_URL}/schedule/auto",
        json=schedule_data,
        headers=headers
    )

    if schedule_response.status_code != 200:
        print(f"❌ Auto-scheduling failed: {schedule_response.text}")
        return

    result = schedule_response.json()
    print(f"\n✅ Auto-scheduling complete!")
    print(f"   • Scheduled: {result['scheduled_count']} tasks")
    print(f"   • Failed: {result['failed_count']} tasks")
    print(f"   • {result['message']}")

    # Step 5: View scheduled tasks
    print(f"\n5. Viewing scheduled tasks...")
    today = date.today()
    end_date = today + timedelta(days=7)

    calendar_response = requests.get(
        f"{BASE_URL}/calendar/",
        params={"start_date": today.isoformat(), "end_date": end_date.isoformat()},
        headers=headers
    )

    if calendar_response.status_code == 200:
        calendar_data = calendar_response.json()
        events = calendar_data['events']

        print(f"\n📅 Scheduled Events ({len(events)} total):")
        print("=" * 70)

        # Group by day
        by_day = {}
        for event in events:
            if event['type'] == 'soft_task':
                start = datetime.fromisoformat(event['start'].replace('Z', '+00:00'))
                day = start.strftime('%A, %B %d')
                if day not in by_day:
                    by_day[day] = []
                by_day[day].append(event)

        for day in sorted(by_day.keys()):
            print(f"\n{day}")
            print("-" * 70)
            for event in sorted(by_day[day], key=lambda e: e['start']):
                start = datetime.fromisoformat(event['start'].replace('Z', '+00:00'))
                end = datetime.fromisoformat(event['end'].replace('Z', '+00:00'))
                duration = (end - start).total_seconds() / 60
                priority_stars = "⭐" * min(event.get('priority', 0) // 2, 5)

                print(f"  {start.strftime('%I:%M %p')} - {end.strftime('%I:%M %p')} "
                      f"({int(duration)}min) {priority_stars}")
                print(f"    📝 {event['title']}")
                print(f"    Status: {event.get('status', 'N/A')} | Priority: {event.get('priority', 'N/A')}")

        unscheduled_count = len(calendar_data['unscheduled_tasks'])
        if unscheduled_count > 0:
            print(f"\n⚠️  {unscheduled_count} tasks remain unscheduled (may need more time slots)")

    print("\n" + "=" * 70)
    print("✅ TEST COMPLETE")
    print("=" * 70)

if __name__ == "__main__":
    test_auto_schedule()
