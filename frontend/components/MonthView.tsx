'use client';

import { CalendarEvent } from '@/lib/api';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO } from 'date-fns';
import { useState } from 'react';

interface MonthViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onDateSelect?: (date: Date) => void;
}

export default function MonthView({ events, currentDate, onDateSelect }: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get the day of week for the first day (0 = Sunday, 6 = Saturday)
  const firstDayOfWeek = monthStart.getDay();

  // Create array of days including padding
  const calendarDays = Array(firstDayOfWeek).fill(null).concat(daysInMonth);

  // Group events by day
  const eventsByDay = new Map<string, CalendarEvent[]>();
  events.forEach(event => {
    const eventStart = parseISO(event.start);
    const dayKey = format(eventStart, 'yyyy-MM-dd');
    if (!eventsByDay.has(dayKey)) {
      eventsByDay.set(dayKey, []);
    }
    eventsByDay.get(dayKey)?.push(event);
  });

  const getEventsForDay = (day: Date | null) => {
    if (!day) return [];
    const dayKey = format(day, 'yyyy-MM-dd');
    return eventsByDay.get(dayKey) || [];
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Header with month/year */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white text-center">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="aspect-square border-r border-b border-gray-100 dark:border-gray-800" />;
          }

          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isTodayDate = isToday(day);

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDateSelect?.(day)}
              className={`
                aspect-square border-r border-b border-gray-100 dark:border-gray-800 p-2
                transition-colors cursor-pointer
                ${isCurrentMonth ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}
                ${isTodayDate ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}
                hover:bg-gray-50 dark:hover:bg-gray-800
              `}
            >
              {/* Day number */}
              <div className="flex items-start justify-between mb-1">
                <span
                  className={`
                    text-sm font-medium
                    ${isTodayDate
                      ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center'
                      : isCurrentMonth
                        ? 'text-gray-900 dark:text-gray-100'
                        : 'text-gray-400 dark:text-gray-600'
                    }
                  `}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {/* Event dots */}
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event, idx) => (
                  <div
                    key={`${event.type}-${event.id}`}
                    className="text-[10px] truncate px-1 py-0.5 rounded"
                    style={{
                      backgroundColor: event.color || (event.type === 'hard_event' ? '#007AFF' : '#34C759'),
                      color: 'white',
                      opacity: 0.9,
                    }}
                    title={event.title}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 px-1">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
