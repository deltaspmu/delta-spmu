import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { getAnalyticsSummary, getRevenueStats, getSiteAnalytics } from '@/api/client';
import type { AnalyticsData, RevenueStats, SiteAnalytics } from '@/types';
import { getEtbDailyRevenue, getTotalRevenueEtb } from '@/utils/revenueStats';
import { funnelSteps } from '@/utils/siteFunnel';
import {
  BarChart3,
  Users,
  TrendingUp,
  Award,
  DollarSign,
  Eye,
  MousePointerClick,
  UserPlus,
  ShoppingCart,
  MailOpen,
  AlertTriangle,
} from 'lucide-react';

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

/** A labelled list panel that degrades to a message instead of an empty box. */
function BarPanel({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { label: string; value: number }[];
  empty: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">{empty}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <HorizontalBar key={r.label} label={r.label} value={r.value} max={max} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Daily bars — the same hand-rolled chart the learning tab has always used. */
function DailyBars({ data }: { data: { date: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <>
      <div className="flex items-end gap-1" style={{ height: 160 }}>
        {data.map((d) => (
          <div key={d.date} className="group relative flex-1">
            <div
              className="w-full rounded-t bg-dark transition-all hover:bg-dark/80"
              style={{ height: `${(d.value / max) * 140}px` }}
            />
            <div className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
              {d.date}: {d.value}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-gray-400">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </>
  );
}

const STEP_ICONS = {
  visitors: Eye,
  cta_visitors: MousePointerClick,
  signups: UserPlus,
  verified_signups: MailOpen,
  checkouts_started: ShoppingCart,
  checkouts_paid: DollarSign,
} as const;

function Acquisition({ data }: { data: SiteAnalytics }) {
  const steps = funnelSteps(data.funnel);
  const traffic = data.traffic ?? [];

  return (
    <div className="space-y-8">
      {!data.collector_ready && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Visitor tracking is not set up on this environment yet.</p>
            <p className="mt-1 text-amber-800">
              Run{' '}
              <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
                bench --site &lt;site&gt; execute lms.lms.site_analytics.setup
              </code>{' '}
              to start collecting. Signup and checkout figures below are unaffected.
            </p>
          </div>
        </div>
      )}

      {/* Funnel */}
      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Acquisition funnel</h2>
          <p className="text-xs text-gray-400">
            Stages are counted independently — marketing visitors are anonymous, so these
            are not the same people tracked through each step.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {steps.map((step) => (
            <StatCard
              key={step.key}
              icon={STEP_ICONS[step.key]}
              label={step.label}
              value={step.value.toLocaleString()}
              sub={step.rate === null ? undefined : `${step.rate}% of ${step.rateOf}`}
            />
          ))}
        </div>
      </div>

      {/* Traffic trend */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Daily visitors</h2>
        {traffic.length === 0 ? (
          <p className="text-sm text-gray-500">No visits recorded in this range yet.</p>
        ) : (
          <DailyBars data={traffic.map((d) => ({ date: d.date, value: d.visitors }))} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BarPanel
          title="Traffic sources"
          rows={data.sources?.map((s) => ({ label: s.source, value: s.visitors })) ?? []}
          empty="No traffic recorded yet."
        />
        <BarPanel
          title="Devices"
          rows={data.devices?.map((d) => ({ label: d.device, value: d.visitors })) ?? []}
          empty="No traffic recorded yet."
        />
        <BarPanel
          title="Call-to-action clicks"
          rows={data.cta_clicks?.map((c) => ({ label: c.label, value: c.clicks })) ?? []}
          empty="No CTA clicks recorded yet."
        />
        <BarPanel
          title="How far visitors scroll"
          rows={
            data.scroll_reach?.map((s) => ({
              // Labels arrive as "3-programs" so they sort in page order.
              label: s.bucket.replace(/^\d+-/, ''),
              value: s.sessions,
            })) ?? []
          }
          empty="No scroll data recorded yet."
        />
      </div>

      {/* Lost revenue */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ShoppingCart}
          label="Abandoned checkouts"
          value={data.abandoned_count}
          sub={`ETB ${Math.round(data.abandoned_value).toLocaleString()} not collected`}
        />
        <StatCard icon={AlertTriangle} label="Failed payments" value={data.failed_count} sub="Provider errors" />
        <StatCard icon={MailOpen} label="Contact form messages" value={data.contact_submits} />
        <StatCard
          icon={DollarSign}
          label="Paid transactions"
          value={data.paid_transactions}
          sub={`of ${data.checkout_transactions} started`}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-dark" />
          <h2 className="text-lg font-semibold text-gray-900">Abandoned checkouts</h2>
          <span className="text-xs text-gray-400">People who started paying and stopped</span>
        </div>
        {(data.abandoned?.length ?? 0) === 0 ? (
          <p className="text-sm text-gray-500">No abandoned checkouts in this range.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Student</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Course</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Amount</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Method</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.abandoned.map((tx) => (
                  <tr key={tx.transaction_id}>
                    <td className="px-4 py-2 text-sm text-gray-700">{tx.user}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{tx.course_title || tx.course}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right text-sm font-medium text-gray-900">
                      {tx.currency} {tx.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">{tx.payment_method}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">
                      {tx.creation.slice(0, 16)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Learning({ analytics, revenue }: { analytics?: AnalyticsData; revenue?: RevenueStats }) {
  const topCourses = analytics?.top_courses ?? [];
  const completionByCourse = analytics?.completion_by_course ?? [];
  const totalRevenueEtb = getTotalRevenueEtb(revenue);
  const dailyRevenue = getEtbDailyRevenue(revenue);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={Users} label="Active Students" value={analytics?.unique_students ?? 0} />
        <StatCard icon={BarChart3} label="Total Enrollments" value={analytics?.total_enrollments ?? 0} />
        <StatCard
          icon={TrendingUp}
          label="Average Progress"
          value={`${Math.round(analytics?.average_progress ?? 0)}%`}
        />
        <StatCard icon={Award} label="Course Completions" value={analytics?.course_completions ?? 0} />
        <StatCard icon={DollarSign} label="Total Revenue" value={`ETB ${totalRevenueEtb.toLocaleString()}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BarPanel
          title="Top Courses by Enrollment"
          rows={topCourses.slice(0, 8).map((c) => ({ label: c.title, value: c.enrollments }))}
          empty="No enrollment data yet."
        />
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
                  max={100}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {analytics?.enrollment_activity && analytics.enrollment_activity.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Daily Enrollments</h2>
          <DailyBars
            data={analytics.enrollment_activity.map((d) => ({
              date: d.date,
              value: d.new_enrollments,
            }))}
          />
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-dark" />
          <h2 className="text-lg font-semibold text-gray-900">Daily Revenue</h2>
          <span className="text-xs text-gray-400">Last 30 days</span>
        </div>
        {dailyRevenue.length === 0 ? (
          <p className="text-sm text-gray-500">No revenue data yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Revenue (ETB)</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Bar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(() => {
                  const maxRev = Math.max(...dailyRevenue.map((day) => day.total_amount), 1);
                  return dailyRevenue.map((day) => (
                    <tr key={day.date}>
                      <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-700">{day.date}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right text-sm font-medium text-gray-900">
                        {day.total_amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <div className="h-4 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-dark"
                            style={{ width: `${(day.total_amount / maxRev) * 100}%` }}
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

      {/* Already returned by admin_get_revenue_stats; previously never rendered. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <BarPanel
          title="Revenue by Payment Method"
          rows={
            revenue?.revenue_by_method
              ?.filter((r) => r.currency === 'ETB')
              .map((r) => ({ label: r.payment_method, value: Math.round(r.total_amount) })) ?? []
          }
          empty="No completed payments yet."
        />
        <BarPanel
          title="Revenue by Course"
          rows={
            revenue?.revenue_by_course
              ?.filter((r) => r.currency === 'ETB')
              .map((r) => ({ label: r.course_title || r.course, value: Math.round(r.total_amount) })) ?? []
          }
          empty="No completed payments yet."
        />
      </div>
    </div>
  );
}

const TABS = [
  { id: 'acquisition', label: 'Acquisition' },
  { id: 'learning', label: 'Learning' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function Analytics() {
  const [tab, setTab] = useState<TabId>('acquisition');
  const [fromDate, setFromDate] = useState(() => format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const site = useQuery<SiteAnalytics>({
    queryKey: ['site-analytics', fromDate, toDate],
    queryFn: () => getSiteAnalytics({ from_date: fromDate, to_date: toDate }),
    enabled: tab === 'acquisition',
  });

  const analytics = useQuery<AnalyticsData>({
    queryKey: ['analytics'],
    queryFn: getAnalyticsSummary,
    enabled: tab === 'learning',
  });

  const revenue = useQuery<RevenueStats>({
    queryKey: ['revenue-stats'],
    queryFn: () => getRevenueStats(),
    enabled: tab === 'learning',
  });

  const isLoading = tab === 'acquisition' ? site.isLoading : analytics.isLoading || revenue.isLoading;
  const error = tab === 'acquisition' ? site.error : analytics.error || revenue.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          {tab === 'acquisition'
            ? 'How people find deltaspmu.com and how far they get toward paying.'
            : 'Platform performance at a glance.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'border-dark text-dark'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'acquisition' && (
          <div className="flex items-center gap-2 pb-2 text-sm">
            <label htmlFor="from-date" className="text-gray-500">From</label>
            <input
              id="from-date"
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-1"
            />
            <label htmlFor="to-date" className="text-gray-500">To</label>
            <input
              id="to-date"
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-1"
            />
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-gray-500">Loading analytics...</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          Could not load analytics. {(error as Error).message}
        </div>
      ) : tab === 'acquisition' ? (
        site.data ? <Acquisition data={site.data} /> : null
      ) : (
        <Learning analytics={analytics.data} revenue={revenue.data} />
      )}
    </div>
  );
}
