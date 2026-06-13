import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPaymentTransactions, getRevenueStats, verifyPayment, exportPaymentsCsv } from '@/api/client';
import type { PaymentTransaction } from '@/types';
import {
  DollarSign,
  Clock,
  CheckCircle,
  TrendingUp,
  Search,
  Loader2,
  ShieldCheck,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div className="admin-card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-dark">{value}</p>
      </div>
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Completed: 'bg-green-100 text-green-700',
    Pending: 'bg-yellow-100 text-yellow-700',
    'Pending Verification': 'bg-orange-100 text-orange-700',
    Processing: 'bg-blue-100 text-blue-700',
    Failed: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

export default function Payments() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await exportPaymentsCsv({
        status: statusFilter || undefined,
        payment_method: methodFilter || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export failed:', err);
      alert('Failed to export CSV. Check the console for details.');
    } finally {
      setExporting(false);
    }
  }

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['revenue-stats'],
    queryFn: () => getRevenueStats(),
  });

  const { data: transactionsData, isLoading: txLoading } = useQuery({
    queryKey: ['payment-transactions'],
    queryFn: () => getPaymentTransactions({ limit: 200 }),
  });

  const verifyMutation = useMutation({
    mutationFn: (paymentId: string) => verifyPayment(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-stats'] });
    },
  });

  const transactions: PaymentTransaction[] = Array.isArray(transactionsData) ? transactionsData : transactionsData?.data || [];

  const filtered = transactions.filter((t) => {
    const matchesSearch =
      !search ||
      (t.transaction_id || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.user_name || t.user || '').toLowerCase().includes(search.toLowerCase()) ||
      (t.course_title || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || t.status === statusFilter;
    const matchesMethod = !methodFilter || t.payment_method === methodFilter;
    return matchesSearch && matchesStatus && matchesMethod;
  });

  const methods = [...new Set(transactions.map((t) => t.payment_method).filter(Boolean))];

  // admin_get_revenue_stats returns total_revenue_etb + transaction_counts{Status:n}.
  // (Earlier this page read total_revenue / pending_count / completed_count /
  // avg_order_value — keys the endpoint never returns — so every card showed 0.)
  const completedCount = stats?.transaction_counts?.Completed ?? 0;
  const pendingCount = stats?.transaction_counts?.Pending ?? 0;
  const totalRevenueEtb = Number(stats?.total_revenue_etb || 0);
  const avgOrderValue = completedCount ? Math.round(totalRevenueEtb / completedCount) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Payments & Revenue</h1>
        <p className="text-sm text-gray-500 mt-1">Track transactions and revenue</p>
      </div>

      {/* Stats Cards */}
      {statsLoading ? (
        <div className="flex items-center justify-center h-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary-dark" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Revenue"
            value={`${totalRevenueEtb.toLocaleString()} ETB`}
            icon={<DollarSign className="w-6 h-6 text-emerald-600" />}
            color="bg-emerald-50"
          />
          <StatCard
            title="Pending Payments"
            value={pendingCount}
            icon={<Clock className="w-6 h-6 text-amber-600" />}
            color="bg-amber-50"
          />
          <StatCard
            title="Completed Payments"
            value={completedCount}
            icon={<CheckCircle className="w-6 h-6 text-green-600" />}
            color="bg-green-50"
          />
          <StatCard
            title="Average Order Value"
            value={`${avgOrderValue.toLocaleString()} ETB`}
            icon={<TrendingUp className="w-6 h-6 text-blue-600" />}
            color="bg-blue-50"
          />
        </div>
      )}

      {/* Toolbar */}
      <div className="admin-card flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by transaction ID, student, or course..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">All Statuses</option>
          <option value="Completed">Completed</option>
          <option value="Pending">Pending</option>
          <option value="Pending Verification">Pending Verification</option>
          <option value="Processing">Processing</option>
          <option value="Failed">Failed</option>
        </select>
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">All Methods</option>
          {methods.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <button
          onClick={handleExport}
          disabled={exporting || txLoading}
          className="flex items-center gap-2 border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Export current filter to CSV"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? 'Exporting...' : 'Export'}
        </button>
      </div>

      {/* Transactions Table */}
      {txLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-primary-dark" />
        </div>
      ) : (
        <div className="admin-card p-0 overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Transaction ID</th>
                <th>Student</th>
                <th>Course</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-gray-400 py-8">No transactions found</td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.name || t.transaction_id}>
                    <td className="text-sm text-gray-500">
                      {t.creation ? format(new Date(t.creation), 'MMM d, yyyy') : '-'}
                    </td>
                    <td className="font-mono text-xs">{t.transaction_id || t.name}</td>
                    <td className="text-sm">{t.user_name || t.user}</td>
                    <td className="text-sm">{t.course_title || t.course}</td>
                    <td className="text-sm font-medium">
                      {Number(t.final_amount || 0).toLocaleString()} {t.currency || 'ETB'}
                      {t.discount_percent > 0 && (
                        <span className="ml-1 text-xs text-green-600">-{t.discount_percent}%</span>
                      )}
                    </td>
                    <td className="text-sm">{t.payment_method || '-'}</td>
                    <td><PaymentStatusBadge status={t.status} /></td>
                    <td>
                      {(t.status === 'Pending Verification' || t.status === 'Pending') && (
                        <button
                          onClick={() => verifyMutation.mutate(t.name || t.transaction_id)}
                          disabled={verifyMutation.isPending}
                          className="flex items-center gap-1 text-xs bg-primary text-dark px-2 py-1 rounded hover:bg-primary-dark transition-colors disabled:opacity-50"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {verifyMutation.isPending ? 'Verifying...' : 'Verify'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
