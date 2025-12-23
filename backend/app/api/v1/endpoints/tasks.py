from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.models.soft_task import SoftTask
from app.schemas.soft_task import SoftTaskCreate, SoftTaskUpdate, SoftTaskResponse

router = APIRouter()


@router.post("/", response_model=SoftTaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
        task_in: SoftTaskCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Create a new task"""
    db_task = SoftTask(
        user_id=current_user.id,
        **task_in.model_dump()
    )

    db.add(db_task)
    db.commit()
    db.refresh(db_task)

    return db_task


@router.get("/", response_model=List[SoftTaskResponse])
def list_tasks(
        status: str = None,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """List all tasks for the current user"""
    query = db.query(SoftTask).filter(SoftTask.user_id == current_user.id)

    if status:
        query = query.filter(SoftTask.status == status)

    tasks = query.order_by(SoftTask.created_at.desc()).all()

    return tasks


@router.get("/{task_id}", response_model=SoftTaskResponse)
def get_task(
        task_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Get a specific task"""
    task = db.query(SoftTask).filter(
        SoftTask.id == task_id,
        SoftTask.user_id == current_user.id
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    return task


@router.patch("/{task_id}", response_model=SoftTaskResponse)
def update_task(
        task_id: int,
        task_update: SoftTaskUpdate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Update a task"""
    task = db.query(SoftTask).filter(
        SoftTask.id == task_id,
        SoftTask.user_id == current_user.id
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    update_data = task_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)

    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
        task_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Delete a task"""
    task = db.query(SoftTask).filter(
        SoftTask.id == task_id,
        SoftTask.user_id == current_user.id
    ).first()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    db.delete(task)
    db.commit()

    return None
