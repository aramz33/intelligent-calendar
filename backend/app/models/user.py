from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    timezone = Column(String(50), default="UTC")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    calendar_sources = relationship("CalendarSource", back_populates="user", cascade="all, delete-orphan")
    hard_events = relationship("HardEvent", back_populates="user", cascade="all, delete-orphan")
    soft_tasks = relationship("SoftTask", back_populates="user", cascade="all, delete-orphan")