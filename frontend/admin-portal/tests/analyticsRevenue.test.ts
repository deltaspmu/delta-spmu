import assert from 'node:assert/strict';

import type { RevenueStats } from '../src/types/index.ts';
import {
  getEtbDailyRevenue,
  getTotalRevenueEtb,
} from '../src/utils/revenueStats.ts';

const response: RevenueStats = {
  total_revenue_etb: 25_000,
  total_revenue_usd: 80,
  transaction_counts: { Completed: 3 },
  daily_revenue: [
    {
      date: '2026-07-29',
      currency: 'ETB',
      transaction_count: 1,
      total_amount: 12_500,
    },
    {
      date: '2026-07-28',
      currency: 'USD',
      transaction_count: 1,
      total_amount: 80,
    },
    {
      date: '2026-07-28',
      currency: 'ETB',
      transaction_count: 1,
      total_amount: 12_500,
    },
  ],
};

assert.equal(getTotalRevenueEtb(response), 25_000);
assert.deepEqual(getEtbDailyRevenue(response), [
  {
    date: '2026-07-28',
    currency: 'ETB',
    transaction_count: 1,
    total_amount: 12_500,
  },
  {
    date: '2026-07-29',
    currency: 'ETB',
    transaction_count: 1,
    total_amount: 12_500,
  },
]);
assert.equal(getTotalRevenueEtb(undefined), 0);
assert.deepEqual(getEtbDailyRevenue(undefined), []);

console.log('ok');
