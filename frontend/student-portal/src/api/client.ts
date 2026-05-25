import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL || 'https://api.deltaspmu.com');

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// CSRF interceptor — REQUIRED for POST/PUT/DELETE to Frappe
//
// Same-origin (dev via Vite proxy): the `csrf_token` cookie is readable from
// document.cookie. Cross-origin (Vercel → api.deltaspmu.com in production):
// the browser does not expose the cookie to JS, so we fall back to fetching
// the token via the `get_csrf_token` API endpoint and caching it.
// ---------------------------------------------------------------------------
let cachedCSRFToken: string | null = null;

function readCSRFCookie(): string | null {
  const raw = document.cookie
    .split('; ')
    .find((row) => row.startsWith('csrf_token='))
    ?.split('=')[1];
  return raw ? decodeURIComponent(raw) : null;
}

async function ensureCSRFToken(): Promise<string | null> {
  // 1. Cookie (same-origin)
  const cookie = readCSRFCookie();
  if (cookie) return cookie;

  // 2. In-memory cache (cross-origin)
  if (cachedCSRFToken) return cachedCSRFToken;

  // 3. Fetch from API
  try {
    const res = await api.get('/api/method/lms.lms.api.get_csrf_token');
    cachedCSRFToken = (res.data?.message as string) || null;
    return cachedCSRFToken;
  } catch {
    return null;
  }
}

api.interceptors.request.use(async (config) => {
  if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
    const token = await ensureCSRFToken();
    if (token) {
      config.headers['X-Frappe-CSRF-Token'] = token;
    }
  }
  return config;
});

