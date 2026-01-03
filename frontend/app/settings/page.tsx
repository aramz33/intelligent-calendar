'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, calendar, CalendarSource } from '@/lib/api';
import { api } from '@/lib/api';

interface UserSettings {
  email: string;
  full_name: string;
  timezone: string;
  working_hours_start: string;
  working_hours_end: string;
  working_days: string[];
  default_task_duration: number;
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'working-hours' | 'calendars'>('profile');
  const [settings, setSettings] = useState<UserSettings>({
    email: '',
    full_name: '',
    timezone: '',
    working_hours_start: '09:00:00',
    working_hours_end: '17:00:00',
    working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    default_task_duration: 60,
  });
  const [calendarSources, setCalendarSources] = useState<CalendarSource[]>([]);

  const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  useEffect(() => {
    loadSettings();
    loadCalendarSources();
  }, []);

  const loadSettings = async () => {
    try {
      if (!auth.isAuthenticated()) {
        router.push('/');
        return;
      }

      const user = await auth.getCurrentUser();
      setSettings({
        email: user.email,
        full_name: user.full_name || '',
        timezone: user.timezone,
        working_hours_start: user.working_hours_start,
        working_hours_end: user.working_hours_end,
        working_days: user.working_days,
        default_task_duration: user.default_task_duration,
      });
    } catch (err) {
      console.error('Failed to load settings:', err);
      if (err.response?.status === 401) {
        auth.logout();
        router.push('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarSources = async () => {
    try {
      const sources = await calendar.getSources();
      setCalendarSources(sources);
    } catch (err) {
      console.error('Failed to load calendar sources:', err);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);

      await api.patch('/users/me', {
        full_name: settings.full_name,
        timezone: settings.timezone,
        working_hours_start: settings.working_hours_start,
        working_hours_end: settings.working_hours_end,
        working_days: settings.working_days,
        default_task_duration: settings.default_task_duration,
      });

      alert('Settings saved successfully!');
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDay = (day: string) => {
    if (settings.working_days.includes(day)) {
      setSettings({
        ...settings,
        working_days: settings.working_days.filter(d => d !== day),
      });
    } else {
      setSettings({
        ...settings,
        working_days: [...settings.working_days, day],
      });
    }
  };

  const handleDeleteCalendarSource = async (sourceId: number) => {
    if (!confirm('Are you sure you want to remove this calendar? All associated events will be deleted.')) {
      return;
    }

    try {
      await calendar.deleteSource(sourceId);
      await loadCalendarSources();
    } catch (err) {
      console.error('Failed to delete calendar source:', err);
      alert('Failed to remove calendar. Please try again.');
    }
  };

  const handleSyncCalendar = async (sourceId: number) => {
    try {
      const result = await calendar.syncSource(sourceId);
      alert(result.message);
      await loadCalendarSources();
    } catch (err) {
      console.error('Failed to sync calendar:', err);
      alert('Failed to sync calendar. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/calendar')}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="col-span-1">
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full text-left px-4 py-3 rounded-lg transition ${
                  activeTab === 'profile'
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile
                </div>
              </button>

              <button
                onClick={() => setActiveTab('working-hours')}
                className={`w-full text-left px-4 py-3 rounded-lg transition ${
                  activeTab === 'working-hours'
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Working Hours
                </div>
              </button>

              <button
                onClick={() => setActiveTab('calendars')}
                className={`w-full text-left px-4 py-3 rounded-lg transition ${
                  activeTab === 'calendars'
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Calendars
                </div>
              </button>
            </nav>
          </div>

          {/* Main Content */}
          <div className="col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                      Profile Information
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                      Update your personal information and account preferences.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={settings.email}
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Email cannot be changed
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={settings.full_name}
                      onChange={(e) => setSettings({ ...settings, full_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Timezone
                    </label>
                    <select
                      value={settings.timezone}
                      onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
                    >
                      <option value="America/New_York">Eastern Time (ET)</option>
                      <option value="America/Chicago">Central Time (CT)</option>
                      <option value="America/Denver">Mountain Time (MT)</option>
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                      <option value="Europe/London">London (GMT)</option>
                      <option value="Europe/Paris">Paris (CET)</option>
                      <option value="Asia/Tokyo">Tokyo (JST)</option>
                      <option value="Asia/Shanghai">Shanghai (CST)</option>
                      <option value="Australia/Sydney">Sydney (AEDT)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Default Task Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={settings.default_task_duration}
                      onChange={(e) => setSettings({ ...settings, default_task_duration: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
                      min="15"
                      step="15"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Default duration for new tasks
                    </p>
                  </div>
                </div>
              )}

              {/* Working Hours Tab */}
              {activeTab === 'working-hours' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                      Working Hours
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                      Set your typical working hours and days. The scheduler will only place tasks during these times.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={settings.working_hours_start}
                        onChange={(e) => setSettings({ ...settings, working_hours_start: e.target.value + ':00' })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={settings.working_hours_end}
                        onChange={(e) => setSettings({ ...settings, working_hours_end: e.target.value + ':00' })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Working Days
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {allDays.map(day => (
                        <label
                          key={day}
                          className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition"
                        >
                          <input
                            type="checkbox"
                            checked={settings.working_days.includes(day)}
                            onChange={() => handleToggleDay(day)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                            {day}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex gap-3">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-sm text-blue-700 dark:text-blue-300">
                        <p className="font-medium mb-1">How this affects scheduling:</p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                          <li>Auto-scheduler will only place tasks during selected days and hours</li>
                          <li>Calendar view will highlight your working hours</li>
                          <li>You can still manually schedule tasks outside these hours</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Calendars Tab */}
              {activeTab === 'calendars' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                      Connected Calendars
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                      Manage your calendar integrations. Events from connected calendars will be synced automatically.
                    </p>
                  </div>

                  {calendarSources.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                      <svg className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No calendars connected yet. Go to the calendar page to add calendars.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {calendarSources.map(source => (
                        <div
                          key={source.id}
                          className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-700 transition"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className="w-4 h-4 rounded"
                              style={{ backgroundColor: source.color }}
                            />
                            <div>
                              <h3 className="font-medium text-gray-900 dark:text-white">
                                {source.name}
                              </h3>
                              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                                  {source.source_type === 'google_oauth' ? 'Google Calendar' : 'iCal'}
                                </span>
                                {source.last_synced_at && (
                                  <span>
                                    Last synced: {new Date(source.last_synced_at).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSyncCalendar(source.id)}
                              className="px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition"
                            >
                              Sync Now
                            </button>
                            <button
                              onClick={() => handleDeleteCalendarSource(source.id)}
                              className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
