from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class HardEvent(Base):
    __tablename__ = "hard_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    calendar_source_id = Column(Integer, ForeignKey("calendar_sources.id", ondelete="CASCADE"))

    external_id = Column(String(255), index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    location = Column(String(500))

    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    is_all_day = Column(Boolean, default=False)

    is_recurring = Column(Boolean, default=False)
    recurrence_rule = Column(Text)

    status = Column(String(50), default="confirmed")

    organizer = Column(String(255))
    attendees = Column(JSONB, default=list)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="hard_events")
    calendar_source = relationship("CalendarSource", back_populates="hard_events")

    __table_args__ = (
        Index('idx_hard_events_user_time', 'user_id', 'start_time', 'end_time'),
    )