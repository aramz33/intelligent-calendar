from sqlalchemy import Column, Integer, String, DateTime, Time, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    timezone = Column(String(50), default="UTC")

    # Working hours and scheduling preferences
    working_hours_start = Column(Time, default="09:00:00")
    working_hours_end = Column(Time, default="17:00:00")
    working_days = Column(JSONB, default=["monday", "tuesday", "wednesday", "thursday", "friday"])
    default_task_duration = Column(Integer, default=60)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    calendar_sources = relationship("CalendarSource", back_populates="user", cascade="all, delete-orphan")
    hard_events = relationship("HardEvent", back_populates="user", cascade="all, delete-orphan")
    soft_tasks = relationship("SoftTask", back_populates="user", cascade="all, delete-orphan")