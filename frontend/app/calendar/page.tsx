'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, calendar, scheduling as schedulingAPI, Task, CalendarEvent, CalendarSource } from '@/lib/api';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, formatDistanceToNow } from 'date-fns';
import DraggableCalendar from '@/components/DraggableCalendar';
import ThemeToggle from '@/components/ThemeToggle';

export default function CalendarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [unscheduledTasks, setUnscheduledTasks] = useState<Task[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [workingHours, setWorkingHours] = useState({ start: '09:00:00', end: '17:00:00' });
  const [scheduling, setScheduling] = useState(false);
  const [useCSP, setUseCSP] = useState(true);
  const [rippleChanges, setRippleChanges] = useState<Array<{
    task_id: number;
    old_start: string;
    new_start: string;
  }>>([]);
  const [movingTask, setMovingTask] = useState(false);
  const [calendarSources, setCalendarSources] = useState<CalendarSource[]>([]);
  const [visibleSourceIds, setVisibleSourceIds] = useState<Set<number>>(new Set());
  const [showSourcesMenu, setShowSourcesMenu] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showICalForm, setShowICalForm] = useState(false);
  const [icalForm, setICalForm] = useState({
    name: '',
    ical_url: '',
    ical_username: '',
    ical_password: '',
    color: '#3B82F6',
  });

  useEffect(() => {
    loadCalendarData();
    loadCalendarSources();
  }, [currentDate]);

  // Auto-refresh calendar data every 5 minutes
  useEffect(() => {
    const intervalId = setInterval(() => {
      loadCalendarData();
      loadCalendarSources();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    // Check for OAuth callback
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get('oauth');

    if (oauthStatus === 'success') {
      alert('Google Calendar connected successfully!');
      loadCalendarData();
      loadCalendarSources();

      // Clean up URL
      window.history.replaceState({}, '', '/calendar');
    } else if (oauthStatus === 'error') {
      const message = params.get('message') || 'Unknown error';
      alert(`Failed to connect Google Calendar: ${message}`);

      window.history.replaceState({}, '', '/calendar');
    }
  }, []);

  const loadCalendarSources = async () => {
    try {
      const sources = await calendar.getSources();
      setCalendarSources(sources);

      // Initially all sources visible
      setVisibleSourceIds(new Set(sources.map(s => s.id)));
    } catch (err) {
      console.error('Failed to load calendar sources:', err);
    }
  };

  const loadCalendarData = async () => {
    try {
      if (!auth.isAuthenticated()) {
        router.push('/');
        return;
      }

      // Get user info for working hours
      const user = await auth.getCurrentUser();
      setWorkingHours({
        start: user.working_hours_start,
        end: user.working_hours_end
      });

      // Get calendar data for the current week
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

      const calendarData = await calendar.getView(
        format(weekStart, 'yyyy-MM-dd'),
        format(weekEnd, 'yyyy-MM-dd')
      );

      setEvents(calendarData.events);
      setUnscheduledTasks(calendarData.unscheduled_tasks);
    } catch (err: any) {
      console.error('Failed to load calendar:', err);
      if (err.response?.status === 401) {
        auth.logout();
        router.push('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAutoSchedule = async () => {
    if (unscheduledTasks.length === 0) {
      alert('No unscheduled tasks to schedule!');
      return;
    }

    setScheduling(true);
    try {
      const taskIds = unscheduledTasks.map(t => t.id);

      // Use CSP or simple scheduler based on toggle
      const result = useCSP
        ? await schedulingAPI.scheduleWithCSP(taskIds, 7)
        : await schedulingAPI.autoSchedule(taskIds, 7);

      alert(result.message);

      // Reload calendar data
      await loadCalendarData();
    } catch (err: any) {
      console.error('Auto-scheduling failed:', err);
      alert('Failed to auto-schedule tasks. Please try again.');
    } finally {
      setScheduling(false);
    }
  };

  const handleEventMove = async (eventId: number, eventType: string, newStart: Date, newEnd: Date) => {
    setMovingTask(true);
    try {
      // Call ripple effect API
      const result = await schedulingAPI.moveTaskWithRipple(eventId, newStart, newEnd);

      // Show ripple changes
      setRippleChanges(result.changes);

      // Show success message
      alert(result.message);

      // Clear ripple animation after 2 seconds
      setTimeout(() => setRippleChanges([]), 2000);

      // Reload calendar to show updated positions
      await loadCalendarData();
    } catch (err: any) {
      console.error('Failed to move task:', err);
      const errorMessage = err.response?.data?.detail || 'Failed to reschedule task. Please try again.';
      alert(errorMessage);
    } finally {
      setMovingTask(false);
    }
  };

  const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleConnectGoogle = async () => {
    try {
      // Get authorization URL from backend
      const response = await calendar.initiateGoogleOAuth();

      // Redirect to Google consent screen
      window.location.href = response.authorization_url;
    } catch (err) {
      console.error('Failed to initiate Google OAuth:', err);
      alert('Failed to connect Google Calendar');
    }
  };

  const handleSyncNow = async () => {
    const googleSources = calendarSources.filter(s => s.source_type === 'google_oauth');
    if (googleSources.length === 0) return;

    setSyncing(true);
    try {
      // Sync all Google calendars
      await Promise.all(googleSources.map(source => calendar.syncSource(source.id)));
      await loadCalendarData();
      await loadCalendarSources();
    } catch (err) {
      console.error('Failed to sync calendar:', err);
      alert('Failed to sync calendar');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddICalSource = async () => {
    if (!icalForm.name || !icalForm.ical_url) {
      alert('Please provide a name and iCal URL');
      return;
    }

    try {
      const data: any = {
        name: icalForm.name,
        ical_url: icalForm.ical_url,
        sync_enabled: true,
        color: icalForm.color,
      };

      // Only include credentials if provided
      if (icalForm.ical_username) {
        data.ical_username = icalForm.ical_username;
      }
      if (icalForm.ical_password) {
        data.ical_password = icalForm.ical_password;
      }

      await calendar.createICalSource(data);

      // Reset form and close
      setICalForm({
        name: '',
        ical_url: '',
        ical_username: '',
        ical_password: '',
        color: '#3B82F6',
      });
      setShowICalForm(false);

      // Reload calendars
      await loadCalendarSources();
      await loadEvents();
    } catch (err) {
      console.error('Failed to add iCal source:', err);
      alert('Failed to add iCal calendar. Please check the URL and try again.');
    }
  };

  const handleLogout = () => {
    auth.logout();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="flex items-center justify-center w-10 h-10 bg-indigo-600 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Intelligent Calendar
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {format(currentDate, 'MMMM yyyy')}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <ThemeToggle />
              {(() => {
                // Check if user has any Google OAuth sources
                const hasGoogleCalendar = calendarSources.some(s => s.source_type === 'google_oauth');
                const googleSources = calendarSources.filter(s => s.source_type === 'google_oauth');

                if (hasGoogleCalendar) {
                  return (
                    <div className="flex items-center space-x-2">
                      {/* Connected status badge */}
                      <div className="px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center space-x-2">
                        <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-green-700 dark:text-green-300">
                            Connected ({googleSources.length} {googleSources.length === 1 ? 'calendar' : 'calendars'})
                          </span>
                          {(() => {
                            const mostRecentSync = googleSources
                              .filter(s => s.last_synced_at)
                              .sort((a, b) => new Date(b.last_synced_at!).getTime() - new Date(a.last_synced_at!).getTime())[0];
                            return mostRecentSync?.last_synced_at ? (
                              <span className="text-xs text-green-600 dark:text-green-400">
                                {formatDistanceToNow(new Date(mostRecentSync.last_synced_at), { addSuffix: true })}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>

                      {/* Sync now button */}
                      <button
                        onClick={handleSyncNow}
                        disabled={syncing}
                        className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
                      </button>

                      {/* Disconnect button */}
                      <button
                        onClick={async () => {
                          if (confirm(`Are you sure you want to disconnect all ${googleSources.length} Google ${googleSources.length === 1 ? 'calendar' : 'calendars'}? This will remove all synced events.`)) {
                            try {
                              // Delete all Google calendar sources
                              await Promise.all(googleSources.map(source => calendar.deleteSource(source.id)));
                              await loadCalendarSources();
                              await loadEvents();
                            } catch (err) {
                              console.error('Failed to disconnect:', err);
                              // Ignore the error if it's just a JSON parsing issue from 204 response
                              if (err instanceof Error && !err.message.includes('JSON')) {
                                alert('Failed to disconnect Google Calendar');
                              } else {
                                // Still reload to reflect the changes
                                await loadCalendarSources();
                                await loadEvents();
                              }
                            }
                          }
                        }}
                        className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Disconnect</span>
                      </button>
                    </div>
                  );
                } else {
                  return (
                    <button
                      onClick={handleConnectGoogle}
                      className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span>Connect Google Calendar</span>
                    </button>
                  );
                }
              })()}

              {/* Add iCal Calendar button */}
              <button
                onClick={() => setShowICalForm(true)}
                className="px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add iCal Calendar</span>
              </button>

              {calendarSources.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowSourcesMenu(!showSourcesMenu)}
                    className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    Calendars ({visibleSourceIds.size}/{calendarSources.length})
                  </button>

                  {showSourcesMenu && (
                    <div className="absolute top-12 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3 z-50 min-w-[200px]">
                      {calendarSources.map(source => (
                        <label key={source.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleSourceIds.has(source.id)}
                            onChange={(e) => {
                              const newSet = new Set(visibleSourceIds);
                              if (e.target.checked) {
                                newSet.add(source.id);
                              } else {
                                newSet.delete(source.id);
                              }
                              setVisibleSourceIds(newSet);
                            }}
                            className="rounded"
                          />
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: source.color }}
                          />
                          <span className="text-sm text-gray-900 dark:text-white">{source.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                Tasks
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Controls */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevWeek}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleToday}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Today
            </button>
            <button
              onClick={handleNextWeek}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="flex items-center space-x-4">
            {unscheduledTasks.length > 0 && (
              <>
                {/* CSP Toggle */}
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">
                    Use CSP Solver:
                  </label>
                  <button
                    onClick={() => setUseCSP(!useCSP)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      useCSP ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        useCSP ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <button
                  onClick={handleAutoSchedule}
                  disabled={scheduling}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {scheduling ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Scheduling...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>{useCSP ? 'CSP Schedule' : 'Auto-Schedule'} {unscheduledTasks.length} Tasks</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Calendar */}
        <DraggableCalendar
          events={events.filter(event => {
            // Always show soft tasks
            if (event.type === 'soft_task') return true;
            // Filter hard events by visible sources
            if (event.type === 'hard_event' && event.calendar_source_id) {
              return visibleSourceIds.has(event.calendar_source_id);
            }
            return true;
          })}
          currentDate={currentDate}
          workingHoursStart={workingHours.start}
          workingHoursEnd={workingHours.end}
          onEventMove={handleEventMove}
          rippleChanges={rippleChanges}
        />

        {/* Moving task indicator */}
        {movingTask && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-blue-700 dark:text-blue-300">
                Rescheduling task...
              </span>
            </div>
          </div>
        )}

        {/* Unscheduled Tasks Sidebar */}
        {unscheduledTasks.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Unscheduled Tasks ({unscheduledTasks.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {unscheduledTasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                >
                  <h3 className="font-medium text-gray-900 dark:text-white">{task.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                      {task.estimated_duration_minutes} min
                    </span>
                    <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded">
                      Priority: {task.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* iCal Form Modal */}
        {showICalForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Add iCal Calendar
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Calendar Name *
                  </label>
                  <input
                    type="text"
                    value={icalForm.name}
                    onChange={(e) => setICalForm({ ...icalForm, name: e.target.value })}
                    placeholder="My Calendar"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    iCal URL *
                  </label>
                  <input
                    type="url"
                    value={icalForm.ical_url}
                    onChange={(e) => setICalForm({ ...icalForm, ical_url: e.target.value })}
                    placeholder="https://example.com/calendar.ics"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    The URL to your iCal feed (.ics file)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Color
                  </label>
                  <input
                    type="color"
                    value={icalForm.color}
                    onChange={(e) => setICalForm({ ...icalForm, color: e.target.value })}
                    className="w-full h-10 border border-gray-300 dark:border-gray-600 rounded-lg"
                  />
                </div>

                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-700 dark:text-gray-300 font-medium">
                    Authentication (Optional)
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        value={icalForm.ical_username}
                        onChange={(e) => setICalForm({ ...icalForm, ical_username: e.target.value })}
                        placeholder="username"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        value={icalForm.ical_password}
                        onChange={(e) => setICalForm({ ...icalForm, ical_password: e.target.value })}
                        placeholder="password"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                </details>
              </div>

              <div className="mt-6 flex space-x-3">
                <button
                  onClick={handleAddICalSource}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  Add Calendar
                </button>
                <button
                  onClick={() => {
                    setShowICalForm(false);
                    setICalForm({
                      name: '',
                      ical_url: '',
                      ical_username: '',
                      ical_password: '',
                      color: '#3B82F6',
                    });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
