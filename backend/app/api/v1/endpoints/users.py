from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate
from app.core.security import get_password_hash

router = APIRouter()


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_current_user(
        user_update: UserUpdate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """Update current user information"""
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name

    if user_update.timezone is not None:
        current_user.timezone = user_update.timezone

    if user_update.password is not None:
        current_user.hashed_password = get_password_hash(user_update.password)

    if user_update.working_hours_start is not None:
        current_user.working_hours_start = user_update.working_hours_start

    if user_update.working_hours_end is not None:
        current_user.working_hours_end = user_update.working_hours_end

    if user_update.working_days is not None:
        current_user.working_days = user_update.working_days

    if user_update.default_task_duration is not None:
        current_user.default_task_duration = user_update.default_task_duration

    db.commit()
    db.refresh(current_user)

    return current_user