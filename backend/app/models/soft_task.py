from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Index, CheckConstraint, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class SoftTask(Base):
    __tablename__ = "soft_tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    title = Column(String(500), nullable=False)
    description = Column(Text)

    estimated_duration_minutes = Column(Integer, nullable=False)

    deadline = Column(DateTime(timezone=True))
    earliest_start = Column(DateTime(timezone=True))

    scheduled_start = Column(DateTime(timezone=True))
    scheduled_end = Column(DateTime(timezone=True))

    priority = Column(Integer, default=5)
    category = Column(String(100))
    energy_required = Column(String(20), default="medium")

    status = Column(String(50), default="pending")

    actual_start = Column(DateTime(timezone=True))
    actual_end = Column(DateTime(timezone=True))
    actual_duration_minutes = Column(Integer)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="soft_tasks")

    __table_args__ = (
        CheckConstraint('priority >= 1 AND priority <= 10', name='check_priority_range'),
        Index('idx_soft_tasks_user_status', 'user_id', 'status'),
        Index('idx_soft_tasks_scheduled', 'user_id', 'scheduled_start', 'scheduled_end'),
    )