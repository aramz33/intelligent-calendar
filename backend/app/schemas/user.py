from pydantic import BaseModel, EmailStr
from datetime import datetime, time
from typing import Optional, List


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    timezone: str = "UTC"


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    timezone: Optional[str] = None
    password: Optional[str] = None
    working_hours_start: Optional[time] = None
    working_hours_end: Optional[time] = None
    working_days: Optional[List[str]] = None
    default_task_duration: Optional[int] = None


class UserResponse(UserBase):
    id: int
    working_hours_start: time
    working_hours_end: time
    working_days: List[str]
    default_task_duration: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None