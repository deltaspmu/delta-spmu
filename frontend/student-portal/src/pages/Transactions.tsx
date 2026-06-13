import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import {
  formatDate,
  formatPrice,
  getPaymentMethodLabel,
  getStatusColor,
  truncateText,
  cn,
} from '@/lib/utils';
import { Receipt, ChevronLeft, ChevronRight, X, FileText, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: PaymentTransaction['status'] }) {
  const colorMap: Record<string, string> = {
    Completed: 'bg-green-100 text-green-700',
    Pending: 'bg-yellow-100 text-yellow-700',
    Processing: 'bg-blue-100 text-blue-700',
    Failed: 'bg-red-100 text-red-700',
    'Pending Verification': 'bg-yellow-100 text-yellow-700',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        colorMap[status] || 'bg-gray-100 text-gray-700'
      )}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Table Skeleton
// ---------------------------------------------------------------------------

function TableSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl p-4 flex items-center gap-4">
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="h-4 bg-gray-200 rounded w-28 hidden lg:block" />
          <div className="h-4 bg-gray-200 rounded w-40 flex-1" />
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="h-4 bg-gray-200 rounded w-20 hidden lg:block" />
          <div className="h-5 bg-gray-200 rounded w-24" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile Transaction Card
// ---------------------------------------------------------------------------

interface TransactionCardProps {
  transaction: PaymentTransaction;
  onViewInvoice?: (transactionId: string) => void;
}

