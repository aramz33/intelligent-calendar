'use client';

import { CalendarEvent } from '@/lib/api';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { useState, useEffect } from 'react';
import ReasoningTooltip from './ReasoningTooltip';

interface WeekViewProps {
  events: CalendarEvent[];
  currentDate: Date;
  workingHoursStart: string;
  workingHoursEnd: string;
  onEventMove: (eventId: number, eventType: string, newStart: Date, newEnd: Date) => Promise<void>;
  onCalendarReload?: () => Promise<void>;
}

interface DraggableEventProps {
  event: CalendarEvent;
  style: { top: string; height: string };
  colorStyle?: React.CSSProperties;
}

function DraggableEvent({ event, style, colorStyle }: DraggableEventProps) {
  const isHard = event.type === 'hard_event';
  const isSoft = event.type === 'soft_task';

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${event.type}-${event.id}`,
    data: event,
    disabled: isHard,
  });

  const transformStyle = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  // Apple Calendar style: hard events are solid, soft tasks have subtle distinction
  const visualStyles = isSoft
    ? 'border-l-4 opacity-90 hover:opacity-100 cursor-move'
    : 'border-l-4 opacity-95 cursor-default';

  const eventContent = (
    <div
      ref={setNodeRef}
      className={`absolute left-0 right-0 mx-0.5 px-2 py-1 rounded-sm ${visualStyles} text-white text-xs overflow-hidden transition-all ${
        isDragging ? 'opacity-50' : ''
      }`}
      style={{ ...style, ...transformStyle, ...colorStyle }}
      {...(isSoft ? listeners : {})}
      {...(isSoft ? attributes : {})}
      title={event.title}
    >
      <div className="font-medium truncate text-xs">{event.title}</div>
      <div className="text-[10px] opacity-80 truncate">
        {event.is_recurring && '🔁 '}
        {format(parseISO(event.start), 'h:mm a')}
      </div>
    </div>
  );

  if (isSoft && event.reasoning) {
    return <ReasoningTooltip reasoning={event.reasoning}>{eventContent}</ReasoningTooltip>;
  }

  return eventContent;
}

interface QuarterHourSlotProps {
  day: Date;
  hour: number;
  minutes: number;
  isOver: boolean;
}

function QuarterHourSlot({ day, hour, minutes, isOver }: QuarterHourSlotProps) {
  const { setNodeRef } = useDroppable({
    id: `${day.toISOString()}-${hour}-${minutes}`,
    data: { day, hour, minutes }
  });

  return (
    <div
      ref={setNodeRef}
      className={`absolute h-[15px] w-full transition-colors ${
        isOver ? 'bg-blue-100 dark:bg-blue-900/20 ring-1 ring-blue-400' : ''
      }`}
      style={{ top: `${(minutes / 60) * 60}px` }}
    />
  );
}

interface HourSlotWithQuartersProps {
  day: Date;
  hour: number;
  overId: string | null;
}

function HourSlotWithQuarters({ day, hour, overId }: HourSlotWithQuartersProps) {
  return (
    <div className="relative h-[60px] border-b border-gray-100 dark:border-gray-800">
      {[0, 15, 30, 45].map(minutes => (
        <QuarterHourSlot
          key={minutes}
          day={day}
          hour={hour}
          minutes={minutes}
          isOver={overId === `${day.toISOString()}-${hour}-${minutes}`}
        />
      ))}
      {/* Half-hour line */}
      <div className="absolute top-1/2 w-full border-t border-dashed border-gray-100 dark:border-gray-800 pointer-events-none" />
    </div>
  );
}

function CurrentTimeIndicator({ startHour, weekStart }: { startHour: number; weekStart: Date }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayColumnIndex = weekDays.findIndex((day) => isSameDay(day, now));

  if (todayColumnIndex === -1) return null;

  const hour = now.getHours();
  const minutes = now.getMinutes();
  const topPosition = (hour - startHour) * 60 + minutes;

  return (
    <div
      className="absolute left-0 right-0 z-30 pointer-events-none"
      style={{ top: `${topPosition}px` }}
    >
      <div className="flex items-center">
        <div className="w-2 h-2 bg-red-500 rounded-full -ml-1" />
        <div className="flex-1 h-0.5 bg-red-500" />
      </div>
    </div>
  );
}

export default function WeekView({
  events,
  currentDate,
  workingHoursStart,
  workingHoursEnd,
  onEventMove,
  onCalendarReload,
}: WeekViewProps) {
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const workingStartHour = parseInt(workingHoursStart.split(':')[0]);
  const workingEndHour = parseInt(workingHoursEnd.split(':')[0]);

  const startHour = 6;
  const endHour = 22;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventStart = parseISO(event.start);
      return isSameDay(eventStart, day);
    });
  };

  const getEventPosition = (event: CalendarEvent) => {
    const eventStart = parseISO(event.start);
    const eventEnd = parseISO(event.end);

    const startMinutes = eventStart.getHours() * 60 + eventStart.getMinutes();
    const endMinutes = eventEnd.getHours() * 60 + eventEnd.getMinutes();
    const dayStartMinutes = startHour * 60;

    const top = ((startMinutes - dayStartMinutes) / 60) * 60;
    const height = ((endMinutes - startMinutes) / 60) * 60;

    return { top: `${top}px`, height: `${height}px` };
  };

  const getEventColorStyle = (event: CalendarEvent): React.CSSProperties => {
    if (event.color) {
      return {
        backgroundColor: event.color,
        borderColor: event.color,
      };
    }

    // Default colors for events without custom color
    if (event.type === 'hard_event') {
      return {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
      };
    }

    // Soft task - color by priority
    const priority = event.priority || 5;
    if (priority >= 8) {
      return { backgroundColor: '#FF3B30', borderColor: '#FF3B30' };
    }
    if (priority >= 5) {
      return { backgroundColor: '#FF9500', borderColor: '#FF9500' };
    }
    return { backgroundColor: '#34C759', borderColor: '#34C759' };
  };

  const handleDragStart = (event: DragStartEvent) => {
    const draggedEvent = event.active.data.current as CalendarEvent;
    setActiveEvent(draggedEvent);
  };

  const handleDragOver = (event: any) => {
    setOverId(event.over?.id || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveEvent(null);
    setOverId(null);

    if (!over) return;

    const dragData = active.data.current;
    const dropTarget = over.data.current as { day: Date; hour: number; minutes: number };

    if (!dropTarget) return;

    const newStart = new Date(dropTarget.day);
    newStart.setHours(dropTarget.hour, dropTarget.minutes || 0, 0, 0);

    const isFromTaskBin = dragData?.source === 'task-bin';

    if (isFromTaskBin) {
      const task = dragData.task;
      const newEnd = new Date(newStart.getTime() + task.estimated_duration_minutes * 60000);

      try {
        const response = await fetch(`http://localhost:8000/api/v1/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduled_start: newStart.toISOString(),
            scheduled_end: newEnd.toISOString(),
          }),
        });

        if (!response.ok) throw new Error('Failed to schedule task');

        if (onCalendarReload) {
          await onCalendarReload();
        }
      } catch (err) {
        console.error('Failed to schedule task:', err);
        alert('Failed to schedule task. Please try again.');
      }
    } else {
      const movedEvent = dragData as CalendarEvent;
      const originalStart = parseISO(movedEvent.start);
      const originalEnd = parseISO(movedEvent.end);
      const duration = originalEnd.getTime() - originalStart.getTime();

      const newEnd = new Date(newStart.getTime() + duration);

      await onEventMove(movedEvent.id, movedEvent.type, newStart, newEnd);
    }
  };

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header with days */}
        <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="p-3 text-xs font-medium text-gray-500 dark:text-gray-400">
            {format(currentDate, 'MMM yyyy')}
          </div>
          {days.map((day) => {
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={day.toISOString()}
                className={`p-3 text-center ${
                  isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {format(day, 'EEE')}
                </div>
                <div className={`text-lg font-semibold mt-1 ${
                  isToday
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {format(day, 'd')}
                </div>
              </div>
            );
          })}
        </div>

        {/* Calendar grid */}
        <div className="overflow-y-auto max-h-[calc(100vh-280px)]">
          <div className="grid grid-cols-8 relative">
            {/* Time labels */}
            <div className="border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="h-[60px] px-2 py-1 text-xs text-gray-500 dark:text-gray-400 text-right"
                >
                  {format(new Date().setHours(hour, 0, 0, 0), 'h a')}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={`relative border-r border-gray-200 dark:border-gray-700 ${
                    isToday ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                  }`}
                >
                  {/* Hour slots */}
                  {hours.map((hour) => (
                    <HourSlotWithQuarters
                      key={hour}
                      day={day}
                      hour={hour}
                      overId={overId}
                    />
                  ))}

                  {/* Events */}
                  {dayEvents.map((event) => {
                    const positionStyle = getEventPosition(event);
                    const colorStyle = getEventColorStyle(event);

                    return (
                      <DraggableEvent
                        key={`${event.type}-${event.id}`}
                        event={event}
                        style={positionStyle}
                        colorStyle={colorStyle}
                      />
                    );
                  })}

                  {/* Current time indicator */}
                  {isToday && (
                    <CurrentTimeIndicator startHour={startHour} weekStart={weekStart} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeEvent ? (
          <div
            className="px-2 py-1 rounded-sm border-l-4 text-white text-xs shadow-lg w-32"
            style={getEventColorStyle(activeEvent)}
          >
            <div className="font-medium truncate">{activeEvent.title}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
