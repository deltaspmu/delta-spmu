import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle } from 'lucide-react';
import { verifyEmail } from '@/api/client';
import { extractFrappeError } from '@/lib/errors';

type Status = 'loading' | 'success' | 'error' | 'invalid';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const key = searchParams.get('key');

  const [status, setStatus] = useState<Status>(key ? 'loading' : 'invalid');
  const [errorMessage, setErrorMessage] = useState('');

  const verify = useCallback(async (verificationKey: string) => {
    setStatus('loading');
    try {
      await verifyEmail(verificationKey);
      setStatus('success');
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(extractFrappeError(err));
    }
  }, []);

  useEffect(() => {
    document.title = 'Verify Email — Delta SPMU Academy';
  }, []);

  useEffect(() => {
    if (key) {
      verify(key);
    }
  }, [key, verify]);

  // Invalid — no key
  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-alabaster px-6">
        <div className="w-full max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-red-500 text-2xl font-bold">!</span>
            </div>
          </div>
          <h1 className="font-heading text-3xl text-dark mb-3">
            Invalid Verification Link
          </h1>
          <p className="text-dark/60 mb-8">
            This email verification link is invalid. Please check your email for
            the correct link or request a new one.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-dark font-medium transition-all hover:bg-primary/90"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // Loading
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-alabaster px-6">
        <div className="w-full max-w-md text-center">
          <div className="flex justify-center mb-6">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
          </div>
          <h1 className="font-heading text-2xl text-dark">
            Verifying your email...
          </h1>
          <p className="text-dark/50 mt-2">Please wait a moment.</p>
        </div>
      </div>
    );
  }

  // Success
  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-alabaster px-6">
        <div className="w-full max-w-md text-center">
          <div className="flex justify-center mb-6">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <h1 className="font-heading text-3xl text-dark mb-3">
            Email Verified!
          </h1>
          <p className="text-dark/60 mb-8">
            Your email has been verified successfully. You can now log in to
            your account.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-dark font-medium transition-all hover:bg-primary/90"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // Error
  return (
    <div className="min-h-screen flex items-center justify-center bg-alabaster px-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
            <span className="text-red-500 text-2xl font-bold">!</span>
          </div>
        </div>
        <h1 className="font-heading text-3xl text-dark mb-3">
          Verification Failed
        </h1>
        <p className="text-dark/60 mb-8">
          {errorMessage || 'The verification link may have expired or is invalid.'}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => key && verify(key)}
            className="rounded-lg bg-primary px-6 py-2.5 text-dark font-medium transition-all hover:bg-primary/90"
          >
            Try Again
          </button>
          <Link
            to="/login"
            className="text-sm text-primary font-medium hover:text-primary/80 transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
