import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import { extractFrappeError } from '@/lib/errors';

export default function Login() {
  const { t } = useTranslation(['common', 'pages']);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const fromLocation = (location.state as { from?: { pathname: string } })?.from;
  const redirectTo = fromLocation?.pathname || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    document.title = `${t('auth.login')} — ${t('app_name')}`;
  }, [t]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo]);

  const validateEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError(t('pages:login.errors.email_required'));
      return;
    }
    if (!validateEmail(email)) {
      setError(t('pages:login.errors.email_invalid'));
      return;
    }
    if (!password) {
      setError(t('pages:login.errors.password_required'));
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      // Full reload — guarantees AuthContext re-runs verify() on mount and
      // the new session cookie is honored. Avoids a stale React state
      // race where navigate() fires before refreshUser's setState has
      // committed, leaving us stuck on /login.
      window.location.replace(redirectTo);
    } catch (err: unknown) {
      const message = extractFrappeError(err);
      if (message.toLowerCase().includes('disabled')) {
        setError(t('pages:login.errors.account_disabled'));
      } else if (
        message.toLowerCase().includes('invalid') ||
        message.toLowerCase().includes('incorrect')
      ) {
        setError(t('pages:login.errors.invalid_credentials'));
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-alabaster">
      {/* Left branding panel */}
      <div
        className="hidden md:flex md:w-1/2 lg:w-[55%] text-white flex-col justify-between p-10 lg:p-14 relative overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(26,47,35,0.85) 0%, rgba(26,47,35,0.95) 100%), url('/images/hero.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Gold ambient glows */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />

        {/* Top — logo / back link */}
        <div className="relative z-10 flex items-center justify-between">
          <Link
            to="/courses"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            {t('pages:login.back_to_courses')}
          </Link>
          <span className="text-[10px] uppercase tracking-[0.3em] text-primary/80 font-mono">
            est. 2026
          </span>
        </div>

        {/* Middle — hero copy */}
        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-4 h-4 text-primary" strokeWidth={1.5} />
            <span className="text-[11px] uppercase tracking-[0.3em] text-primary/90 font-medium">
              {t('tagline')}
            </span>
          </div>
          <h1 className="font-heading text-4xl lg:text-6xl leading-[1.05] mb-6">
            {t('pages:login.welcome')}
          </h1>
          <p className="text-white/65 leading-relaxed text-base lg:text-lg max-w-md">
            {t('pages:login.welcome_description')}
          </p>
        </div>

        {/* Bottom — credit strip */}
        <div className="relative z-10 flex items-center gap-6 text-xs text-white/40 border-t border-white/10 pt-6">
          <span>{t('pages:login.video_lessons')}</span>
          <span className="w-px h-3 bg-white/20" />
          <span>{t('pages:login.certificate_programs', { count: 4 })}</span>
          <span className="w-px h-3 bg-white/20" />
          <span>Addis Ababa</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative">
        {/* Subtle decorative element on right panel */}
        <div className="hidden lg:block absolute top-1/2 -translate-y-1/2 right-0 w-px h-1/2 bg-gradient-to-b from-transparent via-primary/15 to-transparent" />

        <div className="w-full max-w-sm">
          {/* Mobile branding */}
          <div className="md:hidden flex flex-col items-center mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-primary-dark" strokeWidth={1.5} />
              <span className="text-[10px] uppercase tracking-[0.3em] text-primary-dark font-medium">
                {t('app_name')}
              </span>
            </div>
            <h1 className="font-heading text-3xl text-dark">{t('tagline')}</h1>
          </div>

          <div className="mb-8">
            <h2 className="font-heading text-3xl sm:text-4xl text-dark mb-2 leading-tight">
              {t('pages:login.title')}
            </h2>
            <p className="text-dark/60">
              {t('pages:login.subtitle')}
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 transition-all">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-dark/80 mb-1.5"
              >
                {t('auth.email')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark/40" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.email')}
                  autoComplete="email"
                  className="w-full rounded-lg border border-dark/10 bg-white py-3 pl-10 pr-4 text-dark placeholder:text-dark/30 transition-all focus:border-primary-dark focus:ring-4 focus:ring-primary/15 outline-none shadow-sm hover:border-dark/20"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-dark/80 mb-1.5"
              >
                {t('auth.password')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark/40" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.password')}
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-dark/10 bg-white py-3 pl-10 pr-11 text-dark placeholder:text-dark/30 transition-all focus:border-primary-dark focus:ring-4 focus:ring-primary/15 outline-none shadow-sm hover:border-dark/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark/40 hover:text-dark/70 transition-colors"
                  aria-label={showPassword ? t('auth.hide_password') : t('auth.show_password')}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                {t('auth.forgot_password')}
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-dark py-3 text-white font-semibold tracking-wide transition-all hover:bg-dark-light hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('auth.logging_in')}
                </>
              ) : (
                <>
                  {t('auth.login')}
                  <span className="text-primary-light group-hover:translate-x-0.5 transition-transform">&rarr;</span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-8 flex items-center gap-4">
            <span className="flex-1 h-px bg-dark/10" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-dark/40">
              {t('auth.or')}
            </span>
            <span className="flex-1 h-px bg-dark/10" />
          </div>

          <p className="text-center text-sm text-dark/60">
            {t('auth.dont_have_account')}{' '}
            <Link
              to="/register"
              className="text-primary-dark font-semibold hover:text-dark transition-colors underline-offset-2 hover:underline"
            >
              {t('auth.register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
