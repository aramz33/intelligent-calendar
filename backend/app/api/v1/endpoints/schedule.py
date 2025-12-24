from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.services.scheduler import auto_schedule_tasks

router = APIRouter()


class ScheduleRequest(BaseModel):
    """Request body for auto-scheduling tasks"""
    task_ids: List[int]
    days_ahead: int = 7  # Number of days to look ahead for scheduling


class ScheduleResponse(BaseModel):
    """Response for auto-scheduling"""
    scheduled_count: int
    failed_count: int
    scheduled_task_ids: List[int]
    failed_task_ids: List[int]
    message: str


@router.post("/auto", response_model=ScheduleResponse)
def auto_schedule(
        request: ScheduleRequest,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """
    Automatically schedule tasks based on priorities, deadlines, and available time.

    This endpoint uses a simple rule-based algorithm to find optimal time slots
    for tasks within the user's working hours.
    """
    if not request.task_ids:
        raise HTTPException(status_code=400, detail="No task IDs provided")

    # Run auto-scheduling
    scheduled, failed = auto_schedule_tasks(
        user=current_user,
        task_ids=request.task_ids,
        db=db,
        days_ahead=request.days_ahead
    )

    # Build response message
    if failed:
        message = f"Scheduled {len(scheduled)} tasks. Failed to schedule {len(failed)} tasks (not enough available time slots)."
    else:
        message = f"Successfully scheduled all {len(scheduled)} tasks!"

    return ScheduleResponse(
        scheduled_count=len(scheduled),
        failed_count=len(failed),
        scheduled_task_ids=scheduled,
        failed_task_ids=failed,
        message=message
    )
