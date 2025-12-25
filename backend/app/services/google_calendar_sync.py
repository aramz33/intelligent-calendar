"""
Google Calendar Sync Service

Syncs events from Google Calendar using OAuth 2.0 authentication.
"""

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models.calendar_source import CalendarSource
from app.models.hard_event import HardEvent
from app.core.encryption import decrypt_token, encrypt_token
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class GoogleCalendarSyncService:
    """Sync Google Calendar events via OAuth"""

    def __init__(self, db: Session):
        self.db = db

    def sync_calendar_source(self, source: CalendarSource) -> tuple[int, int, str | None]:
        """
        Fetch events from Google Calendar and sync to database.

        Args:
            source: CalendarSource with Google OAuth credentials

        Returns:
            Tuple of (events_added, events_updated, error_message)
        """
        try:
            # Build credentials from stored tokens
            credentials = self._build_credentials(source)

            # Build Google Calendar API client
            service = build('calendar', 'v3', credentials=credentials)

            # Fetch events for next 60 days
            now = datetime.now(timezone.utc)
            time_min = now.replace(tzinfo=None).isoformat() + 'Z'
            time_max = (now + timedelta(days=60)).replace(tzinfo=None).isoformat() + 'Z'

            logger.info(f"Fetching Google Calendar events for source {source.id} ({source.name})")

            events_result = service.events().list(
                calendarId=source.google_calendar_id or 'primary',
                timeMin=time_min,
                timeMax=time_max,
                singleEvents=True,  # Expand recurring events
                orderBy='startTime'
            ).execute()

            events = events_result.get('items', [])
            logger.info(f"Fetched {len(events)} events from Google Calendar")

            # Sync to database
            added, updated = self._sync_events_to_db(source, events)

            # Update last sync time
            source.last_synced_at = datetime.now(timezone.utc)

            # Check if tokens were refreshed and update if needed
            if credentials.token != decrypt_token(source.oauth_access_token_encrypted):
                logger.info(f"Updating refreshed access token for source {source.id}")
                source.oauth_access_token_encrypted = encrypt_token(credentials.token)
                if credentials.expiry:
                    source.oauth_token_expires_at = credentials.expiry

            self.db.commit()

            logger.info(f"Successfully synced Google Calendar: {added} added, {updated} updated")
            return (added, updated, None)

        except HttpError as e:
            error_msg = f"Google API error: {e.reason}"
            logger.error(f"Failed to sync Google Calendar {source.id}: {error_msg}")
            return (0, 0, error_msg)
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to sync Google Calendar {source.id}: {error_msg}")
            return (0, 0, error_msg)

    def _build_credentials(self, source: CalendarSource) -> Credentials:
        """
        Build Google OAuth credentials from stored tokens.

        Args:
            source: CalendarSource with encrypted OAuth tokens

        Returns:
            Google OAuth2 Credentials object
        """
        return Credentials(
            token=decrypt_token(source.oauth_access_token_encrypted),
            refresh_token=decrypt_token(source.oauth_refresh_token_encrypted) if source.oauth_refresh_token_encrypted else None,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=source.oauth_scopes.split(',') if source.oauth_scopes else []
        )

    def _sync_events_to_db(self, source: CalendarSource, events: list) -> tuple[int, int]:
        """
        Sync Google Calendar events to HardEvent table.

        Args:
            source: CalendarSource being synced
            events: List of event dicts from Google Calendar API

        Returns:
            Tuple of (events_added, events_updated)
        """
        added = 0
        updated = 0

        for event in events:
            external_id = event['id']

            # Parse start/end times
            start = event['start'].get('dateTime', event['start'].get('date'))
            end = event['end'].get('dateTime', event['end'].get('date'))
            is_all_day = 'date' in event['start']

            # Parse times
            start_time = datetime.fromisoformat(start.replace('Z', '+00:00'))
            end_time = datetime.fromisoformat(end.replace('Z', '+00:00'))

            # Check if exists
            existing = self.db.query(HardEvent).filter(
                HardEvent.calendar_source_id == source.id,
                HardEvent.external_id == external_id
            ).first()

            if existing:
                # Update existing event
                existing.title = event.get('summary', 'Untitled')
                existing.description = event.get('description', '')
                existing.location = event.get('location', '')
                existing.start_time = start_time
                existing.end_time = end_time
                existing.is_all_day = is_all_day
                existing.status = event.get('status', 'confirmed').lower()
                existing.organizer = event.get('organizer', {}).get('email')
                existing.attendees = [a.get('email') for a in event.get('attendees', [])]
                updated += 1
            else:
                # Create new event
                hard_event = HardEvent(
                    user_id=source.user_id,
                    calendar_source_id=source.id,
                    external_id=external_id,
                    title=event.get('summary', 'Untitled'),
                    description=event.get('description', ''),
                    location=event.get('location', ''),
                    start_time=start_time,
                    end_time=end_time,
                    is_all_day=is_all_day,
                    status=event.get('status', 'confirmed').lower(),
                    organizer=event.get('organizer', {}).get('email'),
                    attendees=[a.get('email') for a in event.get('attendees', [])]
                )
                self.db.add(hard_event)
                added += 1

        self.db.commit()
        return (added, updated)

    def delete_old_events(self, source: CalendarSource, days_old: int = 90) -> int:
        """
        Delete events older than specified days for this source.

        Args:
            source: CalendarSource to clean up
            days_old: Delete events older than this many days (default: 90)

        Returns:
            Number of events deleted
        """
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)

        deleted_count = self.db.query(HardEvent).filter(
            HardEvent.calendar_source_id == source.id,
            HardEvent.end_time < cutoff_date
        ).delete()

        self.db.commit()

        logger.info(f"Deleted {deleted_count} old events from Google Calendar source {source.id}")
        return deleted_count
