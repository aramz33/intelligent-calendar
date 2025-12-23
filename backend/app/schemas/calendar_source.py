from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class CalendarSourceBase(BaseModel):
    name: str
    ical_url: str
    sync_enabled: bool = True
    sync_frequency_minutes: int = 15
    color: str = "#3B82F6"
    is_primary: bool = False


class CalendarSourceCreate(CalendarSourceBase):
    ical_username: Optional[str] = None
    ical_password: Optional[str] = None


class CalendarSourceUpdate(BaseModel):
    name: Optional[str] = None
    ical_url: Optional[str] = None
    sync_enabled: Optional[bool] = None
    sync_frequency_minutes: Optional[int] = None
    color: Optional[str] = None
    is_primary: Optional[bool] = None


class CalendarSourceResponse(CalendarSourceBase):
    id: int
    user_id: int
    last_synced_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True