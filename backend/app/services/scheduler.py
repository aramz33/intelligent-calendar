"""
Simple rule-based scheduling algorithm for automatic task placement.

This algorithm finds available time slots within user's working hours
and schedules tasks based on priority and deadlines.
"""

from datetime import datetime, timedelta, time, date, timezone
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.soft_task import SoftTask
from app.models.hard_event import HardEvent


def make_aware(dt: datetime) -> datetime:
    """Make a datetime timezone-aware (UTC) if it's naive"""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def make_naive(dt: datetime) -> datetime:
    """Make a datetime timezone-naive"""
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


class TimeSlot:
    """Represents a time slot for scheduling"""
    def __init__(self, start: datetime, end: datetime):
        self.start = start
        self.end = end

    @property
    def duration_minutes(self) -> int:
        return int((self.end - self.start).total_seconds() / 60)

    def __repr__(self):
        return f"TimeSlot({self.start} - {self.end})"


def get_available_slots(
        user: User,
        start_date: date,
        end_date: date,
        db: Session
) -> List[TimeSlot]:
    """
    Get list of available time slots within user's working hours,
    excluding hard events and scheduled tasks.
    """
    slots = []

    # Get all busy periods (hard events + scheduled tasks)
    busy_periods = []

    # Hard events
    hard_events = db.query(HardEvent).filter(
        HardEvent.user_id == user.id,
        HardEvent.start_time >= datetime.combine(start_date, datetime.min.time()),
        HardEvent.start_time <= datetime.combine(end_date, datetime.max.time())
    ).all()

    for event in hard_events:
        busy_periods.append((make_naive(event.start_time), make_naive(event.end_time)))

    # Scheduled tasks
    scheduled_tasks = db.query(SoftTask).filter(
        SoftTask.user_id == user.id,
        SoftTask.scheduled_start.isnot(None),
        SoftTask.scheduled_start >= datetime.combine(start_date, datetime.min.time()),
        SoftTask.scheduled_start <= datetime.combine(end_date, datetime.max.time())
    ).all()

    for task in scheduled_tasks:
        busy_periods.append((make_naive(task.scheduled_start), make_naive(task.scheduled_end)))

    # Sort busy periods by start time
    busy_periods.sort(key=lambda x: x[0])

    # Get current time (naive) to skip past slots
    now = datetime.now()

    # Iterate through each day
    current_date = start_date
    while current_date <= end_date:
        # Check if it's a working day
        day_name = current_date.strftime('%A').lower()
        if day_name not in user.working_days:
            current_date += timedelta(days=1)
            continue

        # Get working hours for this day
        work_start = datetime.combine(current_date, user.working_hours_start)
        work_end = datetime.combine(current_date, user.working_hours_end)

        # Skip past times - if today, start from current time
        if current_date == now.date() and work_start < now:
            work_start = now

        # Skip if working hours are already past
        if work_start >= work_end:
            current_date += timedelta(days=1)
            continue

        # Find free slots by removing busy periods from working hours
        current_time = work_start

        for busy_start, busy_end in busy_periods:
            # Skip if busy period is not on this day
            if busy_start.date() != current_date:
                continue

            # If there's a gap before the busy period, add it as a free slot
            if current_time < busy_start:
                slots.append(TimeSlot(current_time, busy_start))

            # Move current time to end of busy period
            if busy_end > current_time:
                current_time = busy_end

        # Add remaining time until end of work day
        if current_time < work_end:
            slots.append(TimeSlot(current_time, work_end))

        current_date += timedelta(days=1)

    return slots


def find_best_slot(
        task: SoftTask,
        available_slots: List[TimeSlot],
        prefer_earlier: bool = True
) -> Optional[TimeSlot]:
    """
    Find the best time slot for a task.

    Args:
        task: The task to schedule
        available_slots: List of available time slots
        prefer_earlier: If True, prefer earlier slots. If False, prefer later slots (for deadline-based scheduling)

    Returns:
        Best time slot or None if no suitable slot found
    """
    duration_needed = task.estimated_duration_minutes

    # Filter slots that are large enough
    suitable_slots = [
        slot for slot in available_slots
        if slot.duration_minutes >= duration_needed
    ]

    if not suitable_slots:
        return None

    # If task has a deadline, prefer slots closer to deadline
    if task.deadline and not prefer_earlier:
        # Find slot closest to but before deadline
        # Make deadline timezone-naive if slot.start is naive
        deadline = task.deadline.replace(tzinfo=None) if task.deadline.tzinfo else task.deadline
        suitable_slots.sort(key=lambda s: abs((deadline - s.start).total_seconds()))
    else:
        # Prefer earlier slots
        suitable_slots.sort(key=lambda s: s.start)

    return suitable_slots[0]


def schedule_task(
        task: SoftTask,
        slot: TimeSlot,
        db: Session
) -> bool:
    """
    Schedule a task in the given time slot.

    Args:
        task: Task to schedule
        slot: Time slot to use
        db: Database session

    Returns:
        True if successfully scheduled, False otherwise
    """
    try:
        # Make times timezone-aware for database storage
        task.scheduled_start = make_aware(slot.start)
        task.scheduled_end = make_aware(slot.start + timedelta(minutes=task.estimated_duration_minutes))
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        print(f"Error scheduling task {task.id}: {e}")
        return False


def auto_schedule_tasks(
        user: User,
        task_ids: List[int],
        db: Session,
        days_ahead: int = 7
) -> Tuple[List[int], List[int]]:
    """
    Automatically schedule multiple tasks.

    Args:
        user: User whose tasks to schedule
        task_ids: List of task IDs to schedule
        db: Database session
        days_ahead: Number of days to look ahead for scheduling (default: 7)

    Returns:
        Tuple of (successfully_scheduled_ids, failed_to_schedule_ids)
    """
    scheduled = []
    failed = []

    # Get tasks
    tasks = db.query(SoftTask).filter(
        SoftTask.id.in_(task_ids),
        SoftTask.user_id == user.id
    ).all()

    # Sort by priority (desc) and deadline (asc)
    tasks.sort(key=lambda t: (-t.priority, t.deadline or datetime.max))

    # Get available slots for the next week
    start_date = date.today()
    end_date = start_date + timedelta(days=days_ahead)

    for task in tasks:
        # Get fresh available slots (since we're modifying the schedule)
        available_slots = get_available_slots(user, start_date, end_date, db)

        # Find best slot
        prefer_earlier = task.deadline is None
        best_slot = find_best_slot(task, available_slots, prefer_earlier)

        if best_slot and schedule_task(task, best_slot, db):
            scheduled.append(task.id)
        else:
            failed.append(task.id)

    return scheduled, failed
