'use client';

import { CalendarSource } from '@/lib/api';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { useState } from 'react';

interface LeftSidebarProps {
  calendarSources: CalendarSource[];
  visibleSourceIds: Set<number>;
  onToggleSource: (sourceId: number) => void;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onConnectGoogle: () => void;
  onAddICal: () => void;
}

export default function LeftSidebar({
  calendarSources,
  visibleSourceIds,
  onToggleSource,
  selectedDate,
  onDateSelect,
  onConnectGoogle,
  onAddICal,
}: LeftSidebarProps) {
  const [miniCalendarMonth, setMiniCalendarMonth] = useState(new Date());

  // Group calendar sources by type
  const groupedSources = {
    google: calendarSources.filter((s) => s.source_type === 'google_oauth'),
    ical: calendarSources.filter((s) => s.source_type === 'ical'),
  };

  // Mini calendar calculations
  const monthStart = startOfMonth(miniCalendarMonth);
  const monthEnd = endOfMonth(miniCalendarMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get the day of week for the first day (0 = Sunday, 6 = Saturday)
  const firstDayOfWeek = monthStart.getDay();

  // Create array of days including padding
  const calendarDays = Array(firstDayOfWeek).fill(null).concat(daysInMonth);

  const handlePrevMonth = () => setMiniCalendarMonth(subMonths(miniCalendarMonth, 1));
  const handleNextMonth = () => setMiniCalendarMonth(addMonths(miniCalendarMonth, 1));
  const handleToday = () => {
    setMiniCalendarMonth(new Date());
    onDateSelect(new Date());
  };

  return (
    <div className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Calendar Sources */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Calendars
            </h2>
          </div>

          {/* Google Calendars */}
          {groupedSources.google.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2 flex items-center">
                <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </h3>
              {groupedSources.google.map((source) => (
                <label
                  key={source.id}
                  className="flex items-center py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={visibleSourceIds.has(source.id)}
                    onChange={() => onToggleSource(source.id)}
                    className="mr-2 rounded"
                  />
                  <div
                    className="w-3 h-3 rounded mr-2"
                    style={{ backgroundColor: source.color }}
                  />
                  <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                    {source.name}
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* iCal Calendars */}
          {groupedSources.ical.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2">iCal</h3>
              {groupedSources.ical.map((source) => (
                <label
                  key={source.id}
                  className="flex items-center py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={visibleSourceIds.has(source.id)}
                    onChange={() => onToggleSource(source.id)}
                    className="mr-2 rounded"
                  />
                  <div
                    className="w-3 h-3 rounded mr-2"
                    style={{ backgroundColor: source.color }}
                  />
                  <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                    {source.name}
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* Add Calendar Buttons */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <button
              onClick={onConnectGoogle}
              className="w-full text-left text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-1"
            >
              + Add Google Calendar
            </button>
            <button
              onClick={onAddICal}
              className="w-full text-left text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-1"
            >
              + Add iCal Calendar
            </button>
          </div>
        </div>
      </div>

      {/* Mini Calendar */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={handlePrevMonth}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={handleToday}
            className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
          >
            {format(miniCalendarMonth, 'MMMM yyyy')}
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <div key={i} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, miniCalendarMonth);
            const isTodayDate = isToday(day);

            return (
              <button
                key={day.toISOString()}
                onClick={() => onDateSelect(day)}
                className={`
                  aspect-square rounded-full text-xs flex items-center justify-center
                  ${isSelected ? 'bg-blue-600 text-white font-semibold' : ''}
                  ${isTodayDate && !isSelected ? 'bg-red-500 text-white font-semibold' : ''}
                  ${!isSelected && !isTodayDate && isCurrentMonth ? 'text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-800' : ''}
                  ${!isSelected && !isTodayDate && !isCurrentMonth ? 'text-gray-400 dark:text-gray-600' : ''}
                `}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
