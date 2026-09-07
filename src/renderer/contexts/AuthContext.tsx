import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, AuthUser, RegisterSuccessResponse, ResendOtpSuccessResponse } from '../services/authApi';
import { deviceApi, DeviceInfo } from '../services/deviceApi';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  deviceLimitExceeded: boolean;
  activeDevices: DeviceInfo[];
  maxDevices: number;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<RegisterSuccessResponse>;
  verifyEmail: (email: string, otp: string) => Promise<void>;
  resendOtp: (email: string) => Promise<ResendOtpSuccessResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  syncDevice: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [deviceLimitExceeded, setDeviceLimitExceeded] = useState<boolean>(false);
  const [activeDevices, setActiveDevices] = useState<DeviceInfo[]>([]);
  const [maxDevices, setMaxDevices] = useState<number>(2);

  const syncDevice = useCallback(async (overrideToken?: string) => {
    const currentToken = overrideToken || token;
    if (!currentToken) return;

    try {
      const identity = await window.meow?.getDeviceIdentity?.();
      if (!identity) return;

      try {
        const res = await deviceApi.registerDevice(currentToken, identity);
        if (res.status === 'active') {
          setDeviceLimitExceeded(false);
          setActiveDevices([]);
        }
      } catch (err: any) {
        if (err?.code === 'DEVICE_LIMIT_EXCEEDED' || err?.status === 403) {
          const list = err.data?.activeDevices || [];
          const limit = err.data?.maxDevices || 2;
          setActiveDevices(list);
          setMaxDevices(limit);
          setDeviceLimitExceeded(true);
        } else if (err?.code === 'DEVICE_TOKEN_MISMATCH' || err?.status === 409) {
          try {
            const listRes = await deviceApi.listDevices(currentToken);
            setActiveDevices(listRes.devices.filter((d) => d.status === 'active'));
            setMaxDevices(listRes.maxDevices);
            setDeviceLimitExceeded(true);
          } catch {
            setDeviceLimitExceeded(true);
          }
        } else {
          console.warn('[AuthContext] Device registration warning (preserving session):', err?.message || err);
        }
      }
    } catch (err) {
      console.error('[AuthContext] Error acquiring device identity:', err);
    }
  }, [token]);

  // Initialize session on mount
  useEffect(() => {
    let isMounted = true;

    async function initAuthSession() {
      try {
        const storedToken = await window.meow?.getAuthToken?.();
        if (storedToken && storedToken.trim().length > 0) {
          try {
            const userProfile = await authApi.getMe(storedToken);
            if (isMounted) {
              setToken(storedToken);
              setUser(userProfile);
              syncDevice(storedToken);
            }
          } catch (err: any) {
            if (err?.status === 401 || err?.status === 403) {
              console.warn('[AuthContext] Stored token invalid or expired. Resetting session.');
              await window.meow?.clearAuthToken?.();
              if (isMounted) {
                setToken(null);
                setUser(null);
              }
            } else {
              // Network/temporary offline error: preserve stored auth!
              console.warn('[AuthContext] Temporary network failure verifying session. Preserving stored token:', err?.message || err);
              if (isMounted) {
                setToken(storedToken);
              }
            }
          }
        }
      } catch (err) {
        console.error('[AuthContext] Error initializing auth session:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initAuthSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    await window.meow?.setAuthToken?.(res.token);
    setToken(res.token);
    setUser(res.user);
    await syncDevice(res.token);
  }, [syncDevice]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    return await authApi.register(name, email, password);
  }, []);

  const verifyEmail = useCallback(async (email: string, otp: string) => {
    const res = await authApi.verifyEmail(email, otp);
    await window.meow?.setAuthToken?.(res.token);
    setToken(res.token);
    setUser(res.user);
    await syncDevice(res.token);
  }, [syncDevice]);

  const resendOtp = useCallback(async (email: string) => {
    return await authApi.resendOtp(email);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await authApi.logout(token);
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      await window.meow?.clearAuthToken?.();
      setToken(null);
      setUser(null);
      setDeviceLimitExceeded(false);
      setActiveDevices([]);
    }
  }, [token]);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const updatedProfile = await authApi.getMe(token);
      setUser(updatedProfile);
    } catch (err) {
      console.error('[AuthContext] Error refreshing user profile:', err);
    }
  }, [token]);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    deviceLimitExceeded,
    activeDevices,
    maxDevices,
    login,
    register,
    verifyEmail,
    resendOtp,
    logout,
    refreshUser,
    syncDevice,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
