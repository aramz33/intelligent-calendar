from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class HardEventBase(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    start_time: datetime
    end_time: datetime
    is_all_day: bool = False


class HardEventCreate(HardEventBase):
    calendar_source_id: Optional[int] = None
    external_id: Optional[str] = None


class HardEventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class HardEventResponse(HardEventBase):
    id: int
    user_id: int
    calendar_source_id: Optional[int] = None
    external_id: Optional[str] = None
    status: str
    is_recurring: bool
    organizer: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True