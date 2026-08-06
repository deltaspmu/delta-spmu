import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Phone, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { signUp } from '@/api/client';
import { extractFrappeError } from '@/lib/errors';

export default function Register() {
  const { t } = useTranslation(['common', 'pages']);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'success'>('form');

  // Resend cooldown
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    document.title = `${t('pages:register.title')} — ${t('app_name')}`;
  }, [t]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = () => {
    setResendCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const validateEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const validatePhone = (value: string) =>
    /^\+?[\d\s\-()]+$/.test(value) && value.replace(/\D/g, '').length >= 7;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError(t('pages:register.errors.name_required'));
      return;
    }
    if (!email.trim()) {
      setError(t('pages:register.errors.email_required'));
      return;
    }
    if (!validateEmail(email)) {
      setError(t('pages:register.errors.email_invalid'));
      return;
    }
    if (!phone.trim()) {
      setError(t('pages:register.errors.phone_required'));
      return;
    }
    if (!validatePhone(phone)) {
      setError(t('pages:register.errors.phone_invalid'));
      return;
    }
    if (!password) {
      setError(t('pages:register.errors.password_required'));
      return;
    }
    if (password.length < 8) {
      setError(t('pages:register.errors.password_length'));
      return;
    }

    setIsLoading(true);
    try {
      const result = await signUp(email, fullName, password, phone);

      // Frappe sign_up returns [code, message]
      // 0 = email already exists, 1 = verification sent, 2 = account created
      if (Array.isArray(result)) {
        const [code] = result as [number, string];
        if (code === 0) {
          setError(
            t('pages:register.errors.account_exists')
          );
          return;
        }
      }

      setStep('success');
      startCooldown();
    } catch (err: unknown) {
      setError(extractFrappeError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    try {
      await signUp(email, fullName, password, phone);
      startCooldown();
    } catch {
      // Silently handle — email may already have been resent
    } finally {
      setIsLoading(false);
    }
  };

  // Success step
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-alabaster px-6">
        <div className="w-full max-w-md text-center">
          <div className="flex justify-center mb-6">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <h1 className="font-heading text-3xl text-dark mb-3">
            {t('pages:register.success_title')}
          </h1>
          <p className="text-dark/60 mb-8">
            {t('pages:register.success_message', { email })}
          </p>

          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || isLoading}
            className="w-full rounded-lg bg-primary py-2.5 text-dark font-medium transition-all hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('pages:register.sending')}
              </>
            ) : resendCooldown > 0 ? (
              t('pages:register.resend_countdown', { seconds: resendCooldown })
            ) : (
              t('auth.resend_verification')
            )}
          </button>

          <Link
            to="/login"
            className="text-sm text-primary font-medium hover:text-primary/80 transition-colors"
          >
            {t('pages:register.back_to_login')}
          </Link>
        </div>
      </div>
    );
  }

  // Form step
  return (
    <div className="min-h-screen flex items-center justify-center bg-alabaster px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl text-dark mb-1">
            {t('pages:register.title')}
          </h1>
          <p className="text-dark/60">
            {t('pages:register.subtitle')}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 transition-all">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name */}
          <div>
            <label
              htmlFor="fullName"
              className="block text-sm font-medium text-dark/80 mb-1.5"
            >
              {t('auth.full_name')}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark/40" />
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('auth.full_name')}
                autoComplete="name"
                className="w-full rounded-lg border border-dark/10 bg-white py-2.5 pl-10 pr-4 text-dark placeholder:text-dark/30 transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
          </div>

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
                className="w-full rounded-lg border border-dark/10 bg-white py-2.5 pl-10 pr-4 text-dark placeholder:text-dark/30 transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-dark/80 mb-1.5"
            >
              {t('auth.phone')}
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark/40" />
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+251 91 234 5678"
                autoComplete="tel"
                className="w-full rounded-lg border border-dark/10 bg-white py-2.5 pl-10 pr-4 text-dark placeholder:text-dark/30 transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
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
                placeholder={t('auth.new_password')}
                autoComplete="new-password"
                className="w-full rounded-lg border border-dark/10 bg-white py-2.5 pl-10 pr-11 text-dark placeholder:text-dark/30 transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
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
            <p className="mt-1.5 text-xs text-dark/40">
              {t('pages:register.password_hint')}
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-primary py-2.5 text-dark font-medium transition-all hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('auth.registering')}
              </>
            ) : (
              t('pages:register.title')
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-dark/60">
          {t('auth.already_have_account')}{' '}
          <Link
            to="/login"
            className="text-primary font-medium hover:text-primary/80 transition-colors"
          >
            {t('auth.login')}
          </Link>
        </p>
      </div>
    </div>
  );
}
