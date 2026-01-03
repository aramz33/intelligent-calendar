'use client';

import { useState, useEffect } from 'react';
import { Task, tasks as tasksAPI, scheduling } from '@/lib/api';
import { format } from 'date-fns';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskScheduled?: () => void;
}

export default function TaskModal({ isOpen, onClose, onTaskScheduled }: TaskModalProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    estimated_duration_minutes: 60,
    priority: 5,
    deadline: '',
    category: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadTasks();
    }
  }, [isOpen]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const allTasks = await tasksAPI.list();
      setTasks(allTasks);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) {
      alert('Task title is required');
      return;
    }

    try {
      await tasksAPI.create({
        title: newTask.title,
        description: newTask.description || undefined,
        estimated_duration_minutes: newTask.estimated_duration_minutes,
        priority: newTask.priority,
        deadline: newTask.deadline || undefined,
        category: newTask.category || undefined,
      });

      setNewTask({
        title: '',
        description: '',
        estimated_duration_minutes: 60,
        priority: 5,
        deadline: '',
        category: '',
      });
      setShowNewTaskForm(false);
      await loadTasks();
    } catch (err) {
      console.error('Failed to create task:', err);
      alert('Failed to create task. Please try again.');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      await tasksAPI.delete(taskId);
      await loadTasks();
    } catch (err) {
      console.error('Failed to delete task:', err);
      alert('Failed to delete task. Please try again.');
    }
  };

  const handleToggleTaskSelection = (taskId: number) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const handleAutoSchedule = async (useCSP: boolean = false) => {
    if (selectedTasks.size === 0) {
      alert('Please select tasks to schedule');
      return;
    }

    try {
      setLoading(true);
      const taskIds = Array.from(selectedTasks);

      if (useCSP) {
        const result = await scheduling.scheduleWithCSP(taskIds, 7);
        alert(result.message);
      } else {
        const result = await scheduling.autoSchedule(taskIds, 7);
        alert(result.message);
      }

      setSelectedTasks(new Set());
      await loadTasks();
      if (onTaskScheduled) {
        onTaskScheduled();
      }
    } catch (err: any) {
      console.error('Failed to schedule tasks:', err);
      const errorDetail = err.response?.data?.detail || 'Failed to schedule tasks';
      alert(`Error: ${errorDetail}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const unscheduledTasks = tasks.filter(t => !t.scheduled_start || new Date(t.scheduled_start) < new Date());
  const scheduledTasks = tasks.filter(t => t.scheduled_start && new Date(t.scheduled_start) >= new Date());
  const completedTasks = tasks.filter(t => t.status === 'completed');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}

          {!loading && (
            <div className="space-y-6">
              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowNewTaskForm(!showNewTaskForm)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Task
                </button>

                {selectedTasks.size > 0 && (
                  <>
                    <button
                      onClick={() => handleAutoSchedule(false)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                      Auto Schedule ({selectedTasks.size})
                    </button>
                    <button
                      onClick={() => handleAutoSchedule(true)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                      CSP Schedule ({selectedTasks.size})
                    </button>
                  </>
                )}
              </div>

              {/* New Task Form */}
              {showNewTaskForm && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Create New Task</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                      placeholder="Task title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                      rows={3}
                      placeholder="Task description"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Duration (min)
                      </label>
                      <input
                        type="number"
                        value={newTask.estimated_duration_minutes}
                        onChange={(e) => setNewTask({ ...newTask, estimated_duration_minutes: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                        min="15"
                        step="15"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Priority (1-10)
                      </label>
                      <input
                        type="number"
                        value={newTask.priority}
                        onChange={(e) => setNewTask({ ...newTask, priority: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                        min="1"
                        max="10"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Deadline
                      </label>
                      <input
                        type="datetime-local"
                        value={newTask.deadline}
                        onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleCreateTask}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      Create Task
                    </button>
                    <button
                      onClick={() => setShowNewTaskForm(false)}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Unscheduled Tasks */}
              {unscheduledTasks.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Unscheduled ({unscheduledTasks.length})
                  </h3>
                  <div className="space-y-2">
                    {unscheduledTasks.map(task => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        isSelected={selectedTasks.has(task.id)}
                        onToggle={() => handleToggleTaskSelection(task.id)}
                        onDelete={() => handleDeleteTask(task.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Scheduled Tasks */}
              {scheduledTasks.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Scheduled ({scheduledTasks.length})
                  </h3>
                  <div className="space-y-2">
                    {scheduledTasks.map(task => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        isSelected={selectedTasks.has(task.id)}
                        onToggle={() => handleToggleTaskSelection(task.id)}
                        onDelete={() => handleDeleteTask(task.id)}
                        showSchedule
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Tasks */}
              {completedTasks.length > 0 && (
                <details>
                  <summary className="text-lg font-semibold text-gray-900 dark:text-white mb-3 cursor-pointer">
                    Completed ({completedTasks.length})
                  </summary>
                  <div className="space-y-2 mt-3">
                    {completedTasks.map(task => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        isSelected={false}
                        onToggle={() => {}}
                        onDelete={() => handleDeleteTask(task.id)}
                        showSchedule
                      />
                    ))}
                  </div>
                </details>
              )}

              {tasks.length === 0 && !loading && (
                <div className="text-center py-12">
                  <div className="text-gray-400 dark:text-gray-600 mb-2">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No tasks yet. Create your first task to get started!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskItem({
  task,
  isSelected,
  onToggle,
  onDelete,
  showSchedule = false,
}: {
  task: Task;
  isSelected: boolean;
  onToggle: () => void;
  onDelete: () => void;
  showSchedule?: boolean;
}) {
  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    if (priority >= 5) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition">
      {task.status !== 'completed' && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-medium text-gray-900 dark:text-white truncate">
            {task.title}
          </h4>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
            P{task.priority}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>{task.estimated_duration_minutes} min</span>
          {task.deadline && (
            <span>Due: {format(new Date(task.deadline), 'MMM d, h:mm a')}</span>
          )}
          {showSchedule && task.scheduled_start && (
            <span className="text-blue-600 dark:text-blue-400">
              Scheduled: {format(new Date(task.scheduled_start), 'MMM d, h:mm a')}
            </span>
          )}
          {task.category && (
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
              {task.category}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={onDelete}
        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition"
        title="Delete task"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
