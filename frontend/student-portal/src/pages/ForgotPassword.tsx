import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { forgotPassword } from '@/api/client';

export default function ForgotPassword() {

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  useEffect(() => {
    document.title = 'Forgot Password — Delta SPMU Academy';
  }, []);

  const validateEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      await forgotPassword(email);
      setIsSent(true);
    } catch {
      // Always show success to avoid leaking whether the email exists
      setIsSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-alabaster px-6">
      <div className="w-full max-w-md">
        {isSent ? (
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <h1 className="font-heading text-3xl text-dark mb-3">
              Check Your Email
            </h1>
            <p className="text-dark/60 mb-8">
              If an account exists with that email, a reset link has been sent.
              Please check your inbox and follow the instructions.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-primary font-medium hover:text-primary/80 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm text-dark/50 hover:text-dark/80 transition-colors mb-8"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Link>

            <h1 className="font-heading text-3xl text-dark mb-2">
              Forgot Password
            </h1>
            <p className="text-dark/60 mb-8">
              Enter your email and we'll send you a reset link.
            </p>

            {error && (
              <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 transition-all">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-dark/80 mb-1.5"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark/40" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full rounded-lg border border-dark/10 bg-white py-2.5 pl-10 pr-4 text-dark placeholder:text-dark/30 transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-primary py-2.5 text-dark font-medium transition-all hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
