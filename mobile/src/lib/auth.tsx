import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, setAuthToken, setUnauthorizedHandler } from './api';
import { tokenStorage } from './storage';
import type { AuthResponse, User } from './types';

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
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
      login: async (email, password) => accept(await api.login({ email, password })),
      register: async (data) => accept(await api.register(data)),
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
