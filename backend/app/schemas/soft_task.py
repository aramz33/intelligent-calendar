from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class SoftTaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    estimated_duration_minutes: int = Field(gt=0)
    deadline: Optional[datetime] = None
    priority: int = Field(default=5, ge=1, le=10)
    category: Optional[str] = None
    energy_required: str = "medium"


class SoftTaskCreate(SoftTaskBase):
    earliest_start: Optional[datetime] = None


class SoftTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    estimated_duration_minutes: Optional[int] = Field(default=None, gt=0)
    deadline: Optional[datetime] = None
    priority: Optional[int] = Field(default=None, ge=1, le=10)
    category: Optional[str] = None
    energy_required: Optional[str] = None
    status: Optional[str] = None


class SoftTaskResponse(SoftTaskBase):
    id: int
    user_id: int
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    status: str
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    actual_duration_minutes: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True