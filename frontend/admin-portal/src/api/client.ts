import axios, { type AxiosInstance } from 'axios';

// ---------------------------------------------------------------------------
// Base configuration
// ---------------------------------------------------------------------------

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
// CSRF token cache (cross-origin -- cannot read cookie)
// ---------------------------------------------------------------------------

let cachedCSRFToken: string | null = null;

async function getCSRFToken(): Promise<string> {
  if (!cachedCSRFToken) {
    const res = await axios.get(
      `${API_BASE_URL}/api/method/lms.lms.api.get_csrf_token`,
      { withCredentials: true },
    );
    cachedCSRFToken = res.data.message;
  }
  return cachedCSRFToken!;
}

/** Reset the cached CSRF token (call after login / logout). */
export function resetCSRFToken(): void {
  cachedCSRFToken = null;
}

// ---------------------------------------------------------------------------
// Interceptors
// ---------------------------------------------------------------------------

// Attach CSRF token to mutating requests
api.interceptors.request.use(async (config) => {
  const method = config.method?.toLowerCase() || '';
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    const token = await getCSRFToken();
    config.headers['X-Frappe-CSRF-Token'] = token;
  }
  return config;
});

// Handle 401 (session expired) and 403 (CSRF mismatch)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // 401 -- redirect to login
    if (error.response?.status === 401) {
      cachedCSRFToken = null;
      localStorage.removeItem('deltaspmu_admin_user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    // 403 -- retry once with a fresh CSRF token
    if (error.response?.status === 403 && error.config && !error.config._retried) {
      error.config._retried = true;
      cachedCSRFToken = null;
      return api(error.config);
    }

    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const unwrap = (res: any) => res.data?.message ?? res.data;

function call(method: string, params?: Record<string, any>) {
  return api.post('/api/method/' + method, params).then(unwrap);
}

function resource(doctype: string) {
  return `/api/resource/${doctype}`;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function login(usr: string, pwd: string) {
  const res = await api.post('/api/method/login', { usr, pwd });
  cachedCSRFToken = null; // new session
  return unwrap(res);
}

export async function changeAdminPassword(new_password: string, confirm_password: string) {
  const res = await api.post('/api/method/lms.lms.api.admin_change_password', {
    new_password,
    confirm_password,
  });
  return unwrap(res);
}

export async function logout() {
  const res = await api.post('/api/method/logout');
  cachedCSRFToken = null;
  localStorage.removeItem('deltaspmu_admin_user');
  return unwrap(res);
}

export async function getUserInfo() {
  return call('lms.lms.api.get_user_info');
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboardStats() {
  // Aggregate from multiple sources — no single backend endpoint.
  // Frappe get_list returns an array; pick the first row's total.
  const firstTotal = (rows: any) => {
    if (Array.isArray(rows)) return Number(rows[0]?.total) || 0;
    return Number(rows?.total) || 0;
  };
  const [users, courses, enrollments, revenue] = await Promise.all([
    api.get(resource('User'), { params: { limit_page_length: 0, filters: [['enabled', '=', 1]], fields: ['count(name) as total'] } }).then(unwrap).then(firstTotal).catch(() => 0),
    api.get(resource('LMS Course'), { params: { limit_page_length: 0, fields: ['count(name) as total'] } }).then(unwrap).then(firstTotal).catch(() => 0),
    api.get(resource('LMS Enrollment'), { params: { limit_page_length: 0, fields: ['count(name) as total'] } }).then(unwrap).then(firstTotal).catch(() => 0),
    call('lms.lms.payments_api.admin_get_revenue_stats').catch(() => ({ total_revenue: 0 })),
  ]);
  return {
    users: { total: users },
    courses: { total: courses },
    enrollments: { total: enrollments },
    revenue: revenue || { total_revenue: 0 },
  };
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export async function getCourses(params?: Record<string, any>) {
  const res = await api.get(resource('LMS Course'), { params });
  return unwrap(res);
}

export async function getCourseDetail(name: string) {
  const res = await api.get(`${resource('LMS Course')}/${name}`);
  // Frappe REST wraps a single doc as { data: { ...doc } }. unwrap()
  // returns res.data (the outer envelope) — we need to peel one more
  // layer to get the actual doc fields.
  const wrapped: any = unwrap(res);
  return wrapped?.data ?? wrapped;
}

export async function createCourse(data: Record<string, any>) {
  const res = await api.post(resource('LMS Course'), data);
  return unwrap(res);
}

export async function updateCourse(name: string, data: Record<string, any>) {
  const res = await api.put(`${resource('LMS Course')}/${name}`, data);
  return unwrap(res);
}

export async function deleteCourse(name: string) {
  const res = await api.delete(`${resource('LMS Course')}/${name}`);
  return unwrap(res);
}

export async function cloneCourse(name: string) {
  // Clone by fetching original and creating a copy
  const original = await getCourseDetail(name);
  const cloneData = { ...original, name: undefined, title: `${original.title} (Copy)`, published: 0 };
  return createCourse(cloneData);
}

// Chapters

export async function getCourseChapters(course: string) {
  return call('lms.lms.api.get_course_chapters', { course });
}

export async function createChapter(data: Record<string, any>) {
  const res = await api.post(resource('Course Chapter'), data);
  return unwrap(res);
}

export async function updateChapter(name: string, data: Record<string, any>) {
  const res = await api.put(`${resource('Course Chapter')}/${name}`, data);
  return unwrap(res);
}

export async function deleteChapter(name: string) {
  const res = await api.delete(`${resource('Course Chapter')}/${name}`);
  return unwrap(res);
}

// Lessons

export async function createLesson(data: Record<string, any>) {
  const res = await api.post(resource('Course Lesson'), data);
  return unwrap(res);
}

export async function updateLesson(name: string, data: Record<string, any>) {
  const res = await api.put(`${resource('Course Lesson')}/${name}`, data);
  return unwrap(res);
}

export async function deleteLesson(name: string) {
  const res = await api.delete(`${resource('Course Lesson')}/${name}`);
  return unwrap(res);
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function getCategories(params?: Record<string, any>) {
  const res = await api.get(resource('LMS Category'), { params });
  return unwrap(res);
}

export async function createCategory(data: Record<string, any>) {
  const res = await api.post(resource('LMS Category'), data);
  return unwrap(res);
}

export async function updateCategory(name: string, data: Record<string, any>) {
  const res = await api.put(`${resource('LMS Category')}/${name}`, data);
  return unwrap(res);
}

export async function deleteCategory(name: string) {
  const res = await api.delete(`${resource('LMS Category')}/${name}`);
  return unwrap(res);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function getUsers(params?: Record<string, any>) {
  const res = await api.get(resource('User'), { params });
  return unwrap(res);
}

export async function getUserDetail(name: string) {
  const res = await api.get(`${resource('User')}/${name}`);
  return unwrap(res);
}

export async function updateUser(name: string, data: Record<string, any>) {
  const res = await api.put(`${resource('User')}/${name}`, data);
  return unwrap(res);
}

export async function banUser(user: string) {
  return call('lms.lms.security.ban_user', { email: user });
}

export async function unbanUser(user: string) {
  return call('lms.lms.security.unban_user', { email: user });
}

export async function deleteUser(name: string) {
  const res = await api.delete(`${resource('User')}/${name}`);
  return unwrap(res);
}

export async function getBannedUsers(params?: Record<string, any>) {
  return call('lms.lms.security.get_banned_users', params);
}

// ---------------------------------------------------------------------------
// Enrollments
// ---------------------------------------------------------------------------

export async function getEnrollments(params?: Record<string, any>) {
  const res = await api.get(resource('LMS Enrollment'), { params });
  return unwrap(res);
}

export async function createEnrollment(data: Record<string, any>) {
  const res = await api.post(resource('LMS Enrollment'), data);
  return unwrap(res);
}

export async function deleteEnrollment(name: string) {
  const res = await api.delete(`${resource('LMS Enrollment')}/${name}`);
  return unwrap(res);
}

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------

export async function getQuizzes(params?: Record<string, any>) {
  const res = await api.get(resource('LMS Quiz'), { params });
  return unwrap(res);
}

export async function getQuiz(name: string) {
  const res = await api.get(`${resource('LMS Quiz')}/${name}`);
  return unwrap(res);
}

export async function getQuizQuestions(quiz: string) {
  return call('lms.lms.custom_api.get_quiz_questions', { quiz });
}

export async function createQuiz(data: Record<string, any>) {
  const res = await api.post(resource('LMS Quiz'), data);
  return unwrap(res);
}

export async function updateQuiz(name: string, data: Record<string, any>) {
  const res = await api.put(`${resource('LMS Quiz')}/${name}`, data);
  return unwrap(res);
}

export async function deleteQuiz(name: string) {
  const res = await api.delete(`${resource('LMS Quiz')}/${name}`);
  return unwrap(res);
}

export async function addQuizQuestion(quiz: string, data: Record<string, any>) {
  return call('lms.lms.custom_api.add_quiz_question', { quiz, ...data });
}

export async function deleteQuizQuestion(_quiz: string, question: string) {
  return call('lms.lms.custom_api.delete_quiz_question', { question_name: question });
}

// ---------------------------------------------------------------------------
// Certificates
// ---------------------------------------------------------------------------

export async function getCertificates(params?: Record<string, any>) {
  const res = await api.get(resource('LMS Certificate'), { params });
  return unwrap(res);
}

export async function getCertificateDetail(name: string) {
  const res = await api.get(`${resource('LMS Certificate')}/${name}`);
  return unwrap(res);
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export async function getReviews(params?: Record<string, any>) {
  const res = await api.get(resource('LMS Course Review'), { params });
  return unwrap(res);
}

export async function deleteReview(name: string) {
  const res = await api.delete(`${resource('LMS Course Review')}/${name}`);
  return unwrap(res);
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function getPaymentTransactions(params?: Record<string, any>) {
  const res = await api.get(resource('Payment Transaction'), { params });
  return unwrap(res);
}

export async function getRevenueStats(params?: Record<string, any>) {
  return call('lms.lms.payments_api.admin_get_revenue_stats', params);
}

export async function verifyPayment(transactionId: string) {
  return call('lms.lms.payments_api.admin_verify_payment', { transaction_id: transactionId });
}

export async function exportPaymentsCsv(params?: {
  status?: string;
  payment_method?: string;
  from_date?: string;
  to_date?: string;
}): Promise<Blob> {
  const res = await api.get('/api/method/lms.lms.payments_api.admin_export_payments_csv', {
    params,
    responseType: 'blob',
  });
  return res.data as Blob;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export async function getCourseAnalytics(course: string) {
  return call('lms.lms.custom_api.get_student_progress_report', { course });
}

export async function getStudentProgressReport(course: string) {
  return call('lms.lms.custom_api.get_student_progress_report', { course });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getLMSSettings() {
  const res = await api.get(`${resource('LMS Settings')}/LMS Settings`);
  return unwrap(res);
}

export async function updateLMSSettings(data: Record<string, any>) {
  const res = await api.put(`${resource('LMS Settings')}/LMS Settings`, data);
  return unwrap(res);
}

// ---------------------------------------------------------------------------
// Instructor
// ---------------------------------------------------------------------------

export async function getInstructorProfile(user?: string) {
  return call('lms.lms.custom_api.get_instructor_profile', { user });
}

export async function saveInstructorProfile(data: Record<string, any>) {
  return call('lms.lms.custom_api.save_instructor_profile', data);
}

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

export default api;
