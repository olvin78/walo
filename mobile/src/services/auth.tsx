import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getAccessToken,
  getMe,
  login as apiLogin,
  loginWithGoogle as apiLoginWithGoogle,
  logout as apiLogout,
  register as apiRegister,
  type Me,
  type RegisterPayload,
} from './api';

type AuthContextValue = {
  user: Me | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  reloadUser: () => Promise<Me | null>;
  login: (loginValue: string, password: string) => Promise<Me>;
  loginWithGoogle: (idToken: string) => Promise<Me>;
  register: (payload: RegisterPayload) => Promise<Me>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reloadUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      return null;
    }
    const me = await getMe();
    setUser(me);
    return me;
  }, []);

  useEffect(() => {
    reloadUser()
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, [reloadUser]);

  const handleLogin = useCallback(async (loginValue: string, password: string) => {
    const response = await apiLogin(loginValue, password);
    setUser(response.user);
    return response.user;
  }, []);

  const handleLoginWithGoogle = useCallback(async (idToken: string) => {
    const response = await apiLoginWithGoogle(idToken);
    setUser(response.user);
    return response.user;
  }, []);

  const handleRegister = useCallback(async (payload: RegisterPayload) => {
    const response = await apiRegister(payload);
    setUser(response.user);
    return response.user;
  }, []);

  const handleLogout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      reloadUser,
      login: handleLogin,
      loginWithGoogle: handleLoginWithGoogle,
      register: handleRegister,
      logout: handleLogout,
    }),
    [handleLogin, handleLoginWithGoogle, handleLogout, handleRegister, isLoading, reloadUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
