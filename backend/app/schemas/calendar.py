from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Literal


class CalendarEvent(BaseModel):
    """Represents an event or task on the calendar"""
    type: Literal["hard_event", "soft_task"]
    id: int
    title: str
    start: datetime
    end: datetime
    # Task-specific fields
    status: Optional[str] = None
    priority: Optional[int] = None
    reasoning: Optional[str] = None  # CSP placement reasoning for soft tasks
    # Event-specific fields
    location: Optional[str] = None
    is_all_day: Optional[bool] = None
    calendar_source_id: Optional[int] = None
    color: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurrence_rule: Optional[str] = None

    class Config:
        from_attributes = True


class UnscheduledTask(BaseModel):
    """Represents a task that hasn't been scheduled yet"""
    id: int
    title: str
    estimated_duration_minutes: int
    priority: int
    deadline: Optional[datetime] = None
    category: Optional[str] = None

    class Config:
        from_attributes = True


class CalendarResponse(BaseModel):
    """Response for calendar view endpoint"""
    events: List[CalendarEvent]
    unscheduled_tasks: List[UnscheduledTask]
