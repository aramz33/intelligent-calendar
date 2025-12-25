"""
iCal Sync Service

Fetches and parses iCal feeds from external calendar sources,
syncing events to the HardEvents table.

Supports:
- Public iCal feeds (Google Calendar, Apple Calendar, etc.)
- Private feeds with authentication
- Recurring events
- Incremental updates
"""

from datetime import datetime, timedelta
from typing import List, Optional, Tuple
import logging

import requests
from icalendar import Calendar, Event
import recurring_ical_events
from sqlalchemy.orm import Session

from app.models.calendar_source import CalendarSource
from app.models.hard_event import HardEvent
from app.core.security import get_password_hash, verify_password

logger = logging.getLogger(__name__)


class ICalSyncService:
    """Service for syncing iCal calendar sources"""

    def __init__(self, db: Session):
        self.db = db

    def sync_calendar_source(self, source: CalendarSource) -> Tuple[int, int, Optional[str]]:
        """
        Fetch and sync a calendar source.

        Args:
            source: CalendarSource to sync

        Returns:
            Tuple of (events_added, events_updated, error_message)
        """
        if not source.sync_enabled:
            logger.info(f"Skipping disabled calendar source: {source.name}")
            return (0, 0, "Sync disabled")

        try:
            # Fetch iCal data
            ical_data = self._fetch_ical(source)
            if not ical_data:
                error = "Failed to fetch iCal data"
                logger.error(f"{error}: {source.name}")
                return (0, 0, error)

            # Parse iCal
            cal = Calendar.from_ical(ical_data)

            # Get events for next 60 days (configurable)
            start_date = datetime.now()
            end_date = start_date + timedelta(days=60)

            # Extract events (handles recurring events)
            events = recurring_ical_events.of(cal).between(start_date, end_date)

            # Sync to database
            added, updated = self._sync_events_to_db(source, events)

            # Update last sync time
            source.last_synced_at = datetime.utcnow()
            self.db.commit()

            logger.info(f"Synced {source.name}: {added} added, {updated} updated")
            return (added, updated, None)

        except requests.RequestException as e:
            error = f"Network error: {str(e)}"
            logger.error(f"Failed to fetch {source.name}: {error}")
            return (0, 0, error)

        except Exception as e:
            error = f"Sync error: {str(e)}"
            logger.error(f"Error syncing {source.name}: {error}")
            self.db.rollback()
            return (0, 0, error)

    def _fetch_ical(self, source: CalendarSource) -> Optional[bytes]:
        """
        Fetch iCal data from URL.

        Args:
            source: CalendarSource with URL and optional credentials

        Returns:
            iCal data as bytes, or None if failed
        """
        try:
            # Setup authentication if credentials provided
            auth = None
            if source.ical_username and source.ical_password_encrypted:
                # Note: In production, use proper encryption (Fernet) instead of hashing
                # For now, store password as-is (user provides plain text)
                auth = (source.ical_username, source.ical_password_encrypted)

            # Fetch with timeout
            response = requests.get(
                source.ical_url,
                auth=auth,
                timeout=30,
                headers={
                    'User-Agent': 'Intelligent-Calendar/1.0'
                }
            )

            response.raise_for_status()
            return response.content

        except requests.RequestException as e:
            logger.error(f"Failed to fetch iCal from {source.ical_url}: {e}")
            return None

    def _sync_events_to_db(
        self,
        source: CalendarSource,
        events: List[Event]
    ) -> Tuple[int, int]:
        """
        Sync events to database.

        Args:
            source: CalendarSource these events belong to
            events: List of iCal Event objects

        Returns:
            Tuple of (added_count, updated_count)
        """
        added = 0
        updated = 0

        for event in events:
            try:
                # Extract event data
                external_id = str(event.get('UID', ''))
                if not external_id:
                    logger.warning("Event without UID, skipping")
                    continue

                title = str(event.get('SUMMARY', 'Untitled Event'))
                description = str(event.get('DESCRIPTION', ''))
                location = str(event.get('LOCATION', ''))

                # Get start and end times
                dtstart = event.get('DTSTART')
                dtend = event.get('DTEND')

                if not dtstart:
                    logger.warning(f"Event {external_id} has no start time, skipping")
                    continue

                # Handle datetime vs date (all-day events)
                start_time = dtstart.dt
                if isinstance(start_time, datetime):
                    is_all_day = False
                else:
                    # Convert date to datetime
                    is_all_day = True
                    start_time = datetime.combine(start_time, datetime.min.time())

                if dtend:
                    end_time = dtend.dt
                    if not isinstance(end_time, datetime):
                        end_time = datetime.combine(end_time, datetime.min.time())
                else:
                    # Default to 1 hour duration if no end time
                    end_time = start_time + timedelta(hours=1)

                # Make timezone-aware if needed
                if start_time.tzinfo is None:
                    start_time = start_time.replace(tzinfo=None)
                if end_time.tzinfo is None:
                    end_time = end_time.replace(tzinfo=None)

                # Get status
                status = str(event.get('STATUS', 'CONFIRMED')).lower()

                # Get organizer
                organizer = None
                if 'ORGANIZER' in event:
                    org = event.get('ORGANIZER')
                    if org:
                        organizer = str(org)

                # Get attendees
                attendees = []
                for attendee in event.get('ATTENDEE', []):
                    if isinstance(attendee, list):
                        attendees.extend([str(a) for a in attendee])
                    else:
                        attendees.append(str(attendee))

                # Check if event already exists
                existing = self.db.query(HardEvent).filter(
                    HardEvent.calendar_source_id == source.id,
                    HardEvent.external_id == external_id
                ).first()

                if existing:
                    # Update existing event
                    existing.title = title
                    existing.description = description
                    existing.location = location
                    existing.start_time = start_time
                    existing.end_time = end_time
                    existing.is_all_day = is_all_day
                    existing.status = status
                    existing.organizer = organizer
                    existing.attendees = attendees
                    existing.updated_at = datetime.utcnow()
                    updated += 1
                else:
                    # Create new event
                    hard_event = HardEvent(
                        user_id=source.user_id,
                        calendar_source_id=source.id,
                        external_id=external_id,
                        title=title,
                        description=description,
                        location=location,
                        start_time=start_time,
                        end_time=end_time,
                        is_all_day=is_all_day,
                        status=status,
                        organizer=organizer,
                        attendees=attendees
                    )
                    self.db.add(hard_event)
                    added += 1

            except Exception as e:
                logger.error(f"Error processing event {external_id}: {e}")
                continue

        # Commit all changes
        self.db.commit()

        return (added, updated)

    def sync_all_enabled_sources(self) -> dict:
        """
        Sync all enabled calendar sources.

        Returns:
            Summary dict with sync results
        """
        sources = self.db.query(CalendarSource).filter(
            CalendarSource.sync_enabled == True
        ).all()

        results = {
            'total_sources': len(sources),
            'successful': 0,
            'failed': 0,
            'total_added': 0,
            'total_updated': 0,
            'errors': []
        }

        for source in sources:
            added, updated, error = self.sync_calendar_source(source)

            if error:
                results['failed'] += 1
                results['errors'].append({
                    'source_id': source.id,
                    'source_name': source.name,
                    'error': error
                })
            else:
                results['successful'] += 1
                results['total_added'] += added
                results['total_updated'] += updated

        return results

    def delete_old_events(self, source: CalendarSource, days_old: int = 90) -> int:
        """
        Delete events older than specified days.

        Args:
            source: CalendarSource to clean
            days_old: Delete events older than this many days

        Returns:
            Number of events deleted
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days_old)

        deleted = self.db.query(HardEvent).filter(
            HardEvent.calendar_source_id == source.id,
            HardEvent.end_time < cutoff_date
        ).delete()

        self.db.commit()

        logger.info(f"Deleted {deleted} old events from {source.name}")
        return deleted
