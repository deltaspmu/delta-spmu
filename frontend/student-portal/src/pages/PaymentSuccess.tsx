import { useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { checkPaymentStatus, getCourseDetail } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import type { Course, PaymentTransaction } from '@/types';
import {
  formatPrice,
  getPaymentMethodLabel,
  formatDate,
  cn,
} from '@/lib/utils';
import { CheckCircle, BookOpen, LayoutDashboard, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUNDLE_ID = 'all-courses-bundle';

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PaymentSuccess() {
  const { t } = useTranslation(['common', 'pages']);
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();

  const courseId = searchParams.get('course') || '';
  const transactionId = searchParams.get('transaction') || '';
  const isBundle = courseId === BUNDLE_ID;

  // Entrance animation state
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger the entrance animation after mount
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const { data: transactionData, isLoading: txLoading } = useQuery({
    queryKey: ['paymentStatus', transactionId],
    queryFn: () => checkPaymentStatus(transactionId),
    enabled: !!transactionId,
    staleTime: 60 * 1000,
  });

  const { data: courseData } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => getCourseDetail(courseId),
    enabled: !!courseId && !isBundle,
  });

  const transaction = transactionData as Partial<PaymentTransaction> | undefined;
  const course = courseData as Course | undefined;

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const courseTitle = useMemo(() => {
    if (isBundle) return 'All Courses Bundle';
    if (transaction?.course_title) return transaction.course_title;
    if (course?.title) return course.title;
    return 'Course';
  }, [isBundle, transaction, course]);

  const amountPaid = useMemo(() => {
    // check_payment_status returns `amount`; fall back to final_amount for safety.
    const amt = transaction?.amount ?? transaction?.final_amount;
    if (amt != null && transaction?.currency) {
      return formatPrice(amt, transaction.currency);
    }
    return null;
  }, [transaction]);

  const paymentMethod = useMemo(() => {
    if (transaction?.payment_method) {
      return getPaymentMethodLabel(transaction.payment_method);
    }
    return null;
  }, [transaction]);

  const completedDate = useMemo(() => {
    if (transaction?.completed_at) return formatDate(transaction.completed_at);
    if (transaction?.creation) return formatDate(transaction.creation);
    return formatDate(new Date().toISOString());
  }, [transaction]);

  const accessEnd = useMemo(() => {
    // 30 days from completion
    const base = transaction?.completed_at || transaction?.creation || new Date().toISOString();
    const end = new Date(base);
    end.setDate(end.getDate() + 30);
    return formatDate(end.toISOString());
  }, [transaction]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-alabaster flex items-center justify-center px-4 py-12">
      <div
        className={cn(
          'max-w-lg w-full transition-all duration-500 ease-out',
          visible
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-4 scale-95'
        )}
      >
        {/* Checkmark animation */}
        <div className="flex justify-center mb-6">
          <div
            className={cn(
              'w-20 h-20 rounded-full bg-green-100 flex items-center justify-center transition-transform duration-700 ease-out',
              visible ? 'scale-100' : 'scale-0'
            )}
          >
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="font-heading text-2xl font-bold text-dark text-center mb-2">
          Payment Successful!
        </h1>
        <p className="text-gray-500 text-center text-sm mb-8">
          You now have 30-day access to{' '}
          <span className="font-medium text-dark">{courseTitle}</span>
        </p>

        {/* Transaction details card */}
        <div
          className={cn(
            'bg-white rounded-xl border border-gray-100 p-5 mb-6 transition-all duration-500 delay-200 ease-out',
            visible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4'
          )}
        >
          {txLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Transaction ID */}
              {(transactionId || transaction?.transaction_id) && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Transaction ID</span>
                  <span className="font-mono text-dark text-xs">
                    {transaction?.transaction_id || transactionId}
                  </span>
                </div>
              )}

              {/* Amount paid */}
              {amountPaid && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Amount Paid</span>
                  <span className="font-semibold text-dark">{amountPaid}</span>
                </div>
              )}

              {/* Payment method */}
              {paymentMethod && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Payment Method</span>
                  <span className="text-dark">{paymentMethod}</span>
                </div>
              )}

              {/* Date */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Date</span>
                <span className="text-dark">{completedDate}</span>
              </div>

              {/* Access period */}
              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Access Period</span>
                  <span className="text-dark">
                    {completedDate} &rarr; {accessEnd}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CTA Buttons */}
        <div
          className={cn(
            'flex flex-col sm:flex-row items-center gap-3 transition-all duration-500 delay-300 ease-out',
            visible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4'
          )}
        >
          {isBundle ? (
            <Link
              to="/my-courses"
              className="w-full sm:flex-1 py-3 bg-dark text-white rounded-lg text-sm font-medium text-center hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Go to My Courses
            </Link>
          ) : (
            <Link
              to={`/learn/${courseId}`}
              className="w-full sm:flex-1 py-3 bg-dark text-white rounded-lg text-sm font-medium text-center hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Go to Course
            </Link>
          )}

          <Link
            to="/dashboard"
            className="w-full sm:flex-1 py-3 border border-gray-200 text-dark rounded-lg text-sm font-medium text-center hover:bg-gray-50 transition-colors inline-flex items-center justify-center gap-2"
          >
            <LayoutDashboard className="w-4 h-4" />
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
