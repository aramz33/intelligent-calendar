'use client';

import { CalendarEvent, tasks } from '@/lib/api';
import { format, isSameDay, parseISO } from 'date-fns';
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { useState, useEffect } from 'react';
import ReasoningTooltip from './ReasoningTooltip';

interface DayViewProps {
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

  const visualStyles = isSoft
    ? 'border-l-4 opacity-90 hover:opacity-100 cursor-move'
    : 'border-l-4 opacity-95 cursor-default';

  const eventContent = (
    <div
      ref={setNodeRef}
      className={`absolute left-0 right-0 mx-1 px-3 py-2 rounded ${visualStyles} text-white text-sm overflow-hidden transition-all ${
        isDragging ? 'opacity-50' : ''
      }`}
      style={{ ...style, ...transformStyle, ...colorStyle }}
      {...(isSoft ? listeners : {})}
      {...(isSoft ? attributes : {})}
      title={event.title}
    >
      <div className="font-semibold truncate">{event.title}</div>
      <div className="text-xs opacity-90 truncate mt-0.5">
        {event.is_recurring && '🔁 '}
        {format(parseISO(event.start), 'h:mm a')} - {format(parseISO(event.end), 'h:mm a')}
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

function CurrentTimeIndicator({ startHour }: { startHour: number }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

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

export default function DayView({
  events,
  currentDate,
  workingHoursStart,
  workingHoursEnd,
  onEventMove,
  onCalendarReload,
}: DayViewProps) {
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Parse working hours from "HH:MM:SS" format
  const parseHour = (timeString: string): number => {
    const [hour] = timeString.split(':').map(Number);
    return hour;
  };

  const startHour = Math.max(0, parseHour(workingHoursStart) - 1); // Start 1 hour before work for visibility
  const endHour = Math.min(24, parseHour(workingHoursEnd) + 2); // End 2 hours after work for visibility
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  const dayEvents = events.filter(event => {
    const eventStart = parseISO(event.start);
    return isSameDay(eventStart, currentDate);
  });

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

    if (event.type === 'hard_event') {
      return {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
      };
    }

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
        await tasks.scheduleTask(task.id, newStart, newEnd);

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

  const isToday = isSameDay(currentDate, new Date());

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
          <div className="text-center">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {format(currentDate, 'EEEE')}
            </div>
            <div className={`text-3xl font-semibold mt-1 ${
              isToday
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-900 dark:text-gray-100'
            }`}>
              {format(currentDate, 'd')}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {format(currentDate, 'MMMM yyyy')}
            </div>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="overflow-y-auto max-h-[calc(100vh-280px)]">
          <div className="grid grid-cols-2 relative">
            {/* Time labels */}
            <div className="border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="h-[60px] px-4 py-1 text-sm text-gray-500 dark:text-gray-400 text-right"
                >
                  {format(new Date().setHours(hour, 0, 0, 0), 'h a')}
                </div>
              ))}
            </div>

            {/* Day column */}
            <div className={`relative ${isToday ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
              {/* Hour slots */}
              {hours.map((hour) => (
                <HourSlotWithQuarters
                  key={hour}
                  day={currentDate}
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
              {isToday && <CurrentTimeIndicator startHour={startHour} />}
            </div>
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeEvent ? (
          <div
            className="px-3 py-2 rounded border-l-4 text-white text-sm shadow-lg w-40"
            style={getEventColorStyle(activeEvent)}
          >
            <div className="font-semibold truncate">{activeEvent.title}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
