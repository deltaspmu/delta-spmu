import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats, getEnrollments, getPaymentTransactions } from '@/api/client';
import {
  Users,
  BookOpen,
  GraduationCap,
  DollarSign,
  Plus,
  UserCog,
  BarChart3,
  Loader2,
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Active: 'bg-green-100 text-green-700',
    Completed: 'bg-green-100 text-green-700',
    Pending: 'bg-yellow-100 text-yellow-700',
    'Pending Verification': 'bg-yellow-100 text-yellow-700',
    Failed: 'bg-red-100 text-red-700',
    Processing: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
  });

  const { data: recentEnrollments } = useQuery({
    queryKey: ['recent-enrollments'],
    queryFn: () =>
      getEnrollments({
        limit_page_length: 5,
        order_by: 'creation desc',
        fields: JSON.stringify(['name', 'student_name', 'course_title', 'creation', 'status']),
      }),
  });

  const { data: recentPayments } = useQuery({
    queryKey: ['recent-payments'],
    queryFn: () => getPaymentTransactions({ limit: 5 }),
  });

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-dark" />
      </div>
    );
  }

  const enrollments = Array.isArray(recentEnrollments) ? recentEnrollments : recentEnrollments?.data || [];
  const payments = Array.isArray(recentPayments) ? recentPayments : recentPayments?.data || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your learning platform</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={stats?.users?.total ?? 0}
          icon={<Users className="w-6 h-6 text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          title="Active Courses"
          value={stats?.courses?.total ?? 0}
          icon={<BookOpen className="w-6 h-6 text-emerald-600" />}
          color="bg-emerald-50"
        />
        <StatCard
          title="Total Enrollments"
          value={stats?.enrollments?.total ?? 0}
          icon={<GraduationCap className="w-6 h-6 text-purple-600" />}
          color="bg-purple-50"
        />
        <StatCard
          title="Revenue (ETB)"
          value={stats?.revenue?.total_revenue ? Number(stats.revenue.total_revenue).toLocaleString() : '0'}
          icon={<DollarSign className="w-6 h-6 text-amber-600" />}
          color="bg-amber-50"
        />
      </div>

      {/* Recent Enrollments */}
      <div className="admin-card">
        <h2 className="font-heading text-lg font-semibold text-dark mb-4">Recent Enrollments</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Course</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-gray-400 py-8">No enrollments yet</td>
              </tr>
            ) : (
              enrollments.slice(0, 5).map((e: any) => (
                <tr key={e.name}>
                  <td className="font-medium">{e.student_name || e.student}</td>
                  <td>{e.course_title || e.course}</td>
                  <td className="text-gray-500">
                    {e.creation ? format(new Date(e.creation), 'MMM d, yyyy') : '-'}
                  </td>
                  <td><StatusBadge status={e.status || 'Active'} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Recent Payments */}
      <div className="admin-card">
        <h2 className="font-heading text-lg font-semibold text-dark mb-4">Recent Payments</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Student</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-gray-400 py-8">No payments yet</td>
              </tr>
            ) : (
              payments.slice(0, 5).map((p: any) => (
                <tr key={p.name || p.transaction_id}>
                  <td className="font-mono text-xs">{p.transaction_id || p.name}</td>
                  <td>{p.user || p.student}</td>
                  <td className="font-medium">{Number(p.final_amount || p.amount || 0).toLocaleString()} {p.currency || 'ETB'}</td>
                  <td>{p.payment_method || '-'}</td>
                  <td><StatusBadge status={p.status || 'Pending'} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Quick Actions */}
      <div className="admin-card">
        <h2 className="font-heading text-lg font-semibold text-dark mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/courses/new')}
            className="flex items-center gap-2 bg-dark text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-dark-light transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Course
          </button>
          <button
            onClick={() => navigate('/users')}
            className="flex items-center gap-2 bg-primary text-dark px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <UserCog className="w-4 h-4" /> Manage Users
          </button>
          <button
            onClick={() => navigate('/payments')}
            className="flex items-center gap-2 border border-gray-300 text-dark px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <BarChart3 className="w-4 h-4" /> View Analytics
          </button>
        </div>
      </div>
    </div>
  );
}