function TransactionCard({ transaction, onViewInvoice }: TransactionCardProps) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm space-y-3">
      {/* Top row: course + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-heading font-semibold text-dark text-sm truncate">
            {transaction.course_title}
          </h4>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatDate(transaction.creation)}
          </p>
        </div>
        <StatusBadge status={transaction.status} />
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <p className="text-xs text-gray-400">Transaction ID</p>
          <p className="font-mono text-xs text-dark truncate">
            {transaction.transaction_id}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Amount</p>
          <p className="font-heading font-bold text-dark">
            {formatPrice(transaction.final_amount, transaction.currency)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Method</p>
          <p className="text-dark text-xs">
            {getPaymentMethodLabel(transaction.payment_method)}
          </p>
        </div>
        {transaction.discount_percent > 0 && (
          <div>
            <p className="text-xs text-gray-400">Discount</p>
            <p className="text-green-600 text-xs font-medium">
              {transaction.discount_percent}% off
            </p>
          </div>
        )}
      </div>

      {transaction.status === 'Completed' && onViewInvoice && (
        <button
          onClick={() => onViewInvoice(transaction.transaction_id)}
          className="w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 text-dark hover:bg-gray-50 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop Table Row
// ---------------------------------------------------------------------------

function TransactionRow({ transaction, onViewInvoice }: TransactionCardProps) {
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
      <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">
        {formatDate(transaction.creation)}
      </td>
      <td className="px-4 py-3.5">
        <span className="font-mono text-xs text-gray-500" title={transaction.transaction_id}>
          {truncateText(transaction.transaction_id, 16)}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <span className="text-sm text-dark font-medium truncate block max-w-[200px]">
          {transaction.course_title}
        </span>
      </td>
      <td className="px-4 py-3.5 text-sm font-heading font-bold text-dark whitespace-nowrap">
        {formatPrice(transaction.final_amount, transaction.currency)}
      </td>
      <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">
        {getPaymentMethodLabel(transaction.payment_method)}
      </td>
      <td className="px-4 py-3.5">
        <StatusBadge status={transaction.status} />
      </td>
      <td className="px-4 py-3.5">
        {transaction.status === 'Completed' && onViewInvoice && (
          <button
            onClick={() => onViewInvoice(transaction.transaction_id)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-dark hover:bg-gray-50 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Invoice
          </button>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

  transactionId,
  onClose,
}: {
  transactionId: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['invoice', transactionId],
  });


  // Open the print-ready A4 invoice in a new window. The window is opened
  // synchronously on click (so it isn't blocked) and filled once the HTML
  // arrives from the API.
  const handlePrint = async () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(
      '<p style="font-family:sans-serif;padding:24px;color:#555;">Preparing your invoice…</p>'
    );
    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch {
      win.document.body.innerHTML =
        '<p style="font-family:sans-serif;padding:24px;color:#b00;">Could not load the invoice. Please try again.</p>';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-dark"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-4">
        </div>

        {isLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <p className="text-center text-sm text-gray-500 py-8">
            Could not load the invoice. Please try again.
          </p>
        ) : !registered ? (
          <p className="text-center text-sm text-gray-500 py-8">
                ? 'This invoice has been cancelled.'
          </p>
        ) : (
          <>
            <img
              src={`data:image/png;base64,${invoice!.qr}`}
              className="w-44 h-44 mx-auto border border-gray-100 rounded"
            />
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Amount</span>
                <span className="font-heading font-bold text-dark">
                  {formatPrice(invoice!.amount, invoice!.currency)}
                </span>
              </div>
              {invoice!.document_number && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Document No.</span>
                  <span className="text-dark">{invoice!.document_number}</span>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 mb-1">IRN</p>
                <p className="font-mono text-[11px] break-all bg-alabaster p-2 rounded">
                  {invoice!.irn}
                </p>
              </div>
            </div>
            <p className="text-center text-xs text-gray-400 mt-4">
              Scan with the official MoR app to verify.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-dark text-white rounded-lg text-sm hover:bg-primary/90 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Print / PDF
              </button>
              <a
                href={`data:image/png;base64,${invoice!.qr}`}
                className="flex items-center justify-center px-4 py-2 border border-dark text-dark rounded-lg text-sm hover:bg-alabaster transition-colors"
              >
                Download QR
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Transactions() {
  const { t } = useTranslation(['common', 'pages']);
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [invoiceTxId, setInvoiceTxId] = useState<string | null>(null);

  const offset = (page - 1) * PAGE_SIZE;

  const {
    data: transactionsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['transactions', page],
    queryFn: () => getUserTransactions(PAGE_SIZE, offset),
    enabled: !!user,
  });

  // Parse response
  const transactions: PaymentTransaction[] = useMemo(() => {
    if (!transactionsData) return [];
    if (Array.isArray(transactionsData)) return transactionsData as PaymentTransaction[];
    if (
      typeof transactionsData === 'object' &&
      'data' in (transactionsData as Record<string, unknown>)
    ) {
      return (transactionsData as { data: PaymentTransaction[] }).data;
    }
    return [];
  }, [transactionsData]);

  const totalTransactions: number = useMemo(() => {
    if (!transactionsData) return 0;
    if (Array.isArray(transactionsData)) return transactionsData.length;
    if (
      typeof transactionsData === 'object' &&
      'total' in (transactionsData as Record<string, unknown>)
    ) {
      return (transactionsData as { total: number }).total;
    }
    return transactions.length;
  }, [transactionsData, transactions.length]);

  const totalPages = Math.max(1, Math.ceil(totalTransactions / PAGE_SIZE));

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-alabaster">
      {/* Header */}
      <div className="bg-dark text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-2">
            <Receipt className="w-8 h-8 text-primary" />
            <h1 className="font-heading text-3xl sm:text-4xl font-bold">
              {t('pages:transactions.title', 'Transaction History')}
            </h1>
          </div>
          <p className="text-gray-300 text-lg">
            View your payment and purchase history
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading */}
        {isLoading ? (
          <TableSkeleton />
        ) : isError ? (
          /* Error */
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">
              Something went wrong while loading your transactions.
            </p>
            <button
              onClick={() => refetch()}
              className="px-6 py-2 bg-dark text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        ) : transactions.length === 0 ? (
          /* Empty state */
          <div className="text-center py-16">
            <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-heading text-lg font-semibold text-dark mb-1">
              No transactions found.
            </h3>
            <p className="text-gray-500 text-sm">
              Your payment history will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table (lg+) */}
            <div className="hidden lg:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transaction ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Course
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Method
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {transactions.map((tx) => (
                    <TransactionRow
                      key={tx.name}
                      transaction={tx}
                      onViewInvoice={setInvoiceTxId}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards (< lg) */}
            <div className="lg:hidden space-y-3">
              {transactions.map((tx) => (
                <TransactionCard
                  key={tx.name}
                  transaction={tx}
                  onViewInvoice={setInvoiceTxId}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>

                {Array.from({ length: totalPages }).map((_, i) => {
                  const pageNum = i + 1;
                  if (
                    pageNum === 1 ||
                    pageNum === totalPages ||
                    Math.abs(pageNum - page) <= 1
                  ) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={cn(
                          'w-10 h-10 text-sm rounded-lg border transition-colors',
                          pageNum === page
                            ? 'bg-dark text-white border-primary'
                            : 'bg-white border-gray-200 hover:bg-gray-50 text-dark'
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                  if (
                    (pageNum === 2 && page > 3) ||
                    (pageNum === totalPages - 1 && page < totalPages - 2)
                  ) {
                    return (
                      <span key={pageNum} className="px-1 text-gray-400">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}

                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {invoiceTxId && (
          transactionId={invoiceTxId}
          onClose={() => setInvoiceTxId(null)}
        />
      )}
    </div>
  );
}
