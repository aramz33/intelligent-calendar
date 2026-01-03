'use client';

import { Task } from '@/lib/api';
import TaskCard from './TaskCard';

interface TaskBinProps {
  tasks: Task[];
}

export default function TaskBin({ tasks }: TaskBinProps) {
  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Task Bin</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {tasks.length} unscheduled {tasks.length === 1 ? 'task' : 'tasks'}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Drag tasks onto the calendar to schedule them
        </p>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              All tasks scheduled!
            </p>
          </div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
}
