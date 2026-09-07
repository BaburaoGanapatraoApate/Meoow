export interface DeviceInfo {
  id: string;
  deviceId: string;
  deviceName: string;
  platform: string;
  osVersion: string | null;
  appVersion: string | null;
  status?: string;
  lastSeenAt: string;
  createdAt: string;
  replacementCount?: number;
}

export interface RegisterDeviceResponse {
  success: boolean;
  status: "active" | "limit_exceeded" | "token_mismatch";
  message: string;
  deviceId: string;
  maxDevices?: number;
  activeCount?: number;
  activeDevices?: DeviceInfo[];
}

export interface DeviceListResponse {
  success: boolean;
  devices: DeviceInfo[];
  maxDevices: number;
  activeCount: number;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

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
      (isJson && data?.message) ||
      (isJson && data?.error) ||
      (typeof data === 'string' && data) ||
      `Request failed with status ${response.status}`;

    const error: any = new Error(errorMessage);
    error.status = response.status;
    error.code = data?.code || data?.error;
    error.data = data;
    throw error;
  }

  return data as T;
}

export const deviceApi = {
  async registerDevice(
    token: string,
    deviceData: {
      deviceId: string;
      deviceToken: string;
      deviceName?: string;
      platform?: string;
      osVersion?: string;
      appVersion?: string;
    }
  ): Promise<RegisterDeviceResponse> {
    const response = await fetch(`${API_BASE_URL}/api/devices/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(deviceData),
    });
    return await handleResponse<RegisterDeviceResponse>(response);
  },

  async checkDevice(
    token: string,
    deviceId: string,
    deviceToken: string
  ): Promise<{ valid: boolean; message?: string }> {
    const response = await fetch(`${API_BASE_URL}/api/devices/check`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Device-Id': deviceId,
        'X-Device-Token': deviceToken,
      },
    });
    return await handleResponse<{ valid: boolean; message?: string }>(response);
  },

  async listDevices(token: string): Promise<DeviceListResponse> {
    const response = await fetch(`${API_BASE_URL}/api/devices/list`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    return await handleResponse<DeviceListResponse>(response);
  },

  async revokeDevice(
    token: string,
    deviceId: string,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/devices/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ deviceId, reason }),
    });
    return await handleResponse<{ success: boolean; message: string }>(response);
  },

  async replaceDevice(
    token: string,
    revokeDeviceId: string,
    newDevice: {
      deviceId: string;
      deviceToken: string;
      deviceName?: string;
      platform?: string;
      osVersion?: string;
      appVersion?: string;
    }
  ): Promise<{ success: boolean; message: string; deviceId: string }> {
    const response = await fetch(`${API_BASE_URL}/api/devices/replace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ revokeDeviceId, newDevice }),
    });
    return await handleResponse<{ success: boolean; message: string; deviceId: string }>(response);
  },
};

