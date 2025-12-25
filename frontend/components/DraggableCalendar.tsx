'use client';

import { CalendarEvent } from '@/lib/api';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DraggableCalendarProps {
  events: CalendarEvent[];
  currentDate: Date;
  workingHoursStart: string;
  workingHoursEnd: string;
  onEventMove: (eventId: number, eventType: string, newStart: Date, newEnd: Date) => Promise<void>;
  rippleChanges?: Array<{
    task_id: number;
    old_start: string;
    new_start: string;
  }>;
}

interface DraggableEventProps {
  event: CalendarEvent;
  style: { top: string; height: string };
  colorClass: string;
  colorStyle?: React.CSSProperties;
}

function DraggableEvent({ event, style, colorClass, colorStyle }: DraggableEventProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${event.type}-${event.id}`,
    data: event,
  });

  const transformStyle = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  // Only allow dragging soft tasks (not hard events)
  const canDrag = event.type === 'soft_task';

  return (
    <div
      ref={setNodeRef}
      className={`absolute left-0 right-0 mx-1 px-2 py-1 rounded border-l-4 ${colorClass} bg-opacity-90 dark:bg-opacity-80 text-white text-xs overflow-hidden transition-shadow ${
        canDrag ? 'cursor-move hover:shadow-lg' : 'cursor-default'
      } ${isDragging ? 'opacity-50' : ''}`}
      style={{ ...style, ...transformStyle, ...colorStyle }}
      {...(canDrag ? listeners : {})}
      {...(canDrag ? attributes : {})}
      title={event.title}
    >
      <div className="font-medium truncate">{event.title}</div>
      {event.priority && (
        <div className="text-xs opacity-75">P{event.priority}</div>
      )}
    </div>
  );
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
        isOver ? 'bg-indigo-100 dark:bg-indigo-900/20 ring-1 ring-indigo-400' : ''
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
    <div className={`relative h-[60px] ${
      hour % 3 === 0
        ? 'border-b-2 border-gray-300 dark:border-gray-600'
        : 'border-b border-gray-200 dark:border-gray-700'
    }`}>
      {/* Quarter-hour droppable slots */}
      {[0, 15, 30, 45].map(minutes => (
        <QuarterHourSlot
          key={minutes}
          day={day}
          hour={hour}
          minutes={minutes}
          isOver={overId === `${day.toISOString()}-${hour}-${minutes}`}
        />
      ))}

      {/* Half-hour dashed line */}
      <div className="absolute top-1/2 w-full border-t border-dashed border-gray-200 dark:border-gray-700 pointer-events-none" />
    </div>
  );
}

export default function DraggableCalendar({
  events,
  currentDate,
  workingHoursStart,
  workingHoursEnd,
  onEventMove,
  rippleChanges = []
}: DraggableCalendarProps) {
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dragPreviewTime, setDragPreviewTime] = useState<string | null>(null);
  const [dragPreviewPosition, setDragPreviewPosition] = useState<{x: number, y: number} | null>(null);

  // Get start of week (Monday)
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Parse working hours
  const workingStartHour = parseInt(workingHoursStart.split(':')[0]);
  const workingEndHour = parseInt(workingHoursEnd.split(':')[0]);

  // Show extended hours (6am-10pm)
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
  const getEventPosition = (event: CalendarEvent) => {
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
    // If event has a custom color (from calendar source), return empty string
    // We'll use inline styles instead
    if (event.color) {
      return '';
    }

    if (event.type === 'hard_event') {
      return 'bg-blue-500 border-blue-600';
    }
    // Soft task - color by priority
    const priority = event.priority || 5;
    if (priority >= 8) return 'bg-red-500 border-red-600';
    if (priority >= 5) return 'bg-yellow-500 border-yellow-600';
    return 'bg-green-500 border-green-600';
  };

  // Get inline styles for events with custom colors
  const getEventColorStyle = (event: CalendarEvent): React.CSSProperties => {
    if (event.color) {
      return {
        backgroundColor: event.color,
        borderColor: event.color,
        opacity: 0.9,
      };
    }
    return {};
  };

  const handleDragStart = (event: DragStartEvent) => {
    const draggedEvent = event.active.data.current as CalendarEvent;
    setActiveEvent(draggedEvent);
  };

  const handleDragOver = (event: any) => {
    setOverId(event.over?.id || null);

    if (!event.over) {
      setDragPreviewTime(null);
      setDragPreviewPosition(null);
      return;
    }

    const dropData = event.over.data.current as { day: Date; hour: number; minutes?: number };
    if (dropData && dropData.day && typeof dropData.hour === 'number') {
      const previewDate = new Date(dropData.day);
      previewDate.setHours(dropData.hour, dropData.minutes || 0, 0, 0);

      setDragPreviewTime(format(previewDate, 'h:mm a'));

      // Get mouse position for preview placement
      if (event.activatorEvent && 'clientX' in event.activatorEvent) {
        setDragPreviewPosition({
          x: event.activatorEvent.clientX,
          y: event.activatorEvent.clientY
        });
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveEvent(null);
    setOverId(null);
    setDragPreviewTime(null);
    setDragPreviewPosition(null);

    if (!over) return;

    const movedEvent = active.data.current as CalendarEvent;
    const dropTarget = over.data.current as { day: Date; hour: number; minutes: number };

    if (!dropTarget) return;

    // Calculate new start/end time with 15-min precision
    const newStart = new Date(dropTarget.day);
    newStart.setHours(dropTarget.hour, dropTarget.minutes || 0, 0, 0);

    const originalStart = parseISO(movedEvent.start);
    const originalEnd = parseISO(movedEvent.end);
    const duration = originalEnd.getTime() - originalStart.getTime();

    const newEnd = new Date(newStart.getTime() + duration);

    // Call the parent handler
    await onEventMove(movedEvent.id, movedEvent.type, newStart, newEnd);
  };

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
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
                  className="h-[60px] px-2 py-1 text-xs font-semibold text-gray-600 dark:text-gray-400 text-right border-b-2 border-gray-200 dark:border-gray-700"
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
                  {/* Hour lines with quarter-hour droppable zones */}
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
                    const colorClass = getEventColor(event);

                    return (
                      <DraggableEvent
                        key={`${event.type}-${event.id}`}
                        event={event}
                        style={positionStyle}
                        colorClass={colorClass}
                        colorStyle={colorStyle}
                      />
                    );
                  })}
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
            className={`px-2 py-1 rounded border-l-4 ${getEventColor(activeEvent)} bg-opacity-90 text-white text-xs shadow-2xl w-32`}
          >
            <div className="font-medium truncate">{activeEvent.title}</div>
            {activeEvent.priority && (
              <div className="text-xs opacity-75">P{activeEvent.priority}</div>
            )}
          </div>
        ) : null}
      </DragOverlay>

      {/* Time preview tooltip during drag */}
      {dragPreviewTime && dragPreviewPosition && (
        <div
          className="fixed z-50 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-lg pointer-events-none"
          style={{
            left: dragPreviewPosition.x + 15,
            top: dragPreviewPosition.y - 30,
          }}
        >
          {dragPreviewTime}
        </div>
      )}

      {/* Ripple effect animation overlay */}
      <AnimatePresence>
        {rippleChanges.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
          >
            {rippleChanges.map((change, i) => (
              <motion.div
                key={change.task_id}
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 3, opacity: 0 }}
                transition={{ duration: 1, delay: i * 0.1 }}
                className="absolute w-20 h-20 bg-blue-500 rounded-full"
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </DndContext>
  );
}
