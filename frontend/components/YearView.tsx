'use client';

import { CalendarEvent } from '@/lib/api';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO, addMonths, startOfYear } from 'date-fns';

interface YearViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  onDateSelect?: (date: Date) => void;
}

function MiniMonth({ monthDate, events, onDateSelect }: {
  monthDate: Date;
  events: CalendarEvent[];
  onDateSelect?: (date: Date) => void;
}) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const firstDayOfWeek = monthStart.getDay();
  const calendarDays = Array(firstDayOfWeek).fill(null).concat(daysInMonth);

  // Group events by day for this month
  const eventsByDay = new Map<string, CalendarEvent[]>();
  events.forEach(event => {
    const eventStart = parseISO(event.start);
    if (isSameMonth(eventStart, monthDate)) {
      const dayKey = format(eventStart, 'yyyy-MM-dd');
      if (!eventsByDay.has(dayKey)) {
        eventsByDay.set(dayKey, []);
      }
      eventsByDay.get(dayKey)?.push(event);
    }
  });

  const hasEventsOnDay = (day: Date | null) => {
    if (!day) return false;
    const dayKey = format(day, 'yyyy-MM-dd');
    return eventsByDay.has(dayKey);
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      {/* Month name */}
      <div className="text-center mb-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {format(monthDate, 'MMMM')}
        </h3>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-gray-400 dark:text-gray-500">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const isTodayDate = isToday(day);
          const hasEvents = hasEventsOnDay(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect?.(day)}
              className={`
                aspect-square rounded text-[10px] flex items-center justify-center relative
                transition-colors
                ${isTodayDate
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }
              `}
            >
              {format(day, 'd')}
              {hasEvents && !isTodayDate && (
                <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function YearView({ events, currentDate, onDateSelect }: YearViewProps) {
  const yearStart = startOfYear(currentDate);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i));

  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 p-6">
      {/* Year header */}
      <div className="mb-6">
        <h2 className="text-3xl font-semibold text-gray-900 dark:text-white text-center">
          {format(currentDate, 'yyyy')}
        </h2>
      </div>

      {/* 12-month grid */}
      <div className="grid grid-cols-3 gap-4">
        {months.map((month) => (
          <MiniMonth
            key={month.toISOString()}
            monthDate={month}
            events={events}
            onDateSelect={onDateSelect}
          />
        ))}
      </div>
    </div>
  );
}
