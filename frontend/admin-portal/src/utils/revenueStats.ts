import type { DailyRevenue, RevenueStats } from '../types/index.ts';

function finiteNumber(value: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function getTotalRevenueEtb(stats?: RevenueStats | null): number {
  return finiteNumber(stats?.total_revenue_etb ?? 0);
}

export function getEtbDailyRevenue(stats?: RevenueStats | null): DailyRevenue[] {
  return (stats?.daily_revenue ?? [])
    .filter((row) => row.currency.toUpperCase() === 'ETB')
    .map((row) => ({
      ...row,
      transaction_count: finiteNumber(row.transaction_count),
      total_amount: finiteNumber(row.total_amount),
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
}
