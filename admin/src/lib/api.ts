// API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api';

// Cookie helper functions
export function getCookie(name: string): string | null {
  if (typeof window === 'undefined') return null;
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

export function setCookie(name: string, value: string, days = 7) {
  if (typeof window === 'undefined') return;
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = 'expires=' + d.toUTCString();
  document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`;
}

export function eraseCookie(name: string) {
  if (typeof window === 'undefined') return;
  document.cookie = `${name}=; Max-Age=-99999999;path=/;SameSite=Lax`;
}

// Typings for Shuttle Bot System
export interface User {
  id: string;
  telegramId: string; // Handle BigInt as string in API response
  name: string;
  username: string | null;
  phone: string | null;
  createdAt: string;
}

export interface Freelancer {
  id: string;
  userId: string;
  user: User;
  ktmUrl: string;
  selfieUrl: string | null;
  emergencyName: string;
  emergencyPhone: string;
  status: 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'BANNED';
  riskScore: number;
  totalOrders: number;
  avgRating: number;
  approvedAt: string | null;
  suspendedUntil: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  type: 'ANJEM' | 'JASTIP' | 'JASA';
  status: 'WAITING' | 'MATCHED' | 'RUNNING' | 'DONE' | 'CANCELLED';
  userId: string;
  user: User;
  freelancerId: string | null;
  freelancer?: Freelancer | null;
  pickupLocation?: string | null;
  dropLocation?: string | null;
  passengerCount?: number | null;
  jastipCategory?: string | null;
  jastipDetail?: string | null;
  jasaType?: string | null;
  jasaDetail?: string | null;
  estimatedPrice: number;
  finalPrice: number | null;
  rating: number | null;
  ratingComment?: string | null;
  matchedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  contract?: {
    id: string;
    hash: string;
    content: any;
    signedAt: string;
  } | null;
}

export interface Report {
  id: string;
  orderId: string;
  order: Order;
  reporterId: string;
  reporter: User;
  freelancerId: string;
  freelancer: Freelancer;
  description: string;
  evidenceUrl: string | null;
  status: 'PENDING' | 'VALID' | 'INVALID' | 'ACTIONED';
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface StatsResponse {
  totalUsers: number;
  activeFreelancers: number;
  pendingFreelancers: number;
  activeOrders: number;
  totalOrders: number;
  totalRevenue: number;
  charts: {
    dailyOrders: Array<{
      date: string;
      total: number;
      ANJEM: number;
      JASTIP: number;
      JASA: number;
    }>;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// API client base function
async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getCookie('admin_token');
  
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errMsg = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const data = await response.json();
      errMsg = data.error || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  return response.json() as Promise<T>;
}

// API methods
export const api = {
  // Login
  login: async (username: string, password: string) => {
    const res = await apiRequest<{ token: string; expiresIn: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setCookie('admin_token', res.token);
    return res;
  },

  // Logout
  logout: () => {
    eraseCookie('admin_token');
  },

  // Stats
  getStats: () => apiRequest<StatsResponse>('/stats'),

  // Freelancers
  getFreelancers: (status?: string, search?: string, page = 1, limit = 10) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    params.append('page', String(page));
    params.append('limit', String(limit));
    return apiRequest<PaginatedResponse<Freelancer>>(`/freelancers?${params.toString()}`);
  },

  getFreelancerById: (id: string) => apiRequest<Freelancer>(`/freelancers/${id}`),

  approveFreelancer: (id: string) =>
    apiRequest<{ message: string; freelancer: Freelancer }>(`/freelancers/${id}/approve`, {
      method: 'PATCH',
    }),

  suspendFreelancer: (id: string, reason: string, days = 7) =>
    apiRequest<{ message: string; freelancer: Freelancer }>(`/freelancers/${id}/suspend`, {
      method: 'PATCH',
      body: JSON.stringify({ days, reason }),
    }),

  banFreelancer: (id: string, reason: string) =>
    apiRequest<{ message: string; freelancer: Freelancer }>(`/freelancers/${id}/ban`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),

  unsuspendFreelancer: (id: string) =>
    apiRequest<{ success: boolean; freelancer: Freelancer }>(`/freelancers/${id}/unsuspend`, {
      method: 'PATCH',
    }),

  unbanFreelancer: (id: string) =>
    apiRequest<{ success: boolean; freelancer: Freelancer }>(`/freelancers/${id}/unban`, {
      method: 'PATCH',
    }),

  updateFreelancer: (
    id: string,
    data: { name?: string; phone?: string; emergencyName?: string; emergencyPhone?: string; username?: string },
  ) =>
    apiRequest<{ message: string; freelancer: Freelancer }>(`/freelancers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Orders
  getOrders: (type?: string, status?: string, search?: string, page = 1, limit = 10) => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    params.append('page', String(page));
    params.append('limit', String(limit));
    return apiRequest<PaginatedResponse<Order>>(`/orders?${params.toString()}`);
  },

  getOrderById: (id: string) => apiRequest<Order>(`/orders/${id}`),

  // Reports
  getReports: (status?: string, page = 1, limit = 10) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('page', String(page));
    params.append('limit', String(limit));
    return apiRequest<PaginatedResponse<Report>>(`/reports?${params.toString()}`);
  },

  validateReport: (id: string, note: string) =>
    apiRequest<{ message: string; report: Report }>(`/reports/${id}/validate`, {
      method: 'PATCH',
      body: JSON.stringify({ adminNote: note }),
    }),

  invalidateReport: (id: string, note: string) =>
    apiRequest<{ message: string; report: Report }>(`/reports/${id}/invalidate`, {
      method: 'PATCH',
      body: JSON.stringify({ adminNote: note }),
    }),

  // Broadcast
  broadcast: (target: 'all' | 'freelancers', message: string) =>
    apiRequest<{ message: string; count: number }>('/broadcast', {
      method: 'POST',
      body: JSON.stringify({ target, message }),
    }),
};

export function getMediaUrl(path: string | null): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const baseUrl = API_URL.replace(/\/api$/, '');
  return `${baseUrl}${path}`;
}
