export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  credits: number;
  usageMode?: "credits" | "unlimited";
  role?: "user" | "admin";
  status?: string;
  createdAt?: string;
}

export interface AuthSuccessResponse {
  token: string;
  user: AuthUser;
  message?: string;
}

export interface RegisterSuccessResponse {
  userId: string;
  email: string;
  message: string;
  requiresVerification: boolean;
}

export interface ResendOtpSuccessResponse {
  message: string;
}

export interface ApiError {
  error: string;
  requiresVerification?: boolean;
  email?: string;
  code?: string;
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
      (isJson && data?.error) ||
      (isJson && (data?.message || data?.error)) ||
      (typeof data === 'string' && data) ||
      `Request failed with status ${response.status}`;

    const error: any = new Error(errorMessage);
    error.status = response.status;
    error.requiresVerification = data?.requiresVerification;
    error.email = data?.email;
    error.code = data?.code;
    throw error;
  }

  return data as T;
}

export const authApi = {
  async register(name: string, email: string, password: string): Promise<RegisterSuccessResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      return await handleResponse<RegisterSuccessResponse>(response);
    } catch (err: any) {
      if (!err.status) {
        throw new Error('Unable to connect to Meoow authentication server. Please check your connection.');
      }
      throw err;
    }
  },

  async verifyEmail(email: string, otp: string): Promise<AuthSuccessResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      return await handleResponse<AuthSuccessResponse>(response);
    } catch (err: any) {
      if (!err.status) {
        throw new Error('Unable to connect to Meoow authentication server. Please check your connection.');
      }
      throw err;
    }
  },

  async resendOtp(email: string): Promise<ResendOtpSuccessResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      return await handleResponse<ResendOtpSuccessResponse>(response);
    } catch (err: any) {
      if (!err.status) {
        throw new Error('Unable to connect to Meoow authentication server. Please check your connection.');
      }
      throw err;
    }
  },

  async login(email: string, password: string): Promise<AuthSuccessResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return await handleResponse<AuthSuccessResponse>(response);
    } catch (err: any) {
      if (!err.status) {
        throw new Error('Unable to connect to Meoow authentication server. Please check your connection.');
      }
      throw err;
    }
  },

  async getMe(token: string): Promise<AuthUser> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      return await handleResponse<AuthUser>(response);
    } catch (err: any) {
      if (!err.status) {
        throw new Error('Unable to connect to Meoow authentication server. Please check your connection.');
      }
      throw err;
    }
  },

  async logout(token?: string): Promise<{ message: string }> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers,
      });
      return await handleResponse<{ message: string }>(response);
    } catch {
      return { message: 'Logged out locally.' };
    }
  },
};

