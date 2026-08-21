import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { login, getUserInfo } from '@/api/client';
import { LogIn, AlertCircle } from 'lucide-react';
import { hasAdminAccess } from '@/utils/adminAccess';

const ADMIN_STORAGE_KEY = 'deltaspmu_admin_user';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: async () => {
      await login(email, password);
      const user = await getUserInfo();
      if (!hasAdminAccess(user)) {
        throw new Error('Access denied. Only System Managers can access the admin portal.');
      }
      return user;
    },
    onSuccess: (user) => {
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(user));
      // Full reload so AuthContext re-runs against the new session cookie.
      // Avoids the React-Router race where navigate() fires before the
      // new auth state has committed and the route guard sees us as
      // still-logged-out.
      window.location.replace('/');
    },
    onError: (err: any) => {
      const msg =
        err?.message ||
        err?.response?.data?.message ||
        'Invalid credentials. Please try again.';
      setError(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    loginMutation.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-alabaster px-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl font-bold text-dark">Delta SPMU</h1>
          <p className="text-sm text-gray-500 mt-1">Admin Portal</p>
        </div>

        {/* Login Card */}
        <div className="admin-card">
          <h2 className="font-heading text-xl font-semibold text-dark mb-6">Sign in to your account</h2>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email or Username
              </label>
              <input
                id="email"
                type="text"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-dark focus:border-transparent"
                placeholder="Administrator or your System Manager email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-dark focus:border-transparent"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-dark text-white py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-dark-light transition-colors disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Only System Manager accounts can access this portal.
        </p>
      </div>
    </div>
  );
}
