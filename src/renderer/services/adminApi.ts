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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://api.meooow.tech').replace(/\/+$/, '');

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

    const error: any = new Error(errorMessage);
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
  ): Promise<{ users: AdminUser[]; total: number; limit: number; offset: number }> {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    if (params.search) query.set('search', params.search);

    const response = await fetch(`${API_BASE_URL}/api/admin/users?${query.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    return await handleResponse<{ users: AdminUser[]; total: number; limit: number; offset: number }>(response);
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
    userId: string,
    provider?: 'groq' | 'deepgram'
  ): Promise<{ success: boolean; message: string; providerStatus: UserProviderStatus }> {
    const url = provider
      ? `${API_BASE_URL}/api/admin/users/${userId}/provider-override/${provider}`
      : `${API_BASE_URL}/api/admin/users/${userId}/provider-overrides`;

    const response = await fetch(url, {
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
  ): Promise<{ success: boolean; message: string; usageMode: string }> {
    const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/usage-mode`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ usageMode }),
    });
    return await handleResponse<{ success: boolean; message: string; usageMode: string }>(response);
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

