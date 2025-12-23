from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class CalendarSource(Base):
    __tablename__ = "calendar_sources"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(255), nullable=False)
    ical_url = Column(Text, nullable=False)
    ical_username = Column(String(255), nullable=True)
    ical_password_encrypted = Column(Text, nullable=True)

    sync_enabled = Column(Boolean, default=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    sync_frequency_minutes = Column(Integer, default=15)

    color = Column(String(7), default="#3B82F6")
    is_primary = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="calendar_sources")
    hard_events = relationship("HardEvent", back_populates="calendar_source", cascade="all, delete-orphan")