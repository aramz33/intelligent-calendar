from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, func, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class SourceType(enum.Enum):
    ical = "ical"
    google_oauth = "google_oauth"


class CalendarSource(Base):
    __tablename__ = "calendar_sources"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(255), nullable=False)
    source_type = Column(SQLEnum(SourceType), nullable=False, default=SourceType.ical)

    # iCal fields
    ical_url = Column(Text, nullable=True)  # Nullable for Google OAuth sources
    ical_username = Column(String(255), nullable=True)
    ical_password_encrypted = Column(Text, nullable=True)

    # Google OAuth fields
    google_calendar_id = Column(String(255), nullable=True)  # Google's calendar ID
    oauth_access_token_encrypted = Column(Text, nullable=True)
    oauth_refresh_token_encrypted = Column(Text, nullable=True)
    oauth_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    oauth_scopes = Column(Text, nullable=True)  # Comma-separated scopes

    sync_enabled = Column(Boolean, default=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    sync_frequency_minutes = Column(Integer, default=15)

    color = Column(String(7), default="#3B82F6")
    is_primary = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="calendar_sources")
    hard_events = relationship("HardEvent", back_populates="calendar_source", cascade="all, delete-orphan")