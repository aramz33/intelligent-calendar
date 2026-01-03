'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, calendar, scheduling as schedulingAPI, CalendarEvent, CalendarSource } from '@/lib/api';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, addMonths, subMonths, addYears, subYears, addDays, subDays } from 'date-fns';
import LeftSidebar from '@/components/LeftSidebar';
import ViewSwitcher, { CalendarView } from '@/components/ViewSwitcher';
import DayView from '@/components/DayView';
import WeekView from '@/components/WeekView';
import MonthView from '@/components/MonthView';
import YearView from '@/components/YearView';
import ThemeToggle from '@/components/ThemeToggle';
import TaskModal from '@/components/TaskModal';
import UserMenu from '@/components/UserMenu';

export default function CalendarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [workingHours, setWorkingHours] = useState({ start: '09:00:00', end: '17:00:00' });
  const [calendarSources, setCalendarSources] = useState<CalendarSource[]>([]);
  const [visibleSourceIds, setVisibleSourceIds] = useState<Set<number>>(new Set());
  const [currentView, setCurrentView] = useState<CalendarView>('week');
  const [showTaskModal, setShowTaskModal] = useState(false);
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
    }, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  // Listen for OAuth popup messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'oauth-success') {
        alert('Google Calendar connected successfully!');
        loadCalendarData();
        loadCalendarSources();
      } else if (event.data.type === 'oauth-error') {
        const message = event.data.message || 'Unknown error';
        alert(`Failed to connect Google Calendar: ${message}`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    // Check for OAuth callback
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get('oauth');

    if (oauthStatus === 'success') {
      // If this is a popup window (opened by window.open), notify parent and close
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'oauth-success' }, window.location.origin);
        window.close();
      } else {
        // Fallback for direct navigation
        alert('Google Calendar connected successfully!');
        loadCalendarData();
        loadCalendarSources();
        window.history.replaceState({}, '', '/calendar');
      }
    } else if (oauthStatus === 'error') {
      const message = params.get('message') || 'Unknown error';
      // If this is a popup window, notify parent and close
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'oauth-error', message }, window.location.origin);
        window.close();
      } else {
        // Fallback for direct navigation
        alert(`Failed to connect Google Calendar: ${message}`);
        window.history.replaceState({}, '', '/calendar');
      }
    }
  }, []);

  const loadCalendarSources = async () => {
    try {
      const sources = await calendar.getSources();
      setCalendarSources(sources);
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

      const user = await auth.getCurrentUser();
      setWorkingHours({
        start: user.working_hours_start,
        end: user.working_hours_end
      });

      // Load data based on current view
      let startDate, endDate;

      if (currentView === 'day') {
        startDate = currentDate;
        endDate = currentDate;
      } else if (currentView === 'week') {
        startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
        endDate = endOfWeek(currentDate, { weekStartsOn: 1 });
      } else if (currentView === 'month') {
        startDate = startOfWeek(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), { weekStartsOn: 0 });
        endDate = endOfWeek(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0), { weekStartsOn: 0 });
      } else {
        // Year view - load full year
        startDate = new Date(currentDate.getFullYear(), 0, 1);
        endDate = new Date(currentDate.getFullYear(), 11, 31);
      }

      const calendarData = await calendar.getView(
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd')
      );

      setEvents(calendarData.events);
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

  const handleCalendarReload = async () => {
    await loadCalendarData();
  };

  const handleEventMove = async (eventId: number, eventType: string, newStart: Date, newEnd: Date) => {
    try {
      const result = await schedulingAPI.moveTaskWithRipple(eventId, newStart, newEnd);
      alert(result.message);
      await loadCalendarData();
    } catch (err: any) {
      console.error('Failed to move task:', err);
      const errorDetail = err.response?.data?.detail;
      if (errorDetail) {
        alert(`Failed to reschedule: ${errorDetail}`);
      } else if (err.message) {
        alert(`Failed to reschedule: ${err.message}`);
      } else {
        alert('Failed to reschedule task. Please try again.');
      }
    }
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setCurrentDate(date);
    if (currentView !== 'day') {
      setCurrentView('day');
    }
  };

  const handleToggleSource = (sourceId: number) => {
    const newSet = new Set(visibleSourceIds);
    if (newSet.has(sourceId)) {
      newSet.delete(sourceId);
    } else {
      newSet.add(sourceId);
    }
    setVisibleSourceIds(newSet);
  };

  const handlePrev = () => {
    if (currentView === 'day') setCurrentDate(subDays(currentDate, 1));
    else if (currentView === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else if (currentView === 'month') setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(subYears(currentDate, 1));
  };

  const handleNext = () => {
    if (currentView === 'day') setCurrentDate(addDays(currentDate, 1));
    else if (currentView === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else if (currentView === 'month') setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addYears(currentDate, 1));
  };

  const handleToday = () => setCurrentDate(new Date());

  const handleConnectGoogle = async () => {
    try {
      const response = await calendar.initiateGoogleOAuth();
      window.open(response.authorization_url, '_blank', 'width=600,height=700,scrollbars=yes');
    } catch (err) {
      console.error('Failed to initiate Google OAuth:', err);
      alert('Failed to connect Google Calendar');
    }
  };

  const handleAddICal = () => {
    setShowICalForm(true);
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

      if (icalForm.ical_username) {
        data.ical_username = icalForm.ical_username;
      }
      if (icalForm.ical_password) {
        data.ical_password = icalForm.ical_password;
      }

      await calendar.createICalSource(data);

      setICalForm({
        name: '',
        ical_url: '',
        ical_username: '',
        ical_password: '',
        color: '#3B82F6',
      });
      setShowICalForm(false);

      await loadCalendarSources();
      await loadCalendarData();
    } catch (err) {
      console.error('Failed to add iCal source:', err);
      alert('Failed to add iCal calendar. Please check the URL and try again.');
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading calendar...</p>
        </div>
      </div>
    );
  }

  // Filter visible events
  const visibleEvents = events.filter(event => {
    if (event.type === 'soft_task') return true;
    if (event.type === 'hard_event' && event.calendar_source_id) {
      return visibleSourceIds.has(event.calendar_source_id);
    }
    return true;
  });

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="px-6 py-3">
          <div className="flex justify-between items-center">
            {/* Left: Logo and navigation controls */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Calendar
                </h1>
              </div>

              {/* Navigation controls */}
              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={handlePrev}
                  className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={handleToday}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
                >
                  Today
                </button>
                <button
                  onClick={handleNext}
                  className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Current date display */}
              <div className="text-lg font-semibold text-gray-900 dark:text-white ml-2">
                {currentView === 'day' && format(currentDate, 'MMMM d, yyyy')}
                {currentView === 'week' && format(currentDate, 'MMMM yyyy')}
                {currentView === 'month' && format(currentDate, 'MMMM yyyy')}
                {currentView === 'year' && format(currentDate, 'yyyy')}
              </div>
            </div>

            {/* Center: View switcher */}
            <div>
              <ViewSwitcher currentView={currentView} onViewChange={setCurrentView} />
            </div>

            {/* Right: Actions */}
            <div className="flex items-center space-x-2">
              <ThemeToggle />
              <UserMenu onOpenTasks={() => setShowTaskModal(true)} />
            </div>
          </div>
        </div>
      </header>

      {/* Main 3-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <LeftSidebar
          calendarSources={calendarSources}
          visibleSourceIds={visibleSourceIds}
          onToggleSource={handleToggleSource}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          onConnectGoogle={handleConnectGoogle}
          onAddICal={handleAddICal}
        />

        {/* Center Canvas */}
        <div className="flex-1 overflow-auto p-6">
          {currentView === 'day' && (
            <DayView
              events={visibleEvents}
              currentDate={currentDate}
              workingHoursStart={workingHours.start}
              workingHoursEnd={workingHours.end}
              onEventMove={handleEventMove}
              onCalendarReload={handleCalendarReload}
            />
          )}
          {currentView === 'week' && (
            <WeekView
              events={visibleEvents}
              currentDate={currentDate}
              workingHoursStart={workingHours.start}
              workingHoursEnd={workingHours.end}
              onEventMove={handleEventMove}
              onCalendarReload={handleCalendarReload}
            />
          )}
          {currentView === 'month' && (
            <MonthView
              events={visibleEvents}
              currentDate={currentDate}
              onDateSelect={handleDateSelect}
            />
          )}
          {currentView === 'year' && (
            <YearView
              events={visibleEvents}
              currentDate={currentDate}
              onDateSelect={handleDateSelect}
            />
          )}
        </div>

      </div>

      {/* Task Modal */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onTaskScheduled={handleCalendarReload}
      />

      {/* iCal Form Modal */}
      {showICalForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Add iCal Calendar
            </h2>

            {/* Info Banner */}
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-800 dark:text-blue-300">
                  <p className="font-medium mb-1">Auto-sync enabled</p>
                  <p>Your calendar will automatically sync every 15 minutes to stay up to date.</p>
                </div>
              </div>
            </div>

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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  <p className="font-medium mb-1">Where to find your iCal URL:</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-1">
                    <li><strong>Apple Calendar:</strong> Calendar Settings → Info → Calendar Address</li>
                    <li><strong>Outlook:</strong> Calendar → Share → Publish → Copy ICS link</li>
                    <li><strong>Yahoo:</strong> Settings → Calendar → Share → Get shareable link</li>
                    <li><strong>Other calendars:</strong> Look for "Subscribe", "iCal", or ".ics" export</li>
                  </ul>
                </div>
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
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
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
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
              </details>
            </div>

            <div className="mt-6 flex space-x-3">
              <button
                onClick={handleAddICalSource}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
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
    </div>
  );
}
