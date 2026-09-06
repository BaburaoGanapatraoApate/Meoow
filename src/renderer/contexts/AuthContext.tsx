import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, AuthUser, RegisterSuccessResponse, ResendOtpSuccessResponse } from '../services/authApi';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<RegisterSuccessResponse>;
  verifyEmail: (email: string, otp: string) => Promise<void>;
  resendOtp: (email: string) => Promise<ResendOtpSuccessResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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
            }
          } catch (err) {
            console.warn('[AuthContext] Stored token invalid or expired. Resetting session.');
            await window.meow?.clearAuthToken?.();
            if (isMounted) {
              setToken(null);
              setUser(null);
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
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    return await authApi.register(name, email, password);
  }, []);

  const verifyEmail = useCallback(async (email: string, otp: string) => {
    const res = await authApi.verifyEmail(email, otp);
    await window.meow?.setAuthToken?.(res.token);
    setToken(res.token);
    setUser(res.user);
  }, []);

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
    login,
    register,
    verifyEmail,
    resendOtp,
    logout,
    refreshUser,
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

