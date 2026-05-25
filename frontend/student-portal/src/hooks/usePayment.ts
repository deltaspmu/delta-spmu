import { useState, useCallback, useEffect, useRef } from 'react';
import { initiatePayment, checkPaymentStatus } from '@/api/client';
import { useAuth } from '@/context/AuthContext';

type PaymentStatus = 'idle' | 'initiating' | 'polling' | 'success' | 'failed' | 'expired';

interface StoredTransaction {
  transactionId: string;
  courseId: string;
  amount?: number;
  currency?: string;
  paymentMethod: string;
  status: string;
  timestamp: string;
}

interface PendingPayment {
  transactionId: string;
  courseId: string;
  paymentMethod: string;
  checkoutUrl?: string;
  startedAt: string;
}

interface UsePaymentReturn {
  status: PaymentStatus;
  transactionId: string | null;
  checkoutUrl: string | null;
  error: string | null;
  startPayment: (
    courseId: string,
    paymentMethod: string,
    phone?: string,
    currency?: string
  ) => Promise<void>;
  clearPendingPayment: () => void;
  getTransactionHistory: () => StoredTransaction[];
}

const MAX_POLL_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 5000;
const MAX_HISTORY_ENTRIES = 50;

function getTransactionsKey(email: string): string {
  return `deltaspmu_transactions_${email}`;
}

function getPendingKey(email: string): string {
  return `deltaspmu_pending_payment_${email}`;
}

export function usePayment(): UsePaymentReturn {
  const { user } = useAuth();
  const userEmail = user?.email ?? '';

  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  // ---------------------------------------------------------------------------
  // localStorage helpers
  // ---------------------------------------------------------------------------
  const addTransactionToHistory = useCallback(
    (transaction: StoredTransaction) => {
      if (!userEmail) return;
      try {
        const key = getTransactionsKey(userEmail);
        const raw = localStorage.getItem(key);
        const history: StoredTransaction[] = raw ? JSON.parse(raw) : [];
        history.unshift(transaction);
        if (history.length > MAX_HISTORY_ENTRIES) {
          history.length = MAX_HISTORY_ENTRIES;
        }
        localStorage.setItem(key, JSON.stringify(history));
      } catch {
        // Silently ignore storage errors
      }
    },
    [userEmail]
  );

  const getTransactionHistory = useCallback((): StoredTransaction[] => {
    if (!userEmail) return [];
    try {
      const raw = localStorage.getItem(getTransactionsKey(userEmail));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, [userEmail]);

  const savePendingPayment = useCallback(
    (pending: PendingPayment) => {
      if (!userEmail) return;
      try {
        localStorage.setItem(getPendingKey(userEmail), JSON.stringify(pending));
      } catch {
        // Silently ignore
      }
    },
    [userEmail]
  );

  const clearPendingPayment = useCallback(() => {
    if (!userEmail) return;
    try {
      localStorage.removeItem(getPendingKey(userEmail));
    } catch {
      // Silently ignore
    }
  }, [userEmail]);

  const loadPendingPayment = useCallback((): PendingPayment | null => {
    if (!userEmail) return null;
    try {
      const raw = localStorage.getItem(getPendingKey(userEmail));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [userEmail]);

  // ---------------------------------------------------------------------------
  // Cleanup polling on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Poll payment status
  // ---------------------------------------------------------------------------
  const pollPaymentStatus = useCallback(
    (txId: string) => {
      // Clear any existing interval
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      pollCountRef.current = 0;
      setStatus('polling');

      pollIntervalRef.current = setInterval(async () => {
        pollCountRef.current += 1;

        if (pollCountRef.current > MAX_POLL_ATTEMPTS) {
          // 5-minute timeout
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setStatus('expired');
          setError('Payment verification timed out. Please check your transaction history.');
          clearPendingPayment();
          addTransactionToHistory({
            transactionId: txId,
            courseId: '',
            paymentMethod: '',
            status: 'expired',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        try {
          const result = (await checkPaymentStatus(txId)) as Record<string, unknown>;
          const paymentStatus = (result?.status as string)?.toLowerCase();

          if (paymentStatus === 'completed' || paymentStatus === 'paid') {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setStatus('success');
            clearPendingPayment();
            addTransactionToHistory({
              transactionId: txId,
              courseId: (result?.course as string) ?? '',
              amount: result?.amount as number,
              currency: result?.currency as string,
              paymentMethod: (result?.payment_method as string) ?? '',
              status: 'completed',
              timestamp: new Date().toISOString(),
            });
          } else if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setStatus('failed');
            setError(
              (result?.error_message as string) ?? 'Payment failed. Please try again.'
            );
            clearPendingPayment();
            addTransactionToHistory({
              transactionId: txId,
              courseId: (result?.course as string) ?? '',
              paymentMethod: (result?.payment_method as string) ?? '',
              status: 'failed',
              timestamp: new Date().toISOString(),
            });
          }
          // Otherwise keep polling (status is still pending/processing)
        } catch {
          // Network error during poll — keep trying until max attempts
        }
      }, POLL_INTERVAL_MS);
    },
    [clearPendingPayment, addTransactionToHistory]
  );

  // ---------------------------------------------------------------------------
  // Start payment
  // ---------------------------------------------------------------------------
  const startPayment = useCallback(
    async (
      courseId: string,
      paymentMethod: string,
      phone?: string,
      currency?: string
    ) => {
      setStatus('initiating');
      setError(null);
      setTransactionId(null);
      setCheckoutUrl(null);

      try {
        const result = (await initiatePayment(
          courseId,
          paymentMethod,
          phone,
          currency
        )) as Record<string, unknown>;

        const txId = result?.transaction_id as string;
        const url = result?.checkout_url as string | undefined;

        if (!txId) {
          throw new Error('No transaction ID returned from payment initiation.');
        }

        setTransactionId(txId);

        if (url) {
          setCheckoutUrl(url);
        }

        // Save pending payment to localStorage
        savePendingPayment({
          transactionId: txId,
          courseId,
          paymentMethod,
          checkoutUrl: url,
          startedAt: new Date().toISOString(),
        });

        // Open checkout URL if provided
        if (url) {
          window.open(url, '_blank');
        }

        // Start polling
        pollPaymentStatus(txId);
      } catch (err: unknown) {
        setStatus('failed');
        const message =
          err instanceof Error ? err.message : 'Payment initiation failed.';
        setError(message);
      }
    },
    [savePendingPayment, pollPaymentStatus]
  );

  // ---------------------------------------------------------------------------
  // Recover pending payment on mount
  // ---------------------------------------------------------------------------
  const recoverPendingPayment = useCallback(() => {
    const pending = loadPendingPayment();
    if (!pending) return;

    // Check if the pending payment is older than 5 minutes
    const startedAt = new Date(pending.startedAt).getTime();
    const fiveMinutes = MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS;
    if (Date.now() - startedAt > fiveMinutes) {
      clearPendingPayment();
      return;
    }

    setTransactionId(pending.transactionId);
    setCheckoutUrl(pending.checkoutUrl ?? null);
    pollPaymentStatus(pending.transactionId);
  }, [loadPendingPayment, clearPendingPayment, pollPaymentStatus]);

  useEffect(() => {
    if (userEmail) {
      recoverPendingPayment();
    }
  }, [userEmail, recoverPendingPayment]);

  return {
    status,
    transactionId,
    checkoutUrl,
    error,
    startPayment,
    clearPendingPayment,
    getTransactionHistory,
  };
}

export default usePayment;
