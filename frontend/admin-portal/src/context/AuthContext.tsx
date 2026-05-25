import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import axios from 'axios';
import type { User } from '../types';

// ---------------------------------------------------------------------------
// API instance
// ---------------------------------------------------------------------------
const API_BASE_URL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL || 'https://api.deltaspmu.com');

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Cross-origin CSRF token (cached)
// ---------------------------------------------------------------------------
let cachedToken: string | null = null;

async function getCSRFToken(): Promise<string> {
  if (!cachedToken) {
    const response = await api.get('/api/method/lms.lms.api.get_csrf_token');
    cachedToken = response.data.message;
  }
  return cachedToken!;
}

// CSRF interceptor — uses cached cross-origin token
api.interceptors.request.use(async (config) => {
  if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
    try {
      const token = await getCSRFToken();
      config.headers['X-Frappe-CSRF-Token'] = token;
    } catch {
      // If token fetch fails, try cookie fallback
      const cookieToken = document.cookie
        .split('; ')
        .find((row) => row.startsWith('csrf_token='))
        ?.split('=')[1];
      if (cookieToken) {
        config.headers['X-Frappe-CSRF-Token'] = decodeURIComponent(cookieToken);
      }
    }
  }
  return config;
});

// Session expiry handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      cachedToken = null;
      localStorage.removeItem(STORAGE_KEY);
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    // Reset CSRF cache on 403 (token may have expired)
    if (error.response?.status === 403) {
      cachedToken = null;
    }
    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'deltaspmu_admin_user';
const ADMIN_ROLES = ['System Manager'];
const ADMIN_USERS = ['Administrator', 'administrator@deltaspmu.com'];

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------
interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  accessDenied: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  api: typeof api;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isUserAdmin(user: User): boolean {
  return (
    ADMIN_USERS.includes(user.name) ||
    ADMIN_USERS.includes(user.email) ||
    user.roles.some((role) => ADMIN_ROLES.includes(role))
  );
}

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

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadPersistedUser);
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const isAuthenticated = !!user;
  const isAdmin = !!user && isUserAdmin(user);

  // -------------------------------------------------------------------------
  // Refresh user
  // -------------------------------------------------------------------------
  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/api/method/lms.lms.api.get_user_info');
      const userData = res.data?.message as User | null;
      if (userData && userData.name && userData.name !== 'Guest') {
        if (isUserAdmin(userData)) {
          setUser(userData);
          persistUser(userData);
          setAccessDenied(false);
        } else {
          setUser(userData);
          persistUser(userData);
          setAccessDenied(true);
        }
      } else {
        setUser(null);
        persistUser(null);
        setAccessDenied(false);
      }
    } catch {
      setUser(null);
      persistUser(null);
      setAccessDenied(false);
    }
  }, []);

  // -------------------------------------------------------------------------
  // On mount: verify session
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function verify() {
      try {
        const res = await api.get('/api/method/lms.lms.api.get_user_info');
        const userData = res.data?.message as User | null;
        if (!cancelled) {
          if (userData && userData.name && userData.name !== 'Guest') {
            if (isUserAdmin(userData)) {
              setUser(userData);
              persistUser(userData);
              setAccessDenied(false);
            } else {
              setUser(userData);
              persistUser(userData);
              setAccessDenied(true);
            }
          } else {
            setUser(null);
            persistUser(null);
            setAccessDenied(false);
          }
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          persistUser(null);
          setAccessDenied(false);
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

  // -------------------------------------------------------------------------
  // Login
  // -------------------------------------------------------------------------
  const login = useCallback(
    async (email: string, password: string) => {
      // Reset cached CSRF token on new login
      cachedToken = null;
      await api.post('/api/method/login', { usr: email, pwd: password });
      await refreshUser();
    },
    [refreshUser]
  );

  // -------------------------------------------------------------------------
  // Logout
  // -------------------------------------------------------------------------
  const logout = useCallback(async () => {
    try {
      await api.get('/api/method/logout');
    } finally {
      cachedToken = null;
      setUser(null);
      persistUser(null);
      setAccessDenied(false);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------
  const value: AuthContextValue = {
    user,
    isAuthenticated,
    isAdmin,
    isLoading,
    accessDenied,
    login,
    logout,
    refreshUser,
    api,
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
