import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, setAuthToken, setUnauthorizedHandler } from './api';
import { tokenStorage } from './storage';
import type { AuthResponse, User } from './types';

export interface RegisterInput {
  name: string;
  phone: string;
  password: string;
  apartmentName: string;
  email?: string;
  /** From the SMS code check: proves this caller verified the phone. */
  signupToken: string;
}

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  updateProfile: (data: { name?: string; apartmentName?: string; email?: string; language?: 'ko' | 'en' }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    await tokenStorage.clear();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void logout());
    (async () => {
      try {
        const token = await tokenStorage.get();
        if (token) {
          setAuthToken(token);
          setUser(await api.me());
        }
      } catch {
        await logout();
      } finally {
        setReady(true);
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const accept = useCallback(async (res: AuthResponse) => {
    setAuthToken(res.accessToken);
    await tokenStorage.set(res.accessToken);
    setUser(res.user);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      login: async (phone, password) => accept(await api.login({ phone, password })),
      register: async (data) => accept(await api.register(data)),
      updateProfile: async (data) => setUser(await api.updateProfile(data)),
      logout,
    }),
    [user, ready, accept, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
