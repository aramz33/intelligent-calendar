'use client';

import { CalendarEvent } from '@/lib/api';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';

interface WeeklyCalendarProps {
  events: CalendarEvent[];
  currentDate: Date;
  workingHoursStart: string; // "09:00:00"
  workingHoursEnd: string; // "17:00:00"
}

export default function WeeklyCalendar({
  events,
  currentDate,
  workingHoursStart,
  workingHoursEnd
}: WeeklyCalendarProps) {
  // Get start of week (Monday)
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Parse working hours
  const workingStartHour = parseInt(workingHoursStart.split(':')[0]);
  const workingEndHour = parseInt(workingHoursEnd.split(':')[0]);

  // Show extended hours (6am-10pm) but highlight working hours
  const startHour = 6;
  const endHour = 22;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventStart = parseISO(event.start);
      return isSameDay(eventStart, day);
    });
  };

  // Calculate position and height for an event
  const getEventStyle = (event: CalendarEvent) => {
    const eventStart = parseISO(event.start);
    const eventEnd = parseISO(event.end);

    const startMinutes = eventStart.getHours() * 60 + eventStart.getMinutes();
    const endMinutes = eventEnd.getHours() * 60 + eventEnd.getMinutes();
    const dayStartMinutes = startHour * 60;

    const top = ((startMinutes - dayStartMinutes) / 60) * 60; // 60px per hour
    const height = ((endMinutes - startMinutes) / 60) * 60;

    return { top: `${top}px`, height: `${height}px` };
  };

  // Get color based on event type and priority
  const getEventColor = (event: CalendarEvent) => {
    if (event.type === 'hard_event') {
      return 'bg-blue-500 border-blue-600';
    }
    // Soft task - color by priority
    const priority = event.priority || 5;
    if (priority >= 8) return 'bg-red-500 border-red-600';
    if (priority >= 5) return 'bg-yellow-500 border-yellow-600';
    return 'bg-green-500 border-green-600';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header with days */}
      <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-700">
        <div className="p-4 text-sm font-medium text-gray-500 dark:text-gray-400">Time</div>
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={`p-4 text-center ${
              isSameDay(day, new Date())
                ? 'bg-indigo-50 dark:bg-indigo-900/20'
                : ''
            }`}
          >
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {format(day, 'EEE')}
            </div>
            <div className={`text-lg font-semibold ${
              isSameDay(day, new Date())
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-gray-700 dark:text-gray-300'
            }`}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Calendar grid - scrollable */}
      <div className="overflow-y-auto max-h-[600px]">
        <div className="grid grid-cols-8 relative">
        {/* Time labels */}
        <div className="border-r border-gray-200 dark:border-gray-700">
          {hours.map((hour) => (
            <div
              key={hour}
              className="h-[60px] px-2 py-1 text-xs text-gray-500 dark:text-gray-400 text-right border-b border-gray-100 dark:border-gray-800"
            >
              {hour}:00
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day) => {
          const dayEvents = getEventsForDay(day);

          return (
            <div
              key={day.toISOString()}
              className="relative border-r border-gray-200 dark:border-gray-700"
            >
              {/* Hour lines */}
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="h-[60px] border-b border-gray-100 dark:border-gray-800"
                />
              ))}

              {/* Events */}
              {dayEvents.map((event) => {
                const style = getEventStyle(event);
                const colorClass = getEventColor(event);

                return (
                  <div
                    key={`${event.type}-${event.id}`}
                    className={`absolute left-0 right-0 mx-1 px-2 py-1 rounded border-l-4 ${colorClass} bg-opacity-90 dark:bg-opacity-80 text-white text-xs overflow-hidden cursor-pointer hover:shadow-lg transition-shadow`}
                    style={style}
                    title={event.title}
                  >
                    <div className="font-medium truncate">{event.title}</div>
                    {event.priority && (
                      <div className="text-xs opacity-75">P{event.priority}</div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
