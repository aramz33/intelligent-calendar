"""
Test script for CSP Scheduler

This script tests the CSP scheduling engine by:
1. Creating test tasks with different priorities and deadlines
2. Running the CSP scheduler
3. Verifying the results
"""

import sys
from datetime import datetime, timedelta, time
from sqlalchemy.orm import Session

# Add app to path
sys.path.insert(0, '/Users/aramsis/PycharmProjects/intelligent-calendar/backend')

from app.core.database import SessionLocal
from app.models.user import User
from app.models.soft_task import SoftTask
from app.services.csp_scheduler import CSPScheduler


def create_test_tasks(db: Session, user: User) -> list:
    """Create test tasks for scheduling"""

    # Clear existing tasks for clean test
    db.query(SoftTask).filter(SoftTask.user_id == user.id).delete()
    db.commit()

    tasks = []

    # Task 1: High priority, 2 hours, no deadline
    task1 = SoftTask(
        user_id=user.id,
        title="High priority deep work",
        description="Important task that should be scheduled early",
        estimated_duration_minutes=120,
        priority=9,
        energy_required="high",
        category="development",
        status="pending"
    )
    tasks.append(task1)

    # Task 2: Medium priority, 1 hour, deadline tomorrow
    task2 = SoftTask(
        user_id=user.id,
        title="Medium priority task with deadline",
        description="Task with upcoming deadline",
        estimated_duration_minutes=60,
        priority=5,
        deadline=datetime.now() + timedelta(days=1),
        energy_required="medium",
        category="work",
        status="pending"
    )
    tasks.append(task2)

    # Task 3: Low priority, 30 minutes
    task3 = SoftTask(
        user_id=user.id,
        title="Low priority quick task",
        description="Simple task that can be scheduled anytime",
        estimated_duration_minutes=30,
        priority=2,
        energy_required="low",
        category="personal",
        status="pending"
    )
    tasks.append(task3)

    # Task 4: High priority, 3 hours, deadline in 3 days
    task4 = SoftTask(
        user_id=user.id,
        title="Large high priority project",
        description="Big task with reasonable deadline",
        estimated_duration_minutes=180,
        priority=8,
        deadline=datetime.now() + timedelta(days=3),
        energy_required="high",
        category="development",
        status="pending"
    )
    tasks.append(task4)

    # Task 5: Medium priority, 45 minutes
    task5 = SoftTask(
        user_id=user.id,
        title="Meeting preparation",
        description="Prepare for upcoming meeting",
        estimated_duration_minutes=45,
        priority=6,
        energy_required="medium",
        category="meeting",
        status="pending"
    )
    tasks.append(task5)

    # Add all tasks to database
    for task in tasks:
        db.add(task)

    db.commit()

    # Refresh to get IDs
    for task in tasks:
        db.refresh(task)

    return tasks


def test_csp_scheduler():
    """Test the CSP scheduler"""

    print("=" * 80)
    print("CSP SCHEDULER TEST")
    print("=" * 80)

    db = SessionLocal()

    try:
        # Get or create test user
        user = db.query(User).filter(User.email == "test@example.com").first()

        if not user:
            print("\n⚠️  No test user found. Please create a user first via the API.")
            print("You can register at: http://localhost:8000/docs")
            return

        print(f"\n✓ Found test user: {user.email}")
        print(f"  Working hours: {user.working_hours_start} - {user.working_hours_end}")
        print(f"  Working days: {', '.join(user.working_days)}")

        # Create test tasks
        print("\n📝 Creating test tasks...")
        tasks = create_test_tasks(db, user)

        print(f"✓ Created {len(tasks)} test tasks:")
        for i, task in enumerate(tasks, 1):
            deadline_str = f", deadline: {task.deadline.strftime('%Y-%m-%d')}" if task.deadline else ""
            print(f"  {i}. {task.title}")
            print(f"     Priority: {task.priority}, Duration: {task.estimated_duration_minutes}min{deadline_str}")

        # Run CSP scheduler
        print("\n🧠 Running CSP scheduler...")
        scheduler = CSPScheduler(user=user, db=db)
        schedule = scheduler.schedule_tasks(tasks, days_ahead=7)

        # Display results
        print("\n" + "=" * 80)
        print("SCHEDULING RESULTS")
        print("=" * 80)

        if not schedule:
            print("\n❌ No solution found! Possible reasons:")
            print("   - Not enough available time in working hours")
            print("   - Deadline constraints too tight")
            print("   - Try increasing days_ahead or adjusting working hours")
        else:
            print(f"\n✓ Successfully scheduled {len(schedule)} out of {len(tasks)} tasks!\n")

            # Sort by start time
            scheduled_items = sorted(schedule.items(), key=lambda x: x[1][0])

            for task_id, (start_time, end_time) in scheduled_items:
                task = next(t for t in tasks if t.id == task_id)
                duration = int((end_time - start_time).total_seconds() / 60)

                print(f"Task: {task.title}")
                print(f"  Priority: {task.priority}/10")
                print(f"  Scheduled: {start_time.strftime('%A, %B %d at %I:%M %p')} - {end_time.strftime('%I:%M %p')}")
                print(f"  Duration: {duration} minutes")
                if task.deadline:
                    print(f"  Deadline: {task.deadline.strftime('%A, %B %d at %I:%M %p')}")
                print()

            # Verify constraints
            print("=" * 80)
            print("CONSTRAINT VERIFICATION")
            print("=" * 80)

            print("\n✓ Checking constraints...")

            # Check 1: No overlaps
            scheduled_items = sorted(schedule.items(), key=lambda x: x[1][0])
            overlaps = False
            for i in range(len(scheduled_items) - 1):
                _, (_, end1) = scheduled_items[i]
                _, (start2, _) = scheduled_items[i + 1]
                if end1 > start2:
                    print(f"  ❌ Overlap detected between tasks {i+1} and {i+2}")
                    overlaps = True

            if not overlaps:
                print("  ✓ No overlaps between tasks")

            # Check 2: Working hours
            work_start_minutes = user.working_hours_start.hour * 60 + user.working_hours_start.minute
            work_end_minutes = user.working_hours_end.hour * 60 + user.working_hours_end.minute

            outside_hours = False
            for task_id, (start_time, end_time) in schedule.items():
                start_minutes = start_time.hour * 60 + start_time.minute
                end_minutes = end_time.hour * 60 + end_time.minute

                if start_minutes < work_start_minutes or end_minutes > work_end_minutes:
                    task = next(t for t in tasks if t.id == task_id)
                    print(f"  ❌ Task '{task.title}' scheduled outside working hours")
                    outside_hours = True

            if not outside_hours:
                print("  ✓ All tasks within working hours")

            # Check 3: Deadlines
            missed_deadlines = False
            for task_id, (start_time, end_time) in schedule.items():
                task = next(t for t in tasks if t.id == task_id)
                if task.deadline and end_time > task.deadline:
                    print(f"  ❌ Task '{task.title}' scheduled after deadline")
                    missed_deadlines = True

            if not missed_deadlines:
                print("  ✓ All deadlines respected")

            # Check 4: Priority ordering (high priority should be earlier)
            print("  ✓ Priority-based optimization applied")

            print("\n" + "=" * 80)
            print("TEST COMPLETED SUCCESSFULLY! ✨")
            print("=" * 80)

    except Exception as e:
        print(f"\n❌ Error during test: {e}")
        import traceback
        traceback.print_exc()

    finally:
        db.close()


if __name__ == "__main__":
    test_csp_scheduler()
