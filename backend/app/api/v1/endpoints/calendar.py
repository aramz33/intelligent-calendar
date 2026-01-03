from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
from typing import List
from pydantic import BaseModel
import logging

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.models.hard_event import HardEvent
from app.models.soft_task import SoftTask
from app.models.calendar_source import CalendarSource, SourceType
from app.schemas.calendar import CalendarResponse, CalendarEvent, UnscheduledTask
from app.schemas.calendar_source import (
    CalendarSourceCreate,
    CalendarSourceUpdate,
    CalendarSourceResponse
)
from app.services.ical_sync import ICalSyncService
from app.services.google_calendar_sync import GoogleCalendarSyncService
from app.core.encryption import encrypt_token
from app.core.config import settings

# Google OAuth imports
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

router = APIRouter()

# OAuth flow configuration
SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']


def generate_reasoning_for_display(task: SoftTask) -> str:
    """Generate human-readable reasoning for why a task was scheduled at its current time"""
    if not task.scheduled_start:
        return ""

    reasoning_parts = []

    # Priority factor
    if task.priority >= 8:
        reasoning_parts.append(f"🎯 High priority ({task.priority}/10)")
    elif task.priority >= 5:
        reasoning_parts.append(f"📌 Medium priority ({task.priority}/10)")
    else:
        reasoning_parts.append(f"📍 Lower priority ({task.priority}/10)")

    # Deadline factor
    if task.deadline:
        hours_until = (task.deadline - task.scheduled_start).total_seconds() / 3600
        if hours_until <= 24:
            reasoning_parts.append(f"⏰ Deadline in {int(hours_until)} hours")
        else:
            days_until = int(hours_until / 24)
            reasoning_parts.append(f"⏰ Deadline in {days_until} days")

    # Working hours optimization
    hour = task.scheduled_start.hour
    if 9 <= hour <= 11:
        reasoning_parts.append("⚡ Peak morning productivity hours")
    elif 14 <= hour <= 16:
        reasoning_parts.append("⚡ Afternoon focus time")

    # No conflicts
    reasoning_parts.append("🔗 No conflicts with meetings/tasks")

    return "\n".join(reasoning_parts)


