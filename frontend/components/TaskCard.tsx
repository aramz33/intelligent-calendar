'use client';

import { Task } from '@/lib/api';
import { useDraggable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

interface TaskCardProps {
  task: Task;
}

export default function TaskCard({ task }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `unscheduled-${task.id}`,
    data: { task, source: 'task-bin' }, // Source identifier for drag detection
  });

  // Priority-based color (Apple-style colors)
  const priorityColor =
    task.priority >= 8
      ? 'border-red-400 dark:border-red-500'
      : task.priority >= 5
      ? 'border-yellow-400 dark:border-yellow-500'
      : 'border-green-400 dark:border-green-500';

  const priorityBg =
    task.priority >= 8
      ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
      : task.priority >= 5
      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
      : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400';

  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      whileHover={{ scale: 1.02, y: -2 }}
      className={`
        bg-white dark:bg-gray-800 rounded-xl p-4
        border-2 ${priorityColor}
        shadow-apple-sm hover:shadow-apple-md
        cursor-grab active:cursor-grabbing
        transition-all duration-200
        ${isDragging ? 'opacity-50' : 'opacity-100'}
      `}
    >
      <h3 className="font-semibold text-gray-900 dark:text-white mb-2 truncate">
        {task.title}
      </h3>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
          {task.estimated_duration_minutes} min
        </span>
        <span className={`px-2 py-1 rounded ${priorityBg}`}>P{task.priority}</span>
        {task.deadline && (
          <span className="px-2 py-1 bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 rounded">
            Due {format(new Date(task.deadline), 'MMM d')}
          </span>
        )}
        {task.category && (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 rounded">
            {task.category}
          </span>
        )}
      </div>

      {task.description && (
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
          {task.description}
        </p>
      )}
    </motion.div>
  );
}
