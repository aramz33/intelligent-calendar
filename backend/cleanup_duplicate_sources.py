"""
One-time script to clean up duplicate Google Calendar sources.
Run this once after deploying the duplicate prevention fix.
"""
from app.core.database import SessionLocal
from app.models.calendar_source import CalendarSource, SourceType
from sqlalchemy import func
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def cleanup_duplicates():
    db = SessionLocal()
    try:
        # Find all users with duplicate Google Calendar sources
        duplicates = db.query(
            CalendarSource.user_id,
            CalendarSource.google_calendar_id,
            func.count(CalendarSource.id).label('count')
        ).filter(
            CalendarSource.source_type == SourceType.google_oauth
        ).group_by(
            CalendarSource.user_id,
            CalendarSource.google_calendar_id
        ).having(func.count(CalendarSource.id) > 1).all()

        logger.info(f"Found {len(duplicates)} users with duplicate Google Calendar sources")

        for user_id, google_calendar_id, count in duplicates:
            # Get all sources for this user/calendar
            sources = db.query(CalendarSource).filter(
                CalendarSource.user_id == user_id,
                CalendarSource.google_calendar_id == google_calendar_id,
                CalendarSource.source_type == SourceType.google_oauth
            ).order_by(CalendarSource.last_synced_at.desc().nullslast()).all()

            # Keep the most recently synced one
            keep = sources[0]
            delete = sources[1:]

            logger.info(f"User {user_id}: Keeping source {keep.id}, deleting {len(delete)} duplicates")

            for source in delete:
                db.delete(source)

        db.commit()
        logger.info("Cleanup complete")

    except Exception as e:
        logger.error(f"Cleanup failed: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    cleanup_duplicates()
