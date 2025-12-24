from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
from typing import List

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.models.hard_event import HardEvent
from app.models.soft_task import SoftTask
from app.schemas.calendar import CalendarResponse, CalendarEvent, UnscheduledTask

router = APIRouter()


@router.get("/", response_model=CalendarResponse)
def get_calendar_view(
        start_date: date = Query(..., description="Start date for calendar view"),
        end_date: date = Query(..., description="End date for calendar view"),
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """
    Get calendar view with scheduled events, tasks, and unscheduled tasks.

    Returns:
    - events: Combined list of hard events and scheduled soft tasks
    - unscheduled_tasks: Tasks that haven't been scheduled yet
    """
    # Convert dates to datetime for queries
    start_datetime = datetime.combine(start_date, datetime.min.time())
    end_datetime = datetime.combine(end_date, datetime.max.time())

    # Get hard events in date range
    hard_events = db.query(HardEvent).filter(
        HardEvent.user_id == current_user.id,
        HardEvent.start_time >= start_datetime,
        HardEvent.start_time <= end_datetime
    ).order_by(HardEvent.start_time).all()

    # Get scheduled soft tasks in date range
    scheduled_tasks = db.query(SoftTask).filter(
        SoftTask.user_id == current_user.id,
        SoftTask.scheduled_start.isnot(None),
        SoftTask.scheduled_start >= start_datetime,
        SoftTask.scheduled_start <= end_datetime
    ).order_by(SoftTask.scheduled_start).all()

    # Get unscheduled tasks (no scheduled_start or scheduled before today)
    unscheduled = db.query(SoftTask).filter(
        SoftTask.user_id == current_user.id,
        SoftTask.status != "completed",
        (SoftTask.scheduled_start.is_(None)) | (SoftTask.scheduled_start < datetime.now())
    ).order_by(SoftTask.priority.desc(), SoftTask.deadline.asc()).all()

    # Convert to calendar events
    events: List[CalendarEvent] = []

    # Add hard events
    for event in hard_events:
        events.append(CalendarEvent(
            type="hard_event",
            id=event.id,
            title=event.title,
            start=event.start_time,
            end=event.end_time,
            location=event.location,
            is_all_day=event.is_all_day
        ))

    # Add scheduled tasks
    for task in scheduled_tasks:
        events.append(CalendarEvent(
            type="soft_task",
            id=task.id,
            title=task.title,
            start=task.scheduled_start,
            end=task.scheduled_end,
            status=task.status,
            priority=task.priority
        ))

    # Sort all events by start time
    events.sort(key=lambda e: e.start)

    # Convert unscheduled tasks to response format
    unscheduled_tasks = [
        UnscheduledTask(
            id=task.id,
            title=task.title,
            estimated_duration_minutes=task.estimated_duration_minutes,
            priority=task.priority,
            deadline=task.deadline,
            category=task.category
        )
        for task in unscheduled
    ]

    return CalendarResponse(
        events=events,
        unscheduled_tasks=unscheduled_tasks
    )
