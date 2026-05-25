/**
 * Delta SPMU Academy — Date locale utilities
 */

import { format, formatDistance, parseISO, isValid } from 'date-fns';

/**
 * Format an ISO date string to a display format.
 */
export function formatDisplayDate(dateStr: string | null | undefined, fmt: string = 'MMM d, yyyy'): string {
  if (!dateStr) return '';
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;
    return format(date, fmt);
  } catch {
    return dateStr;
  }
}

/**
 * Format a date to relative time (e.g., "3 days ago").
 */
export function formatTimeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;
    return formatDistance(date, new Date(), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

/**
 * Format date and time.
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  return formatDisplayDate(dateStr, 'MMM d, yyyy h:mm a');
}

/**
 * Get remaining days from an end date.
 */
export function getDaysRemaining(endDateStr: string | null | undefined): number {
  if (!endDateStr) return 0;
  try {
    const endDate = parseISO(endDateStr);
    if (!isValid(endDate)) return 0;
    const now = new Date();
    const diffMs = endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}