// ---------------------------------------------------------------------------
// Session expiry handler — redirect to login on 401
// ---------------------------------------------------------------------------
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      cachedCSRFToken = null;
      localStorage.removeItem('deltaspmu_user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------------------
// Helper to unwrap Frappe's { message: ... } envelope
// ---------------------------------------------------------------------------
const unwrap = <T = unknown>(res: { data: { message: T } }): T => res.data.message;

// ===========================================================================
// Auth
// ===========================================================================

export const login = (email: string, password: string) =>
  api.post('/api/method/login', { usr: email, pwd: password }).then(unwrap);

export const logout = () =>
  api.get('/api/method/logout').then(unwrap);

export const signUp = (email: string, fullName: string, password: string) =>
  api
    .post('/api/method/frappe.core.doctype.user.user.sign_up', {
      email,
      full_name: fullName,
      password,
      redirect_to: '/verify',
    })
    .then(unwrap);

export const forgotPassword = (email: string) =>
  api
    .post('/api/method/frappe.core.doctype.user.user.reset_password', { user: email })
    .then(unwrap);

export const resetPassword = (key: string, password: string) =>
  api
    .post('/api/method/frappe.core.doctype.user.user.update_password', {
      key,
      new_password: password,
      logout_all_sessions: 1,
    })
    .then(unwrap);

export const verifyEmail = (key: string) =>
  api
    .get('/api/method/frappe.core.doctype.user.user.verify_email', { params: { key } })
    .then(unwrap);

// ===========================================================================
// User
// ===========================================================================

export const getUserInfo = () =>
  api.get('/api/method/lms.lms.api.get_user_info').then(unwrap);

export const getUserBio = () =>
  api.get('/api/method/lms.lms.api.get_user_bio').then(unwrap);

export const updateUserProfile = (data: Record<string, unknown>) =>
  api
    .post('/api/method/lms.lms.api.update_user_profile', {
      data: JSON.stringify(data),
    })
    .then(unwrap);

export const updateNotificationPreferences = (prefs: Record<string, unknown>) =>
  api
    .post('/api/method/lms.lms.api.update_notification_preferences', {
      prefs: JSON.stringify(prefs),
    })
    .then(unwrap);

export const deleteUserAccount = () =>
  api.post('/api/method/lms.lms.api.delete_user_account').then(unwrap);

export const uploadAvatar = (file: File, userEmail: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('is_private', '0');
  formData.append('doctype', 'User');
  formData.append('docname', userEmail);
  return api
    .post('/api/method/upload_file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then(unwrap);
};

// ===========================================================================
// Branding & Settings
// ===========================================================================

export const getCSRFToken = () =>
  api.get('/api/method/lms.lms.api.get_csrf_token').then(unwrap);

export const submitContactForm = (payload: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) =>
  api
    .post('/api/method/lms.lms.api.submit_contact_form', payload)
    .then(unwrap);

export const getBranding = () =>
  api.get('/api/method/lms.lms.api.get_branding').then(unwrap);

export const getLMSSettings = () =>
  api.get('/api/method/lms.lms.api.get_lms_settings').then(unwrap);

export const getTranslations = (language: string) =>
  api
    .get('/api/method/lms.lms.api.get_translations', { params: { language } })
    .then(unwrap);

// ===========================================================================
// Courses
// ===========================================================================

export const getCourses = (params?: {
  limit?: number;
  offset?: number;
  category?: string;
  search?: string;
  order_by?: string;
}) => {
  const { category, search, ...rest } = params || {};
  const filters: Record<string, string> = {};
  if (category) filters.category = category;
  if (search) filters.search = search;
  return api
    .get('/api/method/lms.lms.api.get_courses', {
      params: {
        ...rest,
        ...(Object.keys(filters).length > 0 ? { filters: JSON.stringify(filters) } : {}),
      },
    })
    .then(unwrap);
};

export const getCourseDetail = (courseName: string) =>
  api
    .get('/api/method/lms.lms.api.get_course_detail', {
      params: { course_name: courseName },
    })
    .then(unwrap);

export const getCourseChapters = (courseName: string) =>
  api
    .get('/api/method/lms.lms.api.get_course_chapters', {
      params: { course_name: courseName },
    })
    .then(unwrap);

export const getLessonDetails = (
  course: string,
  chapterNumber: number,
  lessonNumber: number
) =>
  api
    .get('/api/method/lms.lms.api.get_lesson_details', {
      params: { course, chapter_number: chapterNumber, lesson_number: lessonNumber },
    })
    .then(unwrap);

export const getCategories = () =>
  api
    .get('/api/method/lms.lms.api.get_categories', {
      params: { doctype: 'LMS Category' },
    })
    .then(unwrap);

export const getCourseReviews = (
  courseName: string,
  limit?: number,
  offset?: number
) =>
  api
    .get('/api/method/lms.lms.api.get_course_reviews', {
      params: { course_name: courseName, limit, offset },
    })
    .then(unwrap);

// ===========================================================================
// Enrollment & Progress
// ===========================================================================

export const getEnrollmentStatus = (course: string) =>
  api
    .get('/api/method/lms.lms.api.get_enrollment_status', { params: { course } })
    .then(unwrap);

export const getEnrolledCourses = () =>
  api.get('/api/method/lms.lms.api.get_enrolled_courses').then(unwrap);

export const getCourseProgress = (course: string) =>
  api
    .get('/api/method/lms.lms.custom_api.get_course_progress', { params: { course } })
    .then(unwrap);

export const saveCurrentLesson = (courseName: string, lessonName: string) =>
  api
    .post('/api/method/lms.lms.api.save_current_lesson', {
      course_name: courseName,
      lesson_name: lessonName,
    })
    .then(unwrap);

export const markLessonProgress = (
  course: string,
  chapterNumber: number,
  lessonNumber: number
) =>
  api
    .post('/api/method/lms.lms.api.mark_lesson_progress', {
      course,
      chapter_number: chapterNumber,
      lesson_number: lessonNumber,
    })
    .then(unwrap);

export const markLessonComplete = (course: string, lesson: string) =>
  api
    .post('/api/method/lms.lms.custom_api.mark_lesson_complete', { course, lesson })
    .then(unwrap);

export const checkLessonAccess = (course: string, lesson: string) =>
  api
    .get('/api/method/lms.lms.custom_api.check_lesson_access', {
      params: { course, lesson },
    })
    .then(unwrap);

// ===========================================================================
// Quiz
// ===========================================================================

export const getQuiz = (quiz: string) =>
  api
    .get('/api/method/lms.lms.custom_api.get_quiz', { params: { quiz } })
    .then(unwrap);

export const submitQuiz = (quiz: string, answers: Record<string, unknown>) =>
  api
    .post('/api/method/lms.lms.custom_api.submit_quiz', {
      quiz,
      answers: JSON.stringify(answers),
    })
    .then(unwrap);

export const checkFinalQuizAccess = (course: string) =>
  api
    .get('/api/method/lms.lms.custom_api.check_final_quiz_access', {
      params: { course },
    })
    .then(unwrap);

// ===========================================================================
// Certificates
// ===========================================================================

export const getCertificates = () =>
  api.get('/api/method/lms.lms.api.get_certificates').then(unwrap);

export const checkAndGenerateCertificate = (course: string) =>
  api
    .get('/api/method/lms.lms.custom_api.check_and_generate_certificate', {
      params: { course },
    })
    .then(unwrap);

// ===========================================================================
// Payments
// ===========================================================================

export const getCoursePrice = (course: string, currency?: string) =>
  api
    .get('/api/method/lms.lms.payments_api.get_course_price', {
      params: { course, currency },
    })
    .then(unwrap);

/** Intentionally GET to bypass CSRF for payment initiation flow */
export const initiatePayment = (
  course: string,
  paymentMethod: string,
  phone?: string,
  currency?: string
) =>
  api
    .get('/api/method/lms.lms.payments_api.initiate_payment', {
      params: { course, payment_method: paymentMethod, phone, currency },
    })
    .then(unwrap);

export const checkPaymentStatus = (transactionId: string) =>
  api
    .get('/api/method/lms.lms.payments_api.check_payment_status', {
      params: { transaction_id: transactionId },
    })
    .then(unwrap);

export const verifyPayment = (transactionId: string, reference?: string) =>
  api
    .get('/api/method/lms.lms.payments_api.verify_payment', {
      params: { transaction_id: transactionId, reference },
    })
    .then(unwrap);

export const getUserTransactions = (limit?: number, offset?: number) =>
  api
    .get('/api/method/lms.lms.payments_api.get_user_transactions', {
      params: { limit, offset },
    })
    .then(unwrap);

export const getCourseAccess = (course: string) =>
  api
    .get('/api/method/lms.lms.payments_api.get_course_access', {
      params: { course },
    })
    .then(unwrap);

// ===========================================================================
// Reviews
// ===========================================================================

export const submitReview = (course: string, rating: number, review: string) =>
  api
    .post('/api/method/lms.lms.api.submit_review', { course, rating, review })
    .then(unwrap);

export const deleteReview = (reviewName: string) =>
  api
    .post('/api/method/lms.lms.api.delete_review', { review_name: reviewName })
    .then(unwrap);

// ===========================================================================
// Notifications
// ===========================================================================

export const getNotifications = (limit?: number, offset?: number) =>
  api
    .get('/api/method/lms.lms.api.get_notifications', { params: { limit, offset } })
    .then(unwrap);

export const markNotificationRead = (notification: string) =>
  api
    .post('/api/method/lms.lms.api.mark_notification_read', { notification })
    .then(unwrap);

// ===========================================================================
// Instructor
// ===========================================================================

export const getInstructorProfile = (user: string) =>
  api
    .get('/api/method/lms.lms.custom_api.get_instructor_profile', { params: { user } })
    .then(unwrap);

// ===========================================================================
// Exchange Rate
// ===========================================================================

export const getExchangeRate = (from?: string, to?: string) =>
  api
    .get('/api/method/lms.lms.exchange_rate.get_exchange_rate', {
      params: { from_currency: from, to_currency: to },
    })
    .then(unwrap);

// ===========================================================================
// Billing
// ===========================================================================

export const validateBillingAccess = (billingType: string, name: string) =>
  api
    .get('/api/method/lms.lms.api.validate_billing_access', {
      params: { billing_type: billingType, name },
    })
    .then(unwrap);

// ---------------------------------------------------------------------------
// Default export — raw Axios instance for advanced usage
// ---------------------------------------------------------------------------
export default api;
