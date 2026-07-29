import { useQuery } from '@tanstack/react-query';
import { getAnalyticsSummary, getRevenueStats } from '@/api/client';
import type { AnalyticsData } from '@/types';
import { BarChart3, Users, TrendingUp, Award, DollarSign } from 'lucide-react';

function StatCard({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-dark/10 text-dark">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function HorizontalBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate text-gray-700">{label}</span>
        <span className="font-medium text-gray-900">{value}</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-dark transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Analytics() {
  const { data: analytics, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ['analytics'],
    queryFn: getAnalyticsSummary,
  });

  const { data: revenue, isLoading: revenueLoading } = useQuery<{ monthly: { month: string; total: number }[]; total: number }>({
    queryKey: ['revenue-stats'],
    queryFn: () => getRevenueStats(),
  });

  const isLoading = analyticsLoading || revenueLoading;

  if (isLoading) {
    return <div className="py-20 text-center text-gray-500">Loading analytics...</div>;
  }

  const topCourses = analytics?.top_courses ?? [];
  const completionByCourse = analytics?.completion_by_course ?? [];
  const maxEnrollments = Math.max(...topCourses.map((c) => c.enrollments), 1);
  const maxCompletion = 100;
  const monthlyRevenue = revenue?.monthly ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">Platform performance at a glance.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Active Students" value={analytics?.unique_students ?? 0} />
        <StatCard icon={BarChart3} label="Total Enrollments" value={analytics?.total_enrollments ?? 0} />
        <StatCard
          icon={TrendingUp}
          label="Average Progress"
          value={`${Math.round(analytics?.average_progress ?? 0)}%`}
        />
        <StatCard icon={Award} label="Course Completions" value={analytics?.course_completions ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Courses by Enrollment */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Top Courses by Enrollment</h2>
          {topCourses.length === 0 ? (
            <p className="text-sm text-gray-500">No enrollment data yet.</p>
          ) : (
            <div className="space-y-3">
              {topCourses.slice(0, 8).map((c) => (
                <HorizontalBar key={c.course} label={c.title} value={c.enrollments} max={maxEnrollments} />
              ))}
            </div>
          )}
        </div>

        {/* Completion Rates */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-dark" />
            <h2 className="text-lg font-semibold text-gray-900">Completion Rates</h2>
          </div>
          {completionByCourse.length === 0 ? (
            <p className="text-sm text-gray-500">No completion data yet.</p>
          ) : (
            <div className="space-y-3">
              {completionByCourse.map((c) => (
                <HorizontalBar
                  key={c.course}
                  label={c.title}
                  value={Math.round(c.completion_rate)}
                  max={maxCompletion}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Enrollment Activity */}
      {analytics?.enrollment_activity && analytics.enrollment_activity.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Daily Enrollments</h2>
          <div className="flex items-end gap-1" style={{ height: 160 }}>
            {(() => {
              const maxVal = Math.max(...analytics.enrollment_activity.map((d) => d.new_enrollments), 1);
              return analytics.enrollment_activity.map((d) => (
                <div key={d.date} className="group relative flex-1">
                  <div
                    className="w-full rounded-t bg-dark transition-all hover:bg-dark/80"
                    style={{ height: `${(d.new_enrollments / maxVal) * 140}px` }}
                  />
                  <div className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                    {d.new_enrollments}
                  </div>
                </div>
              ));
            })()}
          </div>
          <div className="mt-2 flex justify-between text-xs text-gray-400">
            <span>{analytics.enrollment_activity[0]?.date}</span>
            <span>{analytics.enrollment_activity[analytics.enrollment_activity.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Revenue Trend Table */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-dark" />
          <h2 className="text-lg font-semibold text-gray-900">Monthly Revenue</h2>
        </div>
        {monthlyRevenue.length === 0 ? (
          <p className="text-sm text-gray-500">No revenue data yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Month</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Revenue (ETB)</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Bar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(() => {
                  const maxRev = Math.max(...monthlyRevenue.map((m) => m.total), 1);
                  return monthlyRevenue.map((m) => (
                    <tr key={m.month}>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">{m.month}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right text-sm font-medium text-gray-900">
                        {m.total.toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <div className="h-4 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-dark"
                            style={{ width: `${(m.total / maxRev) * 100}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
