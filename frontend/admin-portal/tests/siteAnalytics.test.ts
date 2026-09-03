import assert from 'node:assert/strict';

import type { SiteFunnel } from '../src/types/index.ts';
import { funnelSteps, rate } from '../src/utils/siteFunnel.ts';

// --- rate ------------------------------------------------------------------

assert.equal(rate(50, 200), 25);
assert.equal(rate(1, 3), 33.3);
assert.equal(rate(11, 11), 100);

// A brand-new site has no traffic. The dashboard must render 0, not NaN or
// Infinity — this is the case that actually ships first.
assert.equal(rate(0, 0), 0);
assert.equal(rate(5, 0), 0);

// --- funnelSteps -----------------------------------------------------------

const funnel: SiteFunnel = {
  visitors: 1240,
  cta_visitors: 312,
  signups: 48,
  verified_signups: 30,
  checkouts_started: 20,
  checkouts_paid: 11,
  cta_rate: 25.2,
  verified_rate: 62.5,
  paid_rate: 55,
};

const steps = funnelSteps(funnel);
assert.equal(steps.length, 6);
assert.deepEqual(
  steps.map((s) => s.value),
  [1240, 312, 48, 30, 20, 11],
);

// Rates are measured against the stage they genuinely follow from.
const byKey = Object.fromEntries(steps.map((s) => [s.key, s]));
assert.equal(byKey.cta_visitors.rate, 25.2);
assert.equal(byKey.cta_visitors.rateOf, 'visitors');
assert.equal(byKey.verified_signups.rate, 62.5);
assert.equal(byKey.verified_signups.rateOf, 'signups');
assert.equal(byKey.checkouts_paid.rate, 55);

// Signups must NOT be expressed as a share of visitors: the two populations are
// never linked across the domain hop, so such a ratio would be a fiction.
assert.equal(byKey.visitors.rate, null);
assert.equal(byKey.signups.rate, null);
assert.equal(byKey.checkouts_started.rate, null);

// An empty/absent payload renders zeros rather than throwing.
const empty = funnelSteps(undefined);
assert.equal(empty.length, 6);
assert.deepEqual(
  empty.map((s) => s.value),
  [0, 0, 0, 0, 0, 0],
);
assert.deepEqual(
  empty.filter((s) => s.rate !== null).map((s) => s.rate),
  [0, 0, 0],
);

console.log('siteAnalytics: all assertions passed');
