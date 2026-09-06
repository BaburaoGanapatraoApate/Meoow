export interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  usersWithCredits: number;
  unlimitedUsers: number;
  usersWithOverrides: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  credits: number;
  usageMode: 'credits' | 'unlimited';
  role: 'user' | 'admin';
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  hasGroqOverride: boolean;
  hasDeepgramOverride: boolean;
}

export interface AdminAuditLog {
  id: string;
  action: string;
  provider: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  adminEmail: string | null;
  targetEmail: string | null;
}

export interface UserProviderStatus {
  userId: string;
  hasGroqOverride: boolean;
  hasDeepgramOverride: boolean;
  usageMode: 'credits' | 'unlimited';
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminApiError extends Error {
  status?: number;
  code?: string;
}

const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname.includes('meooow.tech')) {
    return 'https://api.meooow.tech';
  }
  return import.meta.env.PROD ? 'https://api.meooow.tech' : 'http://localhost:4000';
};

const API_BASE_URL = getApiBaseUrl();

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  let data: any = null;
  if (isJson) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMessage =
      (isJson && (data?.message || data?.error)) ||
      (typeof data === 'string' && data) ||
      `Request failed with status ${response.status}`;

    const error = new Error(errorMessage) as AdminApiError;
    error.status = response.status;
    error.code = data?.error;
    throw error;
  }

  return data as T;
}

export const adminApi = {
  async getStats(token: string): Promise<AdminStats> {
    const response = await fetch(`${API_BASE_URL}/api/admin/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    return await handleResponse<AdminStats>(response);
  },

  async getUsers(
    token: string,
    params: { limit?: number; offset?: number; search?: string } = {}
  ): Promise<AdminUsersResponse> {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    if (params.search) query.set('search', params.search.trim());

    const response = await fetch(`${API_BASE_URL}/api/admin/users?${query.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    return await handleResponse<AdminUsersResponse>(response);
  },

  async getUser(token: string, userId: string): Promise<{ user: AdminUser; providerStatus: UserProviderStatus }> {
    const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    return await handleResponse<{ user: AdminUser; providerStatus: UserProviderStatus }>(response);
  },

  async assignProviderOverrides(
    token: string,
    userId: string,
    data: { groqApiKey?: string; deepgramApiKey?: string }
  ): Promise<{ success: boolean; message: string; providerStatus: UserProviderStatus }> {
    const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/provider-overrides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return await handleResponse<{ success: boolean; message: string; providerStatus: UserProviderStatus }>(response);
  },

  async removeProviderOverrides(
    token: string,
    userId: string
  ): Promise<{ success: boolean; message: string; providerStatus: UserProviderStatus }> {
    const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/provider-overrides`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    return await handleResponse<{ success: boolean; message: string; providerStatus: UserProviderStatus }>(response);
  },

  async updateUsageMode(
    token: string,
    userId: string,
    usageMode: 'credits' | 'unlimited'
  ): Promise<{ success: boolean; message: string; usageMode: 'credits' | 'unlimited' }> {
    const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/usage-mode`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ usageMode }),
    });
    return await handleResponse<{ success: boolean; message: string; usageMode: 'credits' | 'unlimited' }>(response);
  },

  async getAuditLogs(token: string, limit: number = 50): Promise<{ logs: AdminAuditLog[] }> {
    const response = await fetch(`${API_BASE_URL}/api/admin/audit-logs?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    return await handleResponse<{ logs: AdminAuditLog[] }>(response);
  },
};

