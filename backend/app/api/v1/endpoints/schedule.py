from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict
from datetime import datetime

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.models.soft_task import SoftTask
from app.services.scheduler import auto_schedule_tasks
from app.services.csp_scheduler import CSPScheduler
from app.services.ripple_scheduler import RippleScheduler

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


class CSPScheduleResponse(BaseModel):
    """Response for CSP-based scheduling"""
    scheduled_count: int
    failed_count: int
    scheduled_task_ids: List[int]
    failed_task_ids: List[int]
    schedule: Dict[int, Dict[str, str]]  # task_id -> {start, end, reasoning}
    message: str
    solver_status: str


@router.post("/csp", response_model=CSPScheduleResponse)
def schedule_with_csp(
    request: ScheduleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Schedule tasks using Constraint Satisfaction Problem (CSP) solver with OR-Tools.

    This is the intelligent scheduler that globally optimizes task placement:
    - Respects working hours and deadlines
    - Prevents task overlaps
    - Optimizes by priority (high-priority tasks scheduled earlier)
    - Handles 50+ tasks efficiently
    - Considers buffer time between tasks

    More powerful than the simple rule-based /auto endpoint.
    """
    if not request.task_ids:
        raise HTTPException(status_code=400, detail="No task IDs provided")

    # Get tasks to schedule
    tasks = db.query(SoftTask).filter(
        SoftTask.id.in_(request.task_ids),
        SoftTask.user_id == current_user.id
    ).all()

    if not tasks:
        raise HTTPException(status_code=404, detail="No tasks found with provided IDs")

    # Create CSP scheduler and solve
    scheduler = CSPScheduler(user=current_user, db=db)
    schedule = scheduler.schedule_tasks(tasks, request.days_ahead)

    # Apply schedule to database
    scheduled_ids = []
    failed_ids = []

    for task in tasks:
        if task.id in schedule:
            start_time, end_time, reasoning = schedule[task.id]
            task.scheduled_start = start_time
            task.scheduled_end = end_time
            scheduled_ids.append(task.id)
        else:
            failed_ids.append(task.id)

    db.commit()

    # Format schedule for response
    schedule_formatted = {
        task_id: {
            "start": start.isoformat(),
            "end": end.isoformat(),
            "reasoning": reasoning
        }
        for task_id, (start, end, reasoning) in schedule.items()
    }

    # Build response message
    if failed_ids:
        message = f"CSP solver scheduled {len(scheduled_ids)} tasks. Could not schedule {len(failed_ids)} tasks (no valid solution found - check deadlines and available time)."
    else:
        message = f"CSP solver successfully scheduled all {len(scheduled_ids)} tasks with global optimization!"

    return CSPScheduleResponse(
        scheduled_count=len(scheduled_ids),
        failed_count=len(failed_ids),
        scheduled_task_ids=scheduled_ids,
        failed_task_ids=failed_ids,
        schedule=schedule_formatted,
        message=message,
        solver_status="OPTIMAL" if len(scheduled_ids) == len(tasks) else "PARTIAL"
    )


class TaskMoveRequest(BaseModel):
    """Request body for moving a task with ripple effect"""
    task_id: int
    new_start: datetime
    new_end: datetime


class TaskMoveChange(BaseModel):
    """A single task change from ripple effect"""
    task_id: int
    old_start: str | None
    new_start: str


class RippleResponse(BaseModel):
    """Response for task move with ripple effect"""
    success: bool
    changes: List[TaskMoveChange]
    message: str


@router.post("/move-task", response_model=RippleResponse)
def move_task_with_ripple(
    request: TaskMoveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Move a task and handle ripple effect (cascading rescheduling).

    When you drag a task to a new time slot, this endpoint:
    1. Moves the task to the new position
    2. Finds all tasks that now conflict (overlap)
    3. Automatically reschedules conflicting tasks to next available slots
    4. Returns all changes made

    This creates the "ripple effect" - moving one task intelligently
    pushes other tasks forward to maintain a valid schedule.

    Used by the drag-and-drop calendar UI.
    """
    # Get the task
    task = db.query(SoftTask).filter(
        SoftTask.id == request.task_id,
        SoftTask.user_id == current_user.id
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Create ripple scheduler
    ripple = RippleScheduler(user=current_user, db=db)

    try:
        # Handle the move with ripple effect
        changes = ripple.handle_task_move(
            moved_task=task,
            new_start=request.new_start,
            new_end=request.new_end
        )

        # Format changes for response
        change_list = [
            TaskMoveChange(
                task_id=change["task_id"],
                old_start=change["old_start"],
                new_start=change["new_start"]
            )
            for change in changes
        ]

        # Build message
        if len(changes) == 1:
            message = "Task moved successfully!"
        else:
            affected_count = len(changes) - 1  # Exclude the moved task itself
            message = f"Task moved and {affected_count} conflicting task(s) automatically rescheduled!"

        return RippleResponse(
            success=True,
            changes=change_list,
            message=message
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to move task: {str(e)}"
        )
