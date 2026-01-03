import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const DEV_DISABLE_AUTH = process.env.NEXT_PUBLIC_DEV_DISABLE_AUTH === 'true';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Types
export interface User {
  id: number;
  email: string;
  full_name: string | null;
  timezone: string;
  working_hours_start: string;
  working_hours_end: string;
  working_days: string[];
  default_task_duration: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  estimated_duration_minutes: number;
  deadline: string | null;
  priority: number;
  category: string | null;
  energy_required: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

// Auth functions
export const auth = {
  register: async (email: string, password: string, fullName: string): Promise<User> => {
    const response = await api.post('/auth/register', {
      email,
      password,
      full_name: fullName,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    return response.data;
  },

  login: async (email: string, password: string): Promise<LoginResponse> => {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);

    const response = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    const { access_token } = response.data;
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', access_token);
    }

    return response.data;
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
    }
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get('/users/me');
    return response.data;
  },

  isAuthenticated: (): boolean => {
    // DEV MODE: Always authenticated
    if (DEV_DISABLE_AUTH) {
      return true;
    }
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('access_token');
    }
    return false;
  },
};

// Task functions
export const tasks = {
  create: async (taskData: {
    title: string;
    description?: string;
    estimated_duration_minutes: number;
    priority?: number;
    category?: string;
    energy_required?: string;
    deadline?: string;
  }): Promise<Task> => {
    const response = await api.post('/tasks/', taskData);
    return response.data;
  },

  list: async (status?: string): Promise<Task[]> => {
    const params = status ? { status } : {};
    const response = await api.get('/tasks/', { params });
    return response.data;
  },

  get: async (id: number): Promise<Task> => {
    const response = await api.get(`/tasks/${id}`);
    return response.data;
  },

  update: async (id: number, taskData: Partial<Task>): Promise<Task> => {
    const response = await api.patch(`/tasks/${id}`, taskData);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/tasks/${id}`);
  },

  scheduleTask: async (taskId: number, start: Date, end: Date): Promise<Task> => {
    const response = await api.patch(`/tasks/${taskId}`, {
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
    });
    return response.data;
  },
};

// Calendar types
export interface CalendarEvent {
  type: 'hard_event' | 'soft_task';
  id: number;
  title: string;
  start: string;
  end: string;
  status?: string;
  priority?: number;
  reasoning?: string; // CSP reasoning for soft tasks
  location?: string;
  is_all_day?: boolean;
  calendar_source_id?: number;
  color?: string;
  is_recurring?: boolean;
  recurrence_rule?: string;
}

export interface CalendarResponse {
  events: CalendarEvent[];
  unscheduled_tasks: Task[];
}

export interface CalendarSource {
  id: number;
  name: string;
  color: string;
  sync_enabled: boolean;
  last_synced_at: string | null;
  source_type: 'ical' | 'google_oauth';
}

// Calendar functions
export const calendar = {
  getView: async (startDate: string, endDate: string): Promise<CalendarResponse> => {
    const response = await api.get('/calendar/', {
      params: { start_date: startDate, end_date: endDate }
    });
    return response.data;
  },

  getSources: async (): Promise<CalendarSource[]> => {
    const response = await api.get('/calendar/sources');
    return response.data;
  },

  initiateGoogleOAuth: async (): Promise<{ authorization_url: string }> => {
    const response = await api.get('/calendar/oauth/google/authorize');
    return response.data;
  },

  syncSource: async (sourceId: number): Promise<{
    success: boolean;
    events_added: number;
    events_updated: number;
    message: string;
  }> => {
    const response = await api.post(`/calendar/sources/${sourceId}/sync`);
    return response.data;
  },

  deleteSource: async (sourceId: number): Promise<void> => {
    await api.delete(`/calendar/sources/${sourceId}`);
  },

  createICalSource: async (data: {
    name: string;
    ical_url: string;
    ical_username?: string;
    ical_password?: string;
    sync_enabled?: boolean;
    color?: string;
  }): Promise<CalendarSource> => {
    const response = await api.post('/calendar/sources', data);
    return response.data;
  },
};

// Scheduling functions
export const scheduling = {
  autoSchedule: async (taskIds: number[], daysAhead: number = 7): Promise<{
    scheduled_count: number;
    failed_count: number;
    scheduled_task_ids: number[];
    failed_task_ids: number[];
    message: string;
  }> => {
    const response = await api.post('/schedule/auto', {
      task_ids: taskIds,
      days_ahead: daysAhead
    });
    return response.data;
  },

  scheduleWithCSP: async (taskIds: number[], daysAhead: number = 7): Promise<{
    scheduled_count: number;
    failed_count: number;
    scheduled_task_ids: number[];
    failed_task_ids: number[];
    schedule: Record<number, { start: string; end: string }>;
    message: string;
    solver_status: string;
  }> => {
    const response = await api.post('/schedule/csp', {
      task_ids: taskIds,
      days_ahead: daysAhead
    });
    return response.data;
  },

  moveTaskWithRipple: async (taskId: number, newStart: Date, newEnd: Date): Promise<{
    success: boolean;
    changes: Array<{
      task_id: number;
      old_start: string;
      new_start: string;
    }>;
    message: string;
  }> => {
    const response = await api.post('/schedule/move-task', {
      task_id: taskId,
      new_start: newStart.toISOString(),
      new_end: newEnd.toISOString()
    });
    return response.data;
  },
};