"""
Ripple Effect Scheduler - Cascading Task Rescheduling

When a task is moved (via drag-and-drop), this service automatically
reschedules all conflicting tasks to maintain a valid schedule.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
import logging

from app.models.user import User
from app.models.soft_task import SoftTask
from app.models.hard_event import HardEvent
from app.services.scheduler import get_available_slots, TimeSlot

logger = logging.getLogger(__name__)


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


class RippleScheduler:
    """
    Handles cascading rescheduling when a task is moved.

    Algorithm:
    1. Move the target task to new position
    2. Find all tasks that now conflict (overlap)
    3. For each conflicting task, find the next available slot
    4. Recursively handle new conflicts created by moved tasks
    """

    def __init__(self, user: User, db: Session):
        self.user = user
        self.db = db

    def handle_task_move(
        self,
        moved_task: SoftTask,
        new_start: datetime,
        new_end: datetime
    ) -> List[Dict]:
        """
        When a task is moved (drag-and-drop), reschedule affected tasks.

        Args:
            moved_task: The task being moved
            new_start: New start time
            new_end: New end time

        Returns:
            List of changes: [{"task_id": 123, "old_start": ..., "new_start": ...}]
        """
        changes = []

        # Record the original position
        old_start = moved_task.scheduled_start
        old_end = moved_task.scheduled_end

        logger.info(f"Moving task {moved_task.id} from {old_start} to {new_start}")

        # Update moved task
        moved_task.scheduled_start = make_aware(new_start)
        moved_task.scheduled_end = make_aware(new_end)

        changes.append({
            "task_id": moved_task.id,
            "old_start": old_start.isoformat() if old_start else None,
            "new_start": new_start.isoformat()
        })

        # Find and reschedule conflicts
        conflicts = self._find_conflicts(
            make_naive(new_start),
            make_naive(new_end),
            exclude_task_id=moved_task.id
        )

        logger.info(f"Found {len(conflicts)} conflicting tasks")

        # Reschedule each conflict
        for conflict_task in conflicts:
            change = self._reschedule_task(conflict_task, after=make_naive(new_end))
            if change:
                changes.append(change)

        # Commit all changes
        self.db.commit()

        logger.info(f"Ripple effect complete: {len(changes)} tasks affected")
        return changes

    def _find_conflicts(
        self,
        start: datetime,
        end: datetime,
        exclude_task_id: Optional[int] = None
    ) -> List[SoftTask]:
        """
        Find tasks that overlap with given time range.

        Args:
            start: Start time (naive)
            end: End time (naive)
            exclude_task_id: Optional task ID to exclude from search

        Returns:
            List of conflicting tasks
        """
        start_aware = make_aware(start)
        end_aware = make_aware(end)

        query = self.db.query(SoftTask).filter(
            SoftTask.user_id == self.user.id,
            SoftTask.scheduled_start.isnot(None),
            SoftTask.scheduled_start < end_aware,
            SoftTask.scheduled_end > start_aware
        )

        if exclude_task_id:
            query = query.filter(SoftTask.id != exclude_task_id)

        return query.all()

    def _reschedule_task(
        self,
        task: SoftTask,
        after: datetime
    ) -> Optional[Dict]:
        """
        Reschedule a single task to the next available slot after given time.

        Args:
            task: Task to reschedule
            after: Find slot after this time (naive)

        Returns:
            Change record if successful, None otherwise
        """
        # Find next available slot
        next_slot = self._find_next_available_slot(
            duration_minutes=task.estimated_duration_minutes,
            after=after
        )

        if not next_slot:
            logger.warning(f"No available slot found for task {task.id}")
            return None

        # Record old position
        old_start = task.scheduled_start

        # Update task
        task.scheduled_start = make_aware(next_slot.start)
        task.scheduled_end = make_aware(next_slot.end)

        logger.info(f"Rescheduled task {task.id} to {next_slot.start}")

        return {
            "task_id": task.id,
            "old_start": old_start.isoformat() if old_start else None,
            "new_start": next_slot.start.isoformat()
        }

    def _find_next_available_slot(
        self,
        duration_minutes: int,
        after: datetime
    ) -> Optional[TimeSlot]:
        """
        Find next available slot after given time.

        Args:
            duration_minutes: Required duration
            after: Find slot after this time (naive)

        Returns:
            TimeSlot if found, None otherwise
        """
        # Get available slots for the next 14 days
        start_date = after.date()
        end_date = start_date + timedelta(days=14)

        available_slots = get_available_slots(
            user=self.user,
            start_date=start_date,
            end_date=end_date,
            db=self.db
        )

        # Filter slots that:
        # 1. Start after the 'after' time
        # 2. Are long enough for the task
        suitable_slots = [
            slot for slot in available_slots
            if slot.start >= after and slot.duration_minutes >= duration_minutes
        ]

        if not suitable_slots:
            return None

        # Return the earliest suitable slot
        earliest_slot = min(suitable_slots, key=lambda s: s.start)

        # Create a TimeSlot for exactly the duration needed
        return TimeSlot(
            start=earliest_slot.start,
            end=earliest_slot.start + timedelta(minutes=duration_minutes)
        )

    def check_for_hard_event_conflicts(
        self,
        start: datetime,
        end: datetime
    ) -> bool:
        """
        Check if proposed time range conflicts with hard events.

        Args:
            start: Start time (naive)
            end: End time (naive)

        Returns:
            True if there's a conflict, False otherwise
        """
        start_aware = make_aware(start)
        end_aware = make_aware(end)

        conflicts = self.db.query(HardEvent).filter(
            HardEvent.user_id == self.user.id,
            HardEvent.start_time < end_aware,
            HardEvent.end_time > start_aware
        ).count()

        return conflicts > 0
