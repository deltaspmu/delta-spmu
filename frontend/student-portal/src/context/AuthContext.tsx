import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import api from '../api/client';
import type { User } from '../types';

const STORAGE_KEY = 'deltaspmu_user';
const ADMIN_USERS = ['Administrator', 'administrator@deltaspmu.com'];

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, fullName: string, password: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function persistUser(user: User | null) {
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function loadPersistedUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadPersistedUser);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;
  const isAdmin =
    !!user &&
    (ADMIN_USERS.includes(user.name) ||
      ADMIN_USERS.includes(user.email) ||
      user.roles.includes('System Manager'));

  // ---------------------------------------------------------------------------
  // Refresh the current user from the server
  // ---------------------------------------------------------------------------
  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/api/method/lms.lms.api.get_user_info');
      const userData = res.data?.message as User | null;
      if (userData && userData.name) {
        setUser(userData);
        persistUser(userData);
      } else {
        setUser(null);
        persistUser(null);
      }
    } catch {
      setUser(null);
      persistUser(null);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // On mount: verify session is still valid
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function verify() {
      try {
        const res = await api.get('/api/method/lms.lms.api.get_user_info');
        const userData = res.data?.message as User | null;
        if (!cancelled) {
          if (userData && userData.name && userData.name !== 'Guest') {
            setUser(userData);
            persistUser(userData);
          } else {
            setUser(null);
            persistUser(null);
          }
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          persistUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Admin redirect — System Managers belong on the admin portal, not the
  // student portal. We send them to admin.deltaspmu.com (overridable via
  // VITE_ADMIN_PORTAL_URL).
  //
  // Previous bug: redirected to "/app" assuming we were on the same origin
  // as Frappe Desk, but on Vercel that path 404s and the SPA catch-all sent
  // them back to /courses, which then triggered this redirect again →
  // infinite glitch loop.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;
    const skipRedirect = import.meta.env.VITE_SKIP_ADMIN_REDIRECT === 'true';
    if (skipRedirect) return;

    const isAdmin =
      ADMIN_USERS.includes(user.name) ||
      ADMIN_USERS.includes(user.email) ||
      user.roles.includes('System Manager');
    if (!isAdmin) return;

    const adminUrl =
      import.meta.env.VITE_ADMIN_PORTAL_URL || 'https://admin.deltaspmu.com';

    // Don't redirect if we're already on the admin portal (which would
    // re-trigger when the user navigates back here on purpose).
    if (window.location.origin === adminUrl) return;

    window.location.href = adminUrl;
  }, [user]);

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------
  const login = useCallback(
    async (email: string, password: string) => {
      await api.post('/api/method/login', { usr: email, pwd: password });
      await refreshUser();
    },
    [refreshUser]
  );

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------
  const logout = useCallback(async () => {
    try {
      await api.get('/api/method/logout');
    } finally {
      setUser(null);
      persistUser(null);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------------------
  const register = useCallback(async (email: string, fullName: string, password: string) => {
    await api.post('/api/method/frappe.core.doctype.user.user.sign_up', {
      email,
      full_name: fullName,
      password,
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------
  const value: AuthContextValue = {
    user,
    isAuthenticated,
    isAdmin,
    isLoading,
    login,
    logout,
    register,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export default AuthContext;
