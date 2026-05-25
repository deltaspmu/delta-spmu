/**
 * Delta SPMU Academy — Google Analytics 4 Integration
 */

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

/**
 * Initialize GA4 by injecting the script tag.
 */
export function initGA(): void {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined') return;

  // Inject gtag script
  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  script.async = true;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false, // We'll send manually on route change
  });
}

/**
 * Track a page view.
 */
export function trackPageView(path: string, title?: string): void {
  if (!GA_MEASUREMENT_ID || !window.gtag) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
  });
}

/**
 * Track a custom event.
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
): void {
  if (!GA_MEASUREMENT_ID || !window.gtag) return;
  window.gtag('event', eventName, params);
}

/**
 * Track course-related events.
 */
export function trackCourseEvent(
  action: 'view' | 'enroll' | 'complete' | 'purchase',
  courseId: string,
  courseTitle?: string
): void {
  trackEvent(`course_${action}`, {
    course_id: courseId,
    course_title: courseTitle || '',
  });
}

/**
 * Track payment events.
 */
export function trackPaymentEvent(
  action: 'initiated' | 'completed' | 'failed',
  method: string,
  amount: number,
  currency: string
): void {
  trackEvent(`payment_${action}`, {
    payment_method: method,
    value: amount,
    currency,
  });
}

/**
 * Track lesson progress events.
 */
export function trackLessonEvent(
  action: 'start' | 'complete',
  courseId: string,
  lessonId: string
): void {
  trackEvent(`lesson_${action}`, {
    course_id: courseId,
    lesson_id: lessonId,
  });
}

/**
 * Track quiz events.
 */
export function trackQuizEvent(
  action: 'start' | 'submit' | 'pass' | 'fail',
  quizId: string,
  score?: number
): void {
  trackEvent(`quiz_${action}`, {
    quiz_id: quizId,
    ...(score !== undefined ? { score } : {}),
  });
}
