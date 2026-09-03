import type { SiteFunnel } from '@/types';

export interface FunnelStep {
  key: keyof typeof STEP_LABELS;
  label: string;
  value: number;
  /** Conversion from the reference stage, or null for the top of the funnel. */
  rate: number | null;
  /** Which stage `rate` is a percentage of. */
  rateOf: string;
}

const STEP_LABELS = {
  visitors: 'Visitors',
  cta_visitors: 'Clicked through',
  signups: 'Signed up',
  verified_signups: 'Verified email',
  checkouts_started: 'Started checkout',
  checkouts_paid: 'Paid',
} as const;

/** Percentage of `denominator` that reached `numerator`; 0 when there's nothing to divide. */
export function rate(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * Flatten the funnel payload into display rows.
 *
 * Each rate is measured against the stage it genuinely follows from, not simply
 * the previous row. Signups are deliberately *not* shown as a percentage of
 * visitors: marketing visitors are anonymous and never linked across the domain
 * hop to the portal, so that ratio would look like a conversion rate while
 * actually comparing two unrelated populations.
 */
export function funnelSteps(funnel?: SiteFunnel): FunnelStep[] {
  const f: SiteFunnel = {
    visitors: 0,
    cta_visitors: 0,
    signups: 0,
    verified_signups: 0,
    checkouts_started: 0,
    checkouts_paid: 0,
    cta_rate: 0,
    verified_rate: 0,
    paid_rate: 0,
    ...(funnel ?? {}),
  };

  return [
    { key: 'visitors', label: STEP_LABELS.visitors, value: f.visitors, rate: null, rateOf: '' },
    {
      key: 'cta_visitors',
      label: STEP_LABELS.cta_visitors,
      value: f.cta_visitors,
      rate: rate(f.cta_visitors, f.visitors),
      rateOf: 'visitors',
    },
    { key: 'signups', label: STEP_LABELS.signups, value: f.signups, rate: null, rateOf: '' },
    {
      key: 'verified_signups',
      label: STEP_LABELS.verified_signups,
      value: f.verified_signups,
      rate: rate(f.verified_signups, f.signups),
      rateOf: 'signups',
    },
    {
      key: 'checkouts_started',
      label: STEP_LABELS.checkouts_started,
      value: f.checkouts_started,
      rate: null,
      rateOf: '',
    },
    {
      key: 'checkouts_paid',
      label: STEP_LABELS.checkouts_paid,
      value: f.checkouts_paid,
      rate: rate(f.checkouts_paid, f.checkouts_started),
      rateOf: 'checkouts',
    },
  ];
}
