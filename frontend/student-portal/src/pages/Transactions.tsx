import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getUserTransactions } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import type { PaymentTransaction } from '@/types';
import {
  formatDate,
  formatPrice,
  getPaymentMethodLabel,
  truncateText,
  cn,
} from '@/lib/utils';
import { Receipt, ChevronLeft, ChevronRight, X, Download } from 'lucide-react';

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
  onViewReceipt?: (transaction: PaymentTransaction) => void;
}

function TransactionCard({ transaction, onViewReceipt }: TransactionCardProps) {
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
            {formatPrice(transaction.amount ?? transaction.final_amount, transaction.currency)}
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

      {transaction.status === 'Completed' && onViewReceipt && (
        <button
          onClick={() => onViewReceipt(transaction)}
          className="w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 text-dark hover:bg-gray-50 transition-colors"
        >
          <Receipt className="w-3.5 h-3.5" />
          Receipt
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop Table Row
// ---------------------------------------------------------------------------

function TransactionRow({ transaction, onViewReceipt }: TransactionCardProps) {
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
        {formatPrice(transaction.amount ?? transaction.final_amount, transaction.currency)}
      </td>
      <td className="px-4 py-3.5 text-sm text-gray-600 whitespace-nowrap">
        {getPaymentMethodLabel(transaction.payment_method)}
      </td>
      <td className="px-4 py-3.5">
        <StatusBadge status={transaction.status} />
      </td>
      <td className="px-4 py-3.5">
        {transaction.status === 'Completed' && onViewReceipt && (
          <button
            onClick={() => onViewReceipt(transaction)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-dark hover:bg-gray-50 transition-colors"
          >
            <Receipt className="w-3.5 h-3.5" />
            Receipt
          </button>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Payment Receipt Modal
// ---------------------------------------------------------------------------

// Build a print-ready Payment Receipt entirely client-side.
function buildReceiptHtml(tx: PaymentTransaction, studentName: string): string {
  const esc = (v: unknown) =>
    String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
  const amountStr = formatPrice(tx.amount ?? tx.final_amount, tx.currency);
  const dateStr = formatDate(tx.completed_at || tx.creation);
  const methodStr = getPaymentMethodLabel(tx.payment_method);
  const rows: [string, string][] = [
    ['Receipt No.', tx.transaction_id],
    ['Date', dateStr],
    ['Student', studentName],
    ['Course', tx.course_title || tx.course || ''],
    ['Payment Method', methodStr],
    ['Amount Paid', amountStr],
    ['Status', tx.status],
  ];
  const rowsHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:9px 14px;color:#666;border:1px solid #e7e3d8;">${esc(k)}</td>` +
        `<td style="padding:9px 14px;border:1px solid #e7e3d8;font-weight:600;">${esc(v)}</td></tr>`,
    )
    .join('');
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(tx.transaction_id)}</title></head>` +
    `<body style="font-family:Arial,Helvetica,sans-serif;color:#1A2F23;max-width:640px;margin:24px auto;padding:0 16px;">` +
    `<div style="text-align:center;margin-bottom:22px;">` +
    `<h1 style="margin:0;font-size:22px;">Delta SPMU Academy</h1>` +
    `<p style="margin:4px 0 0;color:#999;font-size:12px;">Addis Ababa, Ethiopia &middot; learn.deltaspmu.com</p>` +
    `</div>` +
    `<h2 style="font-size:15px;letter-spacing:3px;text-transform:uppercase;color:#C9A96E;text-align:center;margin:0 0 18px;">Payment Receipt</h2>` +
    `<table style="border-collapse:collapse;width:100%;font-size:14px;">${rowsHtml}</table>` +
    `<p style="margin-top:18px;color:#999;font-size:11px;line-height:1.55;">This is a payment receipt confirming the transaction above.</p>` +
    `<p style="margin-top:22px;color:#bbb;font-size:10px;text-align:center;">Generated ${esc(new Date().toLocaleString())}</p>` +
    `</body></html>`
  );
}

function ReceiptModal({
  transaction,
  onClose,
}: {
  transaction: PaymentTransaction;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const studentName = user?.full_name || user?.email || 'Student';

  const amountStr = formatPrice(transaction.amount ?? transaction.final_amount, transaction.currency);
  const dateStr = formatDate(transaction.completed_at || transaction.creation);
  const methodStr = getPaymentMethodLabel(transaction.payment_method);

  const handleDownloadReceipt = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(buildReceiptHtml(transaction, studentName));
    win.document.close();
    // Trigger print from the parent context: the receipt window inherits this
    // app's CSP, whose script-src 'self' blocks an inline <script> auto-print.
    setTimeout(() => { try { win.print(); } catch { /* user can print manually */ } }, 200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-6 relative max-h-[90vh] overflow-y-auto"
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
          <p className="text-xs tracking-[0.2em] uppercase text-primary">Payment Receipt</p>
          <p className="text-xs text-gray-400 mt-1">Delta SPMU Academy</p>
        </div>

        {/* Receipt details — always available for completed payments */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-gray-400">Receipt No.</span>
            <span className="font-mono text-xs text-dark text-right break-all">{transaction.transaction_id}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-400">Course</span>
            <span className="text-dark text-right">{transaction.course_title}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-400">Amount</span>
            <span className="font-heading font-bold text-dark">{amountStr}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-400">Method</span>
            <span className="text-dark">{methodStr}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-gray-400">Date</span>
            <span className="text-dark">{dateStr}</span>
          </div>
        </div>

        <button
          onClick={handleDownloadReceipt}
          className="mt-5 w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-dark text-white rounded-lg text-sm hover:bg-primary/90 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download / Print Receipt
        </button>
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
  const [receiptTx, setReceiptTx] = useState<PaymentTransaction | null>(null);

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
                      onViewReceipt={setReceiptTx}
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
                  onViewReceipt={setReceiptTx}
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

      {receiptTx && (
        <ReceiptModal
          transaction={receiptTx}
          onClose={() => setReceiptTx(null)}
        />
      )}
    </div>
  );
}
