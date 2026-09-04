import { format, parseISO } from 'date-fns';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Shared chart primitives for the analytics pages.
 *
 * Every chart here plots ONE series, so color encodes magnitude rather than
 * identity: a single hue from the brand's forest-green family, never a
 * categorical rotation. Coloring nominal bars by their own value would spend
 * the identity channel re-encoding what bar length already shows.
 *
 * MARK is `--color-dark-light`. The gold `--color-primary` (#C9A96E) is
 * deliberately NOT used for marks — it measures 2.18:1 against the white card,
 * below the 3:1 floor a data mark needs. Gold stays on chrome and text.
 */
const MARK = '#2D4A38';
const GRID = '#E5E7EB';      // hairline, one step off the surface
const AXIS_TEXT = '#6B7280'; // ink, never the data color

const AXIS_TICK = { fill: AXIS_TEXT, fontSize: 12 };

/** Compact axis labels: 12,500 → 12.5k, so ticks stay short and scannable. */
function compact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/**
 * Course titles run to ~48 characters. Left whole, recharts wraps them over
 * several lines and adjacent rows collide into an unreadable stack, so the tick
 * gets a shortened form and the tooltip carries the full name. The ellipsis is
 * explicit — the reader can see the label was shortened, unlike a silent crop.
 *
 * It keeps the END, not the start: this catalog's titles all open with
 * "Professional Certificate in …", so a head-truncated label renders every
 * course identically and the axis stops distinguishing anything. The tail is
 * snapped to a word boundary so it never begins mid-word.
 */
function truncate(text: string, max = 26) {
  if (text.length <= max) return text;
  let tail = text.slice(-(max - 1));
  const space = tail.indexOf(' ');
  if (space > -1 && space < 8) tail = tail.slice(space + 1);
  return `…${tail}`;
}

function shortDate(iso: string) {
  try {
    return format(parseISO(iso), 'MMM d');
  } catch {
    return iso;
  }
}

function TooltipCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-gray-900">{title}</p>
      {rows.map(([k, v]) => (
        <p key={k} className="text-gray-600">
          {k}: <span className="font-semibold text-gray-900">{v}</span>
        </p>
      ))}
    </div>
  );
}

export interface TrendPoint {
  date: string;
  value: number;
}

/**
 * A daily time series as an area chart.
 *
 * Single series, so no legend box — the panel heading names what is plotted.
 * The fill is a wash rather than a saturated block; the 2px stroke carries the
 * shape. Values are read from the axis and the hover tooltip instead of being
 * printed on every point.
 */
export function TrendArea({
  data,
  label,
  formatValue = (n: number) => n.toLocaleString(),
  height = 220,
}: {
  data: TrendPoint[];
  label: string;
  formatValue?: (n: number) => string;
  height?: number;
}) {
  const gradientId = `fill-${label.replace(/\W+/g, '-').toLowerCase()}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={MARK} stopOpacity={0.16} />
            <stop offset="100%" stopColor={MARK} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        {/* Solid hairline, horizontal only — recessive, never dashed. */}
        <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          minTickGap={28}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={44}
          allowDecimals={false}
          tickFormatter={compact}
        />
        <Tooltip
          cursor={{ stroke: MARK, strokeWidth: 1 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as TrendPoint;
            return (
              <TooltipCard
                title={shortDate(p.date)}
                rows={[[label, formatValue(p.value)]]}
              />
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={MARK}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill={`url(#${gradientId})`}
          // A lone point draws no line, so give it a visible dot to land on.
          dot={data.length === 1 ? { r: 4, fill: MARK, stroke: '#fff', strokeWidth: 2 } : false}
          activeDot={{ r: 4, fill: MARK, stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export interface CategoryRow {
  label: string;
  value: number;
}

/**
 * Ranked categories as horizontal bars.
 *
 * Horizontal because these labels are words of unpredictable length (course
 * titles, CTA names) — vertical columns would force them to rotate or truncate.
 * One hue for every bar: length already encodes magnitude, so coloring each bar
 * differently would imply an identity that isn't there.
 */
export function CategoryBars({
  rows,
  label,
  formatValue = (n: number) => n.toLocaleString(),
  maxBarSize = 24,
}: {
  rows: CategoryRow[];
  label: string;
  formatValue?: (n: number) => string;
  maxBarSize?: number;
}) {
  // Room per row for the bar plus its share of the surface gap, with a floor so
  // a two-row panel doesn't stretch its bars into slabs.
  const height = Math.max(rows.length * 34 + 16, 96);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
        barCategoryGap={6}
      >
        <CartesianGrid stroke={GRID} strokeWidth={1} horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={compact} />
        <YAxis
          type="category"
          dataKey="label"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={160}
          interval={0}
          tickFormatter={(v: string) => truncate(v)}
        />
        <Tooltip
          cursor={{ fill: 'rgba(45,74,56,0.06)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as CategoryRow;
            return <TooltipCard title={p.label} rows={[[label, formatValue(p.value)]]} />;
          }}
        />
        {/* Rounded at the data end, square at the baseline. */}
        <Bar dataKey="value" fill={MARK} radius={[0, 4, 4, 0]} maxBarSize={maxBarSize}>
          {rows.map((r) => (
            <Cell key={r.label} fill={MARK} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
