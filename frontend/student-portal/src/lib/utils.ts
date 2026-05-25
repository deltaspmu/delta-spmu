/**
 * Delta SPMU Academy — Utility Functions
 */

// Same-origin by default — Vercel rewrites /files/* to api.deltaspmu.com.
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

/**
 * Resolve a Frappe file path to a full URL.
 *
 * - Absolute http(s) URLs pass through.
 * - Frappe-served paths like `/files/...` or `/private/...` get the API base.
 * - Client-side static paths like `/images/...` and `/assets/...` are left
 *   alone so the browser resolves them against the student portal origin.
 */
export function getFileUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/images/') || path.startsWith('/assets/')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Get course image URL with fallback placeholder.
 *
 * If the course has no image set, fall back to a per-title heuristic so the
 * four canonical course tiers always have brand-consistent thumbnails even
 * before an admin uploads a real one through the admin portal.
 */
export function getCourseImageUrl(course: { image?: string | null; title?: string }): string {
  if (course.image) return getFileUrl(course.image);

  const title = (course.title || '').toLowerCase();
  if (title.includes('foundation')) return '/images/course-foundation.jpg';
  if (title.includes('advanced')) return '/images/course-advanced.jpg';
  if (title.includes('master')) return '/images/course-master.jpg';
  if (title.includes('instructor')) return '/images/course-instructor.jpg';
  return '/images/course-placeholder.jpg';
}

/**
 * Get user avatar URL with placeholder fallback.
 */
export function getUserAvatarUrl(user: { user_image?: string | null; full_name?: string }): string {
  if (user.user_image) return getFileUrl(user.user_image);
  const name = user.full_name || 'U';
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=D1BFAE&color=121212&size=128`;
}

/**
 * Format price with currency symbol.
 */
export function formatPrice(amount: number, currency: string = 'ETB'): string {
  if (currency === 'USD') {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ETB`;
}

/**
 * Format duration in minutes to human-readable string.
 */
export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Format a date string to a readable format.
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a date to relative time (e.g., "2 days ago").
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(dateStr);
}

/**
 * Truncate text to a max length with ellipsis.
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text || '';
  return text.slice(0, maxLength).trimEnd() + '...';
}

/**
 * Extract Vimeo video ID and privacy hash from stored format "id/hash".
 */
export function parseVimeoVideo(value: string | null | undefined): { id: string; hash: string | null } | null {
  if (!value) return null;
  const parts = value.split('/');
  return {
    id: parts[0],
    hash: parts[1] || null,
  };
}

/**
 * Generate class names conditionally (simple clsx alternative).
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Debounce a function call.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Get the payment method display name.
 */
export function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    telebirr: 'telebirr',
    chapa: 'Chapa',
    chapa_international: 'Chapa (International)',
    ethswitch: 'EthSwitch (Bank)',
    cbe: 'CBE Bank Transfer',
  };
  return labels[method] || method;
}

/**
 * Get transaction status color class.
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    Completed: 'text-success',
    Pending: 'text-warning',
    Processing: 'text-info',
    Failed: 'text-error',
    'Pending Verification': 'text-warning',
  };
  return colors[status] || 'text-dark';
}
