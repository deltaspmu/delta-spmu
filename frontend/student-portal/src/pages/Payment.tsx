import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCourseDetail } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useCoursePrice } from '@/hooks/useCoursePrice';
import { usePayment } from '@/hooks/usePayment';
import type { Course } from '@/types';
import {
  formatPrice,
  getPaymentMethodLabel,
  getCourseImageUrl,
  cn,
} from '@/lib/utils';
import {
  Smartphone,
  CreditCard,
  Globe,
  Landmark,
  Building2,
  Loader2,
  AlertCircle,
  RefreshCw,
  Clock,
  ShieldCheck,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react';
import type { PaymentInstructions } from '@/hooks/usePayment';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaymentMethodOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: 'telebirr',
    label: 'Pay with telebirr',
    description: 'Pay Bill from your telebirr app',
    icon: <Smartphone className="w-5 h-5" />,
  },
  {
    id: 'chapa',
    label: 'Pay with Chapa',
    description: 'Local card & mobile payment',
    icon: <CreditCard className="w-5 h-5" />,
  },
  {
    id: 'chapa_international',
    label: 'Pay with Visa/Mastercard',
    description: 'International card payment',
    icon: <Globe className="w-5 h-5" />,
  },
  {
    id: 'ethswitch',
    label: 'Pay via Bank',
    description: 'EthSwitch bank transfer',
    icon: <Landmark className="w-5 h-5" />,
  },
  {
    id: 'cbe',
    label: 'CBE Bank Transfer',
    description: 'Manual bank transfer to CBE',
    icon: <Building2 className="w-5 h-5" />,
  },
];

const BUNDLE_ID = 'all-courses-bundle';

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-alabaster animate-pulse">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="h-5 bg-gray-200 rounded w-48 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="lg:col-span-2 space-y-4">
            <div className="h-48 bg-gray-200 rounded-xl" />
            <div className="h-12 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CBE Transfer Instructions
// ---------------------------------------------------------------------------

function CBETransferInstructions({
  amount,
  currency,
  courseId,
}: {
  amount: number;
  currency: string;
  courseId: string;
}) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
      <h3 className="font-heading font-semibold text-dark text-sm">
        CBE Bank Transfer Instructions
      </h3>
      <ol className="list-decimal list-inside text-sm text-gray-700 space-y-2">
        <li>
          Transfer{' '}
          <span className="font-bold text-dark">
            {formatPrice(amount, currency)}
          </span>{' '}
          to the following account:
        </li>
        <li>
          <div className="mt-1 bg-white rounded-lg p-3 border border-blue-100 space-y-1">
            <p className="text-sm">
              <span className="text-gray-500">Bank:</span>{' '}
              <span className="font-medium text-dark">
                Commercial Bank of Ethiopia (CBE)
              </span>
            </p>
            <p className="text-sm">
              <span className="text-gray-500">Account Name:</span>{' '}
              <span className="font-medium text-dark">Delta SPMU Academy</span>
            </p>
            <p className="text-sm">
              <span className="text-gray-500">Account Number:</span>{' '}
              <span className="font-mono font-bold text-dark">
                1000123456789
              </span>
            </p>
          </div>
        </li>
        <li>
          Use this as your payment reference:{' '}
          <span className="font-mono font-bold text-dark bg-yellow-100 px-2 py-0.5 rounded">
            {courseId.toUpperCase().slice(0, 12)}
          </span>
        </li>
        <li>After transferring, submit your bank reference number below.</li>
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// telebirr C2B "Pay Bill" instructions card
// ---------------------------------------------------------------------------