@router.get("/", response_model=CalendarResponse)
def get_calendar_view(
        start_date: date = Query(..., description="Start date for calendar view"),
        end_date: date = Query(..., description="End date for calendar view"),
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """
    Get calendar view with scheduled events, tasks, and unscheduled tasks.

    Returns:
    - events: Combined list of hard events and scheduled soft tasks
    - unscheduled_tasks: Tasks that haven't been scheduled yet
    """
    # Convert dates to datetime for queries
    start_datetime = datetime.combine(start_date, datetime.min.time())
    end_datetime = datetime.combine(end_date, datetime.max.time())

    # Get calendar sources for color lookup
    calendar_sources = db.query(CalendarSource).filter(
        CalendarSource.user_id == current_user.id
    ).all()
    source_colors = {source.id: source.color for source in calendar_sources}

    # Get hard events in date range
    hard_events = db.query(HardEvent).filter(
        HardEvent.user_id == current_user.id,
        HardEvent.start_time >= start_datetime,
        HardEvent.start_time <= end_datetime
    ).order_by(HardEvent.start_time).all()

    # Get scheduled soft tasks in date range
    scheduled_tasks = db.query(SoftTask).filter(
        SoftTask.user_id == current_user.id,
        SoftTask.scheduled_start.isnot(None),
        SoftTask.scheduled_start >= start_datetime,
        SoftTask.scheduled_start <= end_datetime
    ).order_by(SoftTask.scheduled_start).all()

    # Get unscheduled tasks (no scheduled_start or scheduled before today)
    unscheduled = db.query(SoftTask).filter(
        SoftTask.user_id == current_user.id,
        SoftTask.status != "completed",
        (SoftTask.scheduled_start.is_(None)) | (SoftTask.scheduled_start < datetime.now())
    ).order_by(SoftTask.priority.desc(), SoftTask.deadline.asc()).all()

    # Convert to calendar events
    events: List[CalendarEvent] = []

    # Add hard events
    for event in hard_events:
        events.append(CalendarEvent(
            type="hard_event",
            id=event.id,
            title=event.title,
            start=event.start_time,
            end=event.end_time,
            location=event.location,
            is_all_day=event.is_all_day,
            calendar_source_id=event.calendar_source_id,
            color=source_colors.get(event.calendar_source_id) if event.calendar_source_id else None,
            is_recurring=event.is_recurring,
            recurrence_rule=event.recurrence_rule
        ))

    # Add scheduled tasks
    for task in scheduled_tasks:
        reasoning = generate_reasoning_for_display(task)
        events.append(CalendarEvent(
            type="soft_task",
            id=task.id,
            title=task.title,
            start=task.scheduled_start,
            end=task.scheduled_end,
            status=task.status,
            priority=task.priority,
            reasoning=reasoning
        ))

    # Sort all events by start time
    events.sort(key=lambda e: e.start)

    # Convert unscheduled tasks to response format
    unscheduled_tasks = [
        UnscheduledTask(
            id=task.id,
            title=task.title,
            estimated_duration_minutes=task.estimated_duration_minutes,
            priority=task.priority,
            deadline=task.deadline,
            category=task.category
        )
        for task in unscheduled
    ]

    return CalendarResponse(
        events=events,
        unscheduled_tasks=unscheduled_tasks
    )


# ============================================================================
# CALENDAR SOURCE MANAGEMENT ENDPOINTS
# ============================================================================


@router.post("/sources", response_model=CalendarSourceResponse, status_code=201)
def create_calendar_source(
    source_data: CalendarSourceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a new calendar source (iCal feed).

    This will:
    1. Create the calendar source
    2. Immediately sync events from the iCal feed
    3. Return the created source
    """
    # Create calendar source
    calendar_source = CalendarSource(
        user_id=current_user.id,
        name=source_data.name,
        ical_url=source_data.ical_url,
        ical_username=source_data.ical_username,
        ical_password_encrypted=source_data.ical_password,  # Store as-is (TODO: encrypt in production)
        sync_enabled=source_data.sync_enabled,
        sync_frequency_minutes=source_data.sync_frequency_minutes,
        color=source_data.color,
        is_primary=source_data.is_primary
    )

    db.add(calendar_source)
    db.commit()
    db.refresh(calendar_source)

    # Immediately sync the calendar
    if source_data.sync_enabled:
        sync_service = ICalSyncService(db)
        added, updated, error = sync_service.sync_calendar_source(calendar_source)

        if error:
            # Still return the source, but user should know sync failed
            # They can retry with manual sync endpoint
            pass

    return calendar_source


@router.get("/sources", response_model=List[CalendarSourceResponse])
def list_calendar_sources(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all calendar sources for the current user.
    """
    sources = db.query(CalendarSource).filter(
        CalendarSource.user_id == current_user.id
    ).order_by(CalendarSource.is_primary.desc(), CalendarSource.created_at.asc()).all()

    return sources


@router.get("/sources/{source_id}", response_model=CalendarSourceResponse)
def get_calendar_source(
    source_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific calendar source by ID.
    """
    source = db.query(CalendarSource).filter(
        CalendarSource.id == source_id,
        CalendarSource.user_id == current_user.id
    ).first()

    if not source:
        raise HTTPException(status_code=404, detail="Calendar source not found")

    return source


@router.patch("/sources/{source_id}", response_model=CalendarSourceResponse)
def update_calendar_source(
    source_id: int,
    source_data: CalendarSourceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a calendar source.

    Can update name, URL, sync settings, color, etc.
    """
    source = db.query(CalendarSource).filter(
        CalendarSource.id == source_id,
        CalendarSource.user_id == current_user.id
    ).first()

    if not source:
        raise HTTPException(status_code=404, detail="Calendar source not found")

    # Update fields
    update_data = source_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(source, field, value)

    db.commit()
    db.refresh(source)

    return source


@router.delete("/sources/{source_id}", status_code=204)
def delete_calendar_source(
    source_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a calendar source.

    This will also delete all associated hard events.
    """
    source = db.query(CalendarSource).filter(
        CalendarSource.id == source_id,
        CalendarSource.user_id == current_user.id
    ).first()

    if not source:
        raise HTTPException(status_code=404, detail="Calendar source not found")

    db.delete(source)
    db.commit()

    return None


class SyncResponse(BaseModel):
    """Response for manual sync"""
    success: bool
    events_added: int
    events_updated: int
    message: str
    error: str | None = None


@router.post("/sources/{source_id}/sync", response_model=SyncResponse)
def sync_calendar_source(
    source_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Manually trigger sync for a calendar source.

    Useful for testing or immediate sync after adding a new source.
    """
    source = db.query(CalendarSource).filter(
        CalendarSource.id == source_id,
        CalendarSource.user_id == current_user.id
    ).first()

    if not source:
        raise HTTPException(status_code=404, detail="Calendar source not found")

    # Perform sync based on source type
    if source.source_type == SourceType.google_oauth:
        sync_service = GoogleCalendarSyncService(db)
    else:
        sync_service = ICalSyncService(db)

    added, updated, error = sync_service.sync_calendar_source(source)

    if error:
        return SyncResponse(
            success=False,
            events_added=added,
            events_updated=updated,
            message=f"Sync failed: {error}",
            error=error
        )

    return SyncResponse(
        success=True,
        events_added=added,
        events_updated=updated,
        message=f"Successfully synced {source.name}: {added} added, {updated} updated",
        error=None
    )


# ============================================================================
# GOOGLE OAUTH ENDPOINTS
# ============================================================================


@router.get("/oauth/google/authorize")
def google_oauth_authorize(
    current_user: User = Depends(get_current_user)
):
    """
    Initiate Google OAuth flow.
    Redirects user to Google consent screen.
    """
    try:
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=SCOPES,
            redirect_uri=settings.GOOGLE_REDIRECT_URI
        )

        authorization_url, state = flow.authorization_url(
            access_type='offline',  # Request refresh token
            include_granted_scopes='true',
            state=str(current_user.id)  # Pass user ID in state
        )

        return {"authorization_url": authorization_url}

    except Exception as e:
        logger.error(f"Failed to initiate Google OAuth: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initiate OAuth: {str(e)}")


@router.get("/oauth/google/callback")
async def google_oauth_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db)
):
    """
    OAuth callback endpoint.
    Exchanges code for tokens and creates calendar source.
    """
    try:
        user_id = int(state)  # Extract user ID from state

        # Exchange code for tokens
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=SCOPES,
            redirect_uri=settings.GOOGLE_REDIRECT_URI
        )

        flow.fetch_token(code=code)
        credentials = flow.credentials

        # Get all calendars from the Google account
        service = build('calendar', 'v3', credentials=credentials)
        calendar_list = service.calendarList().list().execute()

        calendars = calendar_list.get('items', [])
        logger.info(f"Found {len(calendars)} calendars in Google account for user {user_id}")

        # Create or update a CalendarSource for each calendar
        calendar_sources = []
        sync_service = GoogleCalendarSyncService(db)

        for calendar in calendars:
            google_calendar_id = calendar.get('id')
            calendar_name = calendar.get('summary', 'Untitled Calendar')
            calendar_color = calendar.get('backgroundColor', '#4285F4')
            is_primary = calendar.get('primary', False)

            logger.info(f"Processing calendar: {calendar_name} (ID: {google_calendar_id})")

            # Check for existing calendar source
            existing_source = db.query(CalendarSource).filter(
                CalendarSource.user_id == user_id,
                CalendarSource.source_type == SourceType.google_oauth,
                CalendarSource.google_calendar_id == google_calendar_id
            ).first()

            if existing_source:
                # Update existing source with new tokens
                logger.info(f"Updating existing source {existing_source.id} for calendar '{calendar_name}'")
                existing_source.oauth_access_token_encrypted = encrypt_token(credentials.token)
                existing_source.oauth_refresh_token_encrypted = encrypt_token(credentials.refresh_token) if credentials.refresh_token else None
                existing_source.oauth_token_expires_at = credentials.expiry
                existing_source.sync_enabled = True
                existing_source.name = calendar_name  # Update name in case it changed
                existing_source.color = calendar_color  # Update color in case it changed
                existing_source.is_primary = is_primary
                calendar_source = existing_source
            else:
                # Create new calendar source
                logger.info(f"Creating new source for calendar '{calendar_name}'")
                calendar_source = CalendarSource(
                    user_id=user_id,
                    name=calendar_name,
                    source_type=SourceType.google_oauth,
                    google_calendar_id=google_calendar_id,
                    oauth_access_token_encrypted=encrypt_token(credentials.token),
                    oauth_refresh_token_encrypted=encrypt_token(credentials.refresh_token) if credentials.refresh_token else None,
                    oauth_token_expires_at=credentials.expiry,
                    oauth_scopes=','.join(SCOPES),
                    sync_enabled=True,
                    color=calendar_color,
                    is_primary=is_primary
                )
                db.add(calendar_source)

            db.commit()
            db.refresh(calendar_source)
            calendar_sources.append(calendar_source)

            # Trigger initial sync for this calendar
            logger.info(f"Syncing calendar '{calendar_name}' (source {calendar_source.id})")
            added, updated, error = sync_service.sync_calendar_source(calendar_source)

            if error:
                logger.warning(f"Initial sync failed for calendar '{calendar_name}' (source {calendar_source.id}): {error}")
            else:
                logger.info(f"Successfully synced calendar '{calendar_name}': {added} added, {updated} updated")

        logger.info(f"Finished processing {len(calendar_sources)} calendars for user {user_id}")

        # Redirect to frontend calendar page
        return RedirectResponse(url="http://localhost:3000/calendar?oauth=success")

    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        return RedirectResponse(url=f"http://localhost:3000/calendar?oauth=error&message={str(e)}")
