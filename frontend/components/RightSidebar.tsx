'use client';

import { CalendarEvent, Task } from '@/lib/api';
import { format, parseISO } from 'date-fns';

interface RightSidebarProps {
  selectedEvent?: CalendarEvent | null;
  selectedTask?: Task | null;
}

export default function RightSidebar({ selectedEvent, selectedTask }: RightSidebarProps) {
  // If nothing is selected, show empty state
  if (!selectedEvent && !selectedTask) {
    return (
      <div className="w-80 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="text-gray-400 dark:text-gray-600 mb-2">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select an event to view details
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show event details if event is selected
  if (selectedEvent) {
    const start = parseISO(selectedEvent.start);
    const end = parseISO(selectedEvent.end);
    const duration = Math.round((end.getTime() - start.getTime()) / 60000); // minutes

    return (
      <div className="w-80 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Event title */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {selectedEvent.title}
            </h2>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: selectedEvent.color || '#007AFF' }}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {selectedEvent.type === 'hard_event' ? 'Event' : 'Task'}
              </span>
            </div>
          </div>

          {/* Time details */}
          <div className="space-y-3">
            <div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Start
              </div>
              <div className="text-sm text-gray-900 dark:text-white">
                {format(start, 'EEEE, MMMM d, yyyy')}
                <br />
                {format(start, 'h:mm a')}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                End
              </div>
              <div className="text-sm text-gray-900 dark:text-white">
                {format(end, 'EEEE, MMMM d, yyyy')}
                <br />
                {format(end, 'h:mm a')}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Duration
              </div>
              <div className="text-sm text-gray-900 dark:text-white">
                {duration >= 60
                  ? `${Math.floor(duration / 60)}h ${duration % 60}m`
                  : `${duration}m`
                }
              </div>
            </div>
          </div>

          {/* Priority (for soft tasks) */}
          {selectedEvent.type === 'soft_task' && selectedEvent.priority && (
            <div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Priority
              </div>
              <div className="flex items-center gap-2">
                <div className={`px-2 py-1 rounded text-xs font-medium ${
                  selectedEvent.priority >= 8
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : selectedEvent.priority >= 5
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                }`}>
                  P{selectedEvent.priority}
                </div>
              </div>
            </div>
          )}

          {/* Reasoning (for soft tasks) */}
          {selectedEvent.reasoning && (
            <div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Scheduling Reasoning
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line border border-gray-200 dark:border-gray-700">
                {selectedEvent.reasoning}
              </div>
            </div>
          )}

          {/* Description (if exists) */}
          {selectedEvent.description && (
            <div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Description
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                {selectedEvent.description}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback (shouldn't reach here)
  return null;
}