function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — user can select manually
    }
  }

  return (
    <div className="bg-white rounded-lg p-3 border border-gray-200 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-mono font-bold text-dark text-lg tracking-wider truncate">
          {value || '—'}
        </p>
      </div>
      {value && (
        <button
          onClick={handleCopy}
          className="flex-shrink-0 w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-dark hover:border-gray-300 transition-colors"
          aria-label={`Copy ${label}`}
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );
}

function TelebirrPayBillCard({
  instructions,
  isWaiting,
}: {
  instructions: PaymentInstructions;
  isWaiting: boolean;
}) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Smartphone className="w-4 h-4 text-green-700" />
        <h3 className="font-heading font-semibold text-dark text-sm">
          Pay with telebirr — Pay Bill
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CopyValue
          label="Merchant short code"
          value={instructions.short_code || ''}
        />
        <CopyValue
          label="Bill reference"
          value={instructions.bill_reference || ''}
        />
      </div>

      <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1.5">
        {(instructions.steps || []).map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>

      {instructions.note && (
        <p className="text-xs text-gray-500">{instructions.note}</p>
      )}

      {isWaiting && (
        <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-green-100">
          <Loader2 className="w-4 h-4 text-green-600 animate-spin flex-shrink-0" />
          <p className="text-sm text-gray-600">
            Waiting for your payment — this page updates automatically once
            telebirr confirms.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Polling / Verification Overlay
// ---------------------------------------------------------------------------

function VerificationOverlay({
  status,
  error,
  onRetry,
  onRestart,
}: {
  status: 'polling' | 'failed' | 'expired';
  error: string | null;
  onRetry: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-xl">
        {status === 'polling' && (
          <>
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <h2 className="font-heading text-xl font-semibold text-dark mb-2">
              Verifying your payment...
            </h2>
            <p className="text-sm text-gray-500">
              Please wait while we confirm your transaction. This may take a
              moment.
            </p>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="font-heading text-xl font-semibold text-dark mb-2">
              Payment Failed
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {error || 'Something went wrong with your payment. Please try again.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={onRetry}
                className="px-5 py-2.5 bg-dark text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
            </div>
          </>
        )}

        {status === 'expired' && (
          <>
            <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
            <h2 className="font-heading text-xl font-semibold text-dark mb-2">
              Payment Expired
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Your payment session has timed out. Please start a new payment.
            </p>
            <button
              onClick={onRestart}
              className="px-5 py-2.5 bg-dark text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Start Over
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Payment Page
// ---------------------------------------------------------------------------

export default function Payment() {
  const { courseId } = useParams<{ courseId: string }>();
  const { t } = useTranslation(['common', 'pages']);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const isBundle = courseId === BUNDLE_ID;

  // State
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [currency, setCurrency] = useState<'ETB' | 'USD'>('ETB');
  const [cbeReference, setCbeReference] = useState('');
  const [showCbeSubmit, setShowCbeSubmit] = useState(false);

  // Hooks
  const {
    status: paymentStatus,
    transactionId,
    instructions: paymentInstructions,
    error: paymentError,
    startPayment,
    clearPendingPayment,
  } = usePayment();

  const { priceInfo, isLoading: priceLoading } = useCoursePrice(
    courseId || '',
    selectedMethod === 'chapa_international' ? currency : 'ETB'
  );

  // Fetch course detail (skip for bundle)
  const { data: courseData, isLoading: courseLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => getCourseDetail(courseId!),
    enabled: !!courseId && !isBundle,
  });

  const course = courseData as Course | undefined;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Redirect on payment success
  useEffect(() => {
    if (paymentStatus === 'success' && transactionId) {
      navigate(
        `/payment/success?course=${encodeURIComponent(courseId || '')}&transaction=${encodeURIComponent(transactionId)}`
      );
    }
  }, [paymentStatus, transactionId, courseId, navigate]);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const courseTitle = useMemo(() => {
    if (isBundle) return 'All 5 Courses Bundle';
    return course?.title || 'Course';
  }, [isBundle, course]);

  const courseImage = useMemo(() => {
    if (isBundle) return '/placeholder-course.svg';
    return course ? getCourseImageUrl(course) : '/placeholder-course.svg';
  }, [isBundle, course]);

  const displayCurrency =
    selectedMethod === 'chapa_international' ? currency : 'ETB';

  const finalAmount = isBundle
    ? priceInfo.bundle_price
    : priceInfo.final_price;

  const showCurrencyToggle = selectedMethod === 'chapa_international';

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handlePay() {
    if (!courseId || !selectedMethod) return;

    await startPayment(
      courseId,
      selectedMethod,
      undefined,
      selectedMethod === 'chapa_international' ? currency : undefined
    );

    // If CBE, show the reference submission form
    if (selectedMethod === 'cbe') {
      setShowCbeSubmit(true);
    }
  }

  function handleRetry() {
    clearPendingPayment();
    handlePay();
  }

  function handleRestart() {
    clearPendingPayment();
    setSelectedMethod('');
    setShowCbeSubmit(false);
    setCbeReference('');
  }

  async function handleCbeSubmit() {
    if (!transactionId || !cbeReference.trim()) return;
    // Re-trigger verification with reference
    const { verifyPayment } = await import('@/api/client');
    try {
      await verifyPayment(transactionId, cbeReference.trim());
    } catch {
      // Polling will handle the status update
    }
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (courseLoading || (priceLoading && !selectedMethod)) {
    return <PageSkeleton />;
  }

  // ---------------------------------------------------------------------------
  // Determine step
  // ---------------------------------------------------------------------------

  const isStep2 = !!selectedMethod;
  const isInitiating = paymentStatus === 'initiating';
  // telebirr C2B shows inline Pay Bill instructions while polling — the
  // blocking "Verifying..." overlay would hide the short code + reference.
  const showTelebirrInstructions =
    selectedMethod === 'telebirr' && !!paymentInstructions;
  const showOverlay =
    (paymentStatus === 'polling' && !showTelebirrInstructions) ||
    paymentStatus === 'failed' ||
    paymentStatus === 'expired';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-alabaster">
      {/* Verification overlay */}
      {showOverlay && (
        <VerificationOverlay
          status={paymentStatus as 'polling' | 'failed' | 'expired'}
          error={paymentError}
          onRetry={handleRetry}
          onRestart={handleRestart}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="hover:text-primary transition-colors"
          >
            {isBundle ? 'Courses' : courseTitle}
          </button>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-dark">Payment</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* ================================================================ */}
          {/* LEFT: Payment Form                                               */}
          {/* ================================================================ */}
          <div className="lg:col-span-3 space-y-6">
            {/* Step 1: Payment Method Selection */}
            <div>
              <h1 className="font-heading text-xl sm:text-2xl font-bold text-dark mb-1">
                Choose Payment Method
              </h1>
              <p className="text-sm text-gray-500 mb-5">
                Select how you would like to pay
              </p>

              <div className="space-y-3">
                {PAYMENT_METHODS.map((method) => {
                  const isSelected = selectedMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      onClick={() => {
                        setSelectedMethod(method.id);
                        setShowCbeSubmit(false);
                        setCbeReference('');
                      }}
                      className={cn(
                        'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left',
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                      )}
                    >
                      <div
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                          isSelected
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-500'
                        )}
                      >
                        {method.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'font-medium text-sm',
                            isSelected ? 'text-dark' : 'text-gray-700'
                          )}
                        >
                          {method.label}
                        </p>
                        <p className="text-xs text-gray-400">
                          {method.description}
                        </p>
                      </div>
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                          isSelected
                            ? 'border-primary'
                            : 'border-gray-300'
                        )}
                      >
                        {isSelected && (
                          <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Payment Details (conditional) */}
            {isStep2 && (
              <div className="space-y-5">
                {/* Currency toggle for international */}
                {showCurrencyToggle && (
                  <div>
                    <label className="block text-sm font-medium text-dark mb-2">
                      Currency
                    </label>
                    <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
                      {(['ETB', 'USD'] as const).map((cur) => (
                        <button
                          key={cur}
                          onClick={() => setCurrency(cur)}
                          className={cn(
                            'px-5 py-2 text-sm font-medium transition-colors',
                            currency === cur
                              ? 'bg-dark text-white'
                              : 'bg-white text-gray-600 hover:bg-gray-50'
                          )}
                        >
                          {cur}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* telebirr: Pay Bill instructions (after initiation) or info note */}
                {selectedMethod === 'telebirr' &&
                  (showTelebirrInstructions && paymentInstructions ? (
                    <TelebirrPayBillCard
                      instructions={paymentInstructions}
                      isWaiting={paymentStatus === 'polling'}
                    />
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
                      <Smartphone className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <p className="text-sm text-gray-600">
                        You will pay from your own telebirr app using{' '}
                        <span className="font-medium text-dark">Pay Bill</span>.
                        We&apos;ll show you the merchant short code and your
                        bill reference on the next step.
                      </p>
                    </div>
                  ))}

                {/* CBE: Transfer instructions */}
                {selectedMethod === 'cbe' && !showCbeSubmit && (
                  <CBETransferInstructions
                    amount={finalAmount}
                    currency={displayCurrency}
                    courseId={courseId || ''}
                  />
                )}

                {/* CBE: Reference submission after transfer */}
                {selectedMethod === 'cbe' && showCbeSubmit && (
                  <div className="bg-white rounded-xl p-5 border border-gray-200 space-y-4">
                    <h3 className="font-heading font-semibold text-dark text-sm">
                      Submit Bank Transfer Reference
                    </h3>
                    <p className="text-sm text-gray-500">
                      Enter the reference number from your CBE bank transfer.
                    </p>
                    <input
                      type="text"
                      value={cbeReference}
                      onChange={(e) => setCbeReference(e.target.value)}
                      placeholder="e.g. FT2403XXXXXXX"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    />
                    <button
                      onClick={handleCbeSubmit}
                      disabled={!cbeReference.trim()}
                      className="w-full py-3 bg-dark text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Submit Reference
                    </button>
                  </div>
                )}

                {/* Chapa / EthSwitch: No extra fields */}
                {(selectedMethod === 'chapa' ||
                  selectedMethod === 'chapa_international' ||
                  selectedMethod === 'ethswitch') && (
                  <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <p className="text-sm text-gray-600">
                      You will be redirected to a secure payment page to
                      complete your transaction.
                    </p>
                  </div>
                )}

                {/* Pay button (hide if CBE reference form or telebirr Pay Bill card is showing) */}
                {!(selectedMethod === 'cbe' && showCbeSubmit) &&
                  !showTelebirrInstructions && (
                  <button
                    onClick={handlePay}
                    disabled={isInitiating || !selectedMethod}
                    className="w-full py-3.5 bg-dark text-white rounded-lg font-medium text-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {isInitiating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : selectedMethod === 'cbe' ? (
                      'I Have Transferred'
                    ) : selectedMethod === 'telebirr' ? (
                      `Get Payment Instructions — ${formatPrice(finalAmount, displayCurrency)}`
                    ) : (
                      `Pay ${formatPrice(finalAmount, displayCurrency)}`
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ================================================================ */}
          {/* RIGHT: Order Summary                                             */}
          {/* ================================================================ */}
          <div className="lg:col-span-2">
            <div className="sticky top-24">
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {/* Course image */}
                <div className="aspect-video bg-gray-100 overflow-hidden">
                  <img
                    src={courseImage}
                    alt={courseTitle}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Details */}
                <div className="p-5 space-y-4">
                  <h2 className="font-heading font-semibold text-dark text-base">
                    {courseTitle}
                  </h2>

                  {priceLoading ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-5 bg-gray-200 rounded w-1/2" />
                      <div className="h-8 bg-gray-200 rounded w-2/3" />
                    </div>
                  ) : (
                    <>
                      {/* Price breakdown */}
                      <div className="space-y-2 text-sm">
                        {/* Original price (if discounted) */}
                        {priceInfo.discount_percent > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Original price</span>
                            <span className="text-gray-400 line-through">
                              {formatPrice(
                                isBundle
                                  ? priceInfo.original_price
                                  : priceInfo.original_price,
                                displayCurrency
                              )}
                            </span>
                          </div>
                        )}

                        {/* Discount line */}
                        {priceInfo.discount_percent > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-green-600">
                              Discount ({priceInfo.discount_percent}%)
                            </span>
                            <span className="text-green-600 font-medium">
                              -{formatPrice(priceInfo.discount_amount, displayCurrency)}
                            </span>
                          </div>
                        )}

                        {/* Separator */}
                        <div className="border-t border-gray-100 pt-2" />

                        {/* Total */}
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-dark">Total</span>
                          <span className="font-heading text-2xl font-bold text-dark">
                            {formatPrice(finalAmount, displayCurrency)}
                          </span>
                        </div>

                        {/* Currency indicator */}
                        <p className="text-xs text-gray-400 text-right">
                          Paying in {displayCurrency}
                        </p>
                      </div>
                    </>
                  )}

                  {/* Selected method indicator */}
                  {selectedMethod && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        Payment method:
                      </span>
                      <span className="text-xs font-medium text-dark">
                        {getPaymentMethodLabel(selectedMethod)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Security note */}
              <div className="mt-4 flex items-start gap-2 text-xs text-gray-400">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                  Your payment is secure and encrypted. We do not store your
                  card details.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
