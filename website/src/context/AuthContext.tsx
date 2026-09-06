import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, authApi } from '../services/authApi';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  unverifiedEmail: string | null;
  setUnverifiedEmail: (email: string | null) => void;
  setAuthSession: (token: string, user: AuthUser) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'meoow_web_auth_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const userData = await authApi.getMe(token);
      setUser(userData);
    } catch {
      // If token expired or invalid, clear session
      try {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      } catch {}
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const setAuthSession = useCallback((newToken: string, newUser: AuthUser) => {
    try {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    } catch {}
    setToken(newToken);
    setUser(newUser);
    setUnverifiedEmail(null);
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await authApi.logout(token);
      } catch {}
    }
    try {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {}
    setToken(null);
    setUser(null);
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        unverifiedEmail,
        setUnverifiedEmail,
        setAuthSession,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

