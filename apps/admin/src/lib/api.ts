import { getToken } from './auth';
import type { DashboardStats, PricingConfig } from '@printforge/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth
  login: async (email: string, password?: string, useMagicLink?: boolean) => {
    return fetchApi<{ token: string; user?: { id: string; email: string; role: string } } | { message: string }>('/v1/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, useMagicLink }),
    });
  },

  verifyMagicLink: async (token: string) => {
    return fetchApi<{ token: string; user: { id: string; email: string; role: string } }>('/v1/admin/verify-magic-link', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  getMe: async () => {
    return fetchApi<{
      id: string;
      email: string;
      role: string;
      lastLoginAt: string;
      shop: { id: string; name: string; domain: string };
    }>('/v1/admin/me');
  },

  // Submissions
  getSubmissions: async (filters: {
    status?: string;
    material?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.material) params.set('material', filters.material);
    if (filters.search) params.set('search', filters.search);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));

    return fetchApi<{
      submissions: Array<{
        id: string;
        customerName: string;
        customerEmail: string;
        material: string;
        colour: string;
        quantity: number;
        quality: string;
        fileName: string;
        fileSize: number;
        priceEstimateLow: number | null;
        priceEstimateHigh: number | null;
        status: string;
        createdAt: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        totalCount: number;
        totalPages: number;
      };
    }>(`/v1/admin/submissions?${params}`);
  },

  getSubmission: async (id: string) => {
    return fetchApi<{
      id: string;
      customerName: string;
      customerEmail: string;
      customerPhone: string | null;
      notes: string | null;
      material: string;
      colour: string;
      quantity: number;
      quality: string;
      infill: number;
      fileKey: string;
      fileName: string;
      fileSize: number;
      boundingBox: { x: number; y: number; z: number } | null;
      filamentGrams: number | null;
      printTimeSeconds: number | null;
      priceEstimateLow: number | null;
      priceEstimateHigh: number | null;
      status: string;
      createdAt: string;
      updatedAt: string;
      downloadUrl: string;
    }>(`/v1/admin/submissions/${id}`);
  },

  updateSubmissionStatus: async (id: string, status: string, notes?: string) => {
    return fetchApi<{ success: boolean }>(`/v1/admin/submissions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    });
  },

  deleteSubmission: async (id: string) => {
    return fetchApi<{ success: boolean }>(`/v1/admin/submissions/${id}`, {
      method: 'DELETE',
    });
  },

  // Pricing
  getPricing: async () => {
    return fetchApi<PricingConfig>('/v1/admin/pricing');
  },

  updatePricing: async (config: Partial<PricingConfig>) => {
    return fetchApi<PricingConfig>('/v1/admin/pricing', {
      method: 'PATCH',
      body: JSON.stringify(config),
    });
  },

  // Stats
  getStats: async (from?: string, to?: string, period?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (period) params.set('period', period);

    return fetchApi<DashboardStats>(`/v1/admin/stats?${params}`);
  },

  // Shop
  updateShop: async (data: { name?: string; ownerEmail?: string }) => {
    return fetchApi<{ success: boolean }>('/v1/admin/shop', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};
