import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/endpoints';
import { setToken, setUserId, clearSession, getToken, getUserId } from '../api/client';

/**
 * Auth state backed by the FastAPI backend. The token (JWT) and user id live
 * in localStorage; guest mode stays available — route protection is only
 * active when NEXT_PUBLIC_ENFORCE_AUTH=true (see authConfig.ts).
 */
export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  onboardingCompletedAt: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthUser | null>;
  setUser: (user: AuthUser | null) => void;
}

function userFromBackend(payload: {
  user_id: string;
  email: string;
  name?: string;
  onboarding_complete?: boolean;
}): AuthUser {
  const full = (payload.name || '').trim();
  const parts = full ? full.split(/\s+/) : [];
  return {
    id: payload.user_id,
    firstName: parts[0] || 'Student',
    lastName: parts.slice(1).join(' '),
    email: payload.email,
    onboardingCompletedAt: payload.onboarding_complete ? new Date().toISOString() : null,
  };
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshSession = useCallback(async (): Promise<AuthUser | null> => {
    // Session = "we hold credentials". Verified against GET /auth/me when the
    // backend is reachable; otherwise the stored id keeps guest flows working.
    const token = getToken();
    const uid = getUserId();
    if (!token && !uid) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const me = await authApi.me();
      const u = userFromBackend(me);
      setUserId(u.id);
      setUser(u);
      setLoading(false);
      return u;
    } catch {
      if (token) {
        // A real token that the backend rejected: treat as signed out.
        clearSession();
        setUser(null);
        setLoading(false);
        return null;
      }
      // Dev X-User-Id fallback with no backend: keep the local session usable.
      const local = uid
        ? ({ id: uid, firstName: 'Student', lastName: '', email: '', onboardingCompletedAt: null } as AuthUser)
        : null;
      setUser(local);
      setLoading(false);
      return local;
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const logout = async () => {
    clearSession();
    setUser(null);
    window.location.href = '/';
  };

  const signIn = useCallback((issue: { user_id: string; email: string; token: string },
                             name: string, onboardingComplete: boolean) => {
    setToken(issue.token);
    setUserId(issue.user_id);
    const u = userFromBackend({ user_id: issue.user_id, email: issue.email, name,
                                onboarding_complete: onboardingComplete });
    setUser(u);
    return u;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshSession, setUser }}>
      {children}
      {/* exposed for pages via AuthIssue helper below */}
      <AuthSignInHelper.Context.Provider value={signIn}>
        {null}
      </AuthSignInHelper.Context.Provider>
    </AuthContext.Provider>
  );
};

/**
 * Small helper so Login/Signup pages can persist a successful auth issue
 * without widening the public context shape everywhere.
 */
const AuthSignInContext = createContext<
  ((issue: { user_id: string; email: string; token: string }, name: string,
    onboardingComplete: boolean) => AuthUser) | undefined
>(undefined);

export const AuthSignInHelper = {
  Context: AuthSignInContext,
  useSignIn() {
    const ctx = useContext(AuthSignInContext);
    if (!ctx) throw new Error('AuthSignInHelper.useSignIn requires AuthProvider');
    return ctx;
  },
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
