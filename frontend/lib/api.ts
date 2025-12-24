import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

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
};