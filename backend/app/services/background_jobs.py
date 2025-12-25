"""
Background Jobs Scheduler

Manages periodic background tasks using APScheduler:
- iCal calendar sync (every 15 minutes)
- Old event cleanup (daily)
- Future: ML model training, notification sending, etc.
"""

import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

from app.core.database import SessionLocal
from app.services.ical_sync import ICalSyncService
from app.services.google_calendar_sync import GoogleCalendarSyncService
from app.models.calendar_source import CalendarSource, SourceType

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = BackgroundScheduler()


def sync_all_calendars():
    """
    Background job: Sync all enabled calendar sources (iCal and Google OAuth).

    Runs every 15 minutes (configurable per source).
    """
    logger.info("Starting background calendar sync...")

    db = SessionLocal()
    try:
        # Get all enabled calendar sources
        sources = db.query(CalendarSource).filter(
            CalendarSource.sync_enabled == True
        ).all()

        total_added = 0
        total_updated = 0
        successful = 0
        failed = 0
        errors = []

        for source in sources:
            try:
                # Dispatch to correct sync service based on source type
                if source.source_type == SourceType.ical:
                    sync_service = ICalSyncService(db)
                    added, updated, error = sync_service.sync_calendar_source(source)
                elif source.source_type == SourceType.google_oauth:
                    sync_service = GoogleCalendarSyncService(db)
                    added, updated, error = sync_service.sync_calendar_source(source)
                else:
                    logger.warning(f"Unknown source type {source.source_type} for source {source.id}")
                    continue

                if error:
                    failed += 1
                    errors.append({
                        'source_id': source.id,
                        'source_name': source.name,
                        'error': error
                    })
                else:
                    successful += 1
                    total_added += added
                    total_updated += updated

            except Exception as e:
                failed += 1
                error_msg = str(e)
                logger.error(f"Failed to sync source {source.id} ({source.name}): {error_msg}")
                errors.append({
                    'source_id': source.id,
                    'source_name': source.name,
                    'error': error_msg
                })

        logger.info(
            f"Calendar sync complete: {successful} successful, "
            f"{failed} failed, "
            f"{total_added} added, "
            f"{total_updated} updated"
        )

        if errors:
            for error in errors:
                logger.error(
                    f"Failed to sync {error['source_name']} "
                    f"(ID: {error['source_id']}): {error['error']}"
                )

    except Exception as e:
        logger.error(f"Error in background calendar sync: {e}")
    finally:
        db.close()


def cleanup_old_events():
    """
    Background job: Delete events older than 90 days.

    Runs daily at 3 AM.
    """
    logger.info("Starting old event cleanup...")

    db = SessionLocal()
    try:
        from app.models.calendar_source import CalendarSource

        sync_service = ICalSyncService(db)

        # Get all calendar sources
        sources = db.query(CalendarSource).all()

        total_deleted = 0
        for source in sources:
            deleted = sync_service.delete_old_events(source, days_old=90)
            total_deleted += deleted

        logger.info(f"Old event cleanup complete: {total_deleted} events deleted")

    except Exception as e:
        logger.error(f"Error in old event cleanup: {e}")
    finally:
        db.close()


def init_scheduler():
    """
    Initialize and start the background scheduler.

    Call this on app startup.
    """
    logger.info("Initializing background job scheduler...")

    # Job 1: Sync calendars every 15 minutes
    scheduler.add_job(
        func=sync_all_calendars,
        trigger=IntervalTrigger(minutes=15),
        id='sync_calendars',
        name='Sync external calendars',
        replace_existing=True,
        max_instances=1  # Prevent overlapping runs
    )

    # Job 2: Cleanup old events daily at 3 AM
    scheduler.add_job(
        func=cleanup_old_events,
        trigger=CronTrigger(hour=3, minute=0),
        id='cleanup_old_events',
        name='Cleanup old events',
        replace_existing=True,
        max_instances=1
    )

    # Future jobs (commented out, implement in later phases):

    # # Job 3: Train ML models every 6 hours
    # scheduler.add_job(
    #     func=train_ml_models,
    #     trigger=IntervalTrigger(hours=6),
    #     id='train_ml_models',
    #     name='Train ML models',
    #     replace_existing=True,
    #     max_instances=1
    # )

    # # Job 4: Send daily schedule summary at 8 AM
    # scheduler.add_job(
    #     func=send_daily_summaries,
    #     trigger=CronTrigger(hour=8, minute=0),
    #     id='daily_summary',
    #     name='Send daily summaries',
    #     replace_existing=True,
    #     max_instances=1
    # )

    # Start the scheduler
    scheduler.start()
    logger.info("Background scheduler started successfully")

    # Log scheduled jobs
    jobs = scheduler.get_jobs()
    logger.info(f"Scheduled jobs: {[job.name for job in jobs]}")


def shutdown_scheduler():
    """
    Gracefully shutdown the scheduler.

    Call this on app shutdown.
    """
    logger.info("Shutting down background scheduler...")
    scheduler.shutdown(wait=True)
    logger.info("Background scheduler stopped")


# Future background jobs (to be implemented in later phases):

def train_ml_models():
    """
    Background job: Train ML models for users with new completion data.

    Finds users with 10+ new completed tasks since last training
    and retrains their velocity prediction models.
    """
    logger.info("Starting ML model training...")

    db = SessionLocal()
    try:
        # TODO: Implement in Phase 2
        # from app.services.habit_predictor import HabitPredictor
        # from app.models.user import User
        # from app.models.soft_task import SoftTask

        # # Find users who need model retraining
        # users = db.query(User).all()

        # for user in users:
        #     # Check if user has enough new completions
        #     completed_count = db.query(SoftTask).filter(
        #         SoftTask.user_id == user.id,
        #         SoftTask.status == "completed",
        #         SoftTask.actual_duration_minutes.isnot(None)
        #     ).count()
        #
        #     if completed_count >= 10:
        #         predictor = HabitPredictor(user, db)
        #         predictor.train_model()
        #         logger.info(f"Trained model for user {user.id}")

        logger.info("ML model training complete")

    except Exception as e:
        logger.error(f"Error in ML model training: {e}")
    finally:
        db.close()


def send_daily_summaries():
    """
    Background job: Send daily schedule summaries to users.

    Sends email/notification with today's schedule and tasks.
    """
    logger.info("Starting daily summary sending...")

    db = SessionLocal()
    try:
        # TODO: Implement notification system
        # from app.models.user import User
        # from app.services.notification import NotificationService

        # users = db.query(User).all()

        # for user in users:
        #     # Generate daily summary
        #     # Send via email or push notification
        #     pass

        logger.info("Daily summaries sent")

    except Exception as e:
        logger.error(f"Error sending daily summaries: {e}")
    finally:
        db.close()
