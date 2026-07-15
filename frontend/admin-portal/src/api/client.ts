import axios, { type AxiosInstance } from 'axios';

// ---------------------------------------------------------------------------
// Base configuration
// ---------------------------------------------------------------------------

// Default to same-origin (empty string) so requests go to
// /api/* on the current host. In production that's
// admin.deltaspmu.com which Vercel rewrites to api.deltaspmu.com —
// keeps everything same-origin from the browser's perspective so
// session cookies aren't treated as third-party. Override via
// VITE_API_URL if you really need cross-origin.
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

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

// Frappe returns responses in three shapes:
//   RPC (/api/method/...):       { message: ... }
//   Resource list (GET .../Doctype):     { data: [...] }
//   Resource single (GET/POST/PUT one):  { data: { ...doc } }
// Try message first (RPC), then .data (REST), then the raw body.
// List pages already check `Array.isArray(data) ? data : data?.data`
// so peeling .data here doesn't break them.
const unwrap = (res: any) =>
  res.data?.message !== undefined
    ? res.data.message
    : res.data?.data !== undefined
      ? res.data.data
      : res.data;

function call(method: string, params?: Record<string, any>) {
  return api.post('/api/method/' + method, params).then(unwrap);
}

function resource(doctype: string) {
  return `/api/resource/${encodeURIComponent(doctype)}`;
}

// Build the URL for a single document. The name MUST be percent-encoded:
// Frappe auto-names some doctypes (e.g. Course Lesson) from the title, so a
// docname can contain spaces, `?`, `#`, `/`, `&`, etc. Interpolating it raw
// lets the browser treat `?` as the query-string delimiter, so a PUT to
// `Course Lesson/0074 What Is Lip Blush?` silently targets the wrong (404)
// name. encodeURIComponent turns it into a single safe path segment.
function docResource(doctype: string, name: string) {
  return `${resource(doctype)}/${encodeURIComponent(name)}`;
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
  // Single-shot dashboard endpoint returns counts + recent rows in one trip.
  // Shape: { counts: {users,courses,enrollments}, revenue: {...},
  //          recent_enrollments: [...], recent_payments: [...] }
  return call('lms.lms.api.admin_get_dashboard_summary');
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export async function getCourses(params?: Record<string, any>) {
  const res = await api.get(resource('LMS Course'), { params });
  return unwrap(res);
}

export async function getCourseDetail(name: string) {
  const res = await api.get(docResource('LMS Course', name));
  return unwrap(res);
}

export async function createCourse(data: Record<string, any>) {
  const res = await api.post(resource('LMS Course'), data);
  return unwrap(res);
}

export async function updateCourse(name: string, data: Record<string, any>) {
  const res = await api.put(docResource('LMS Course', name), data);
  return unwrap(res);
}

export async function deleteCourse(name: string) {
  // Cascade delete (chapters, lessons, enrollments, progress) — a raw
  // resource DELETE fails with LinkExistsError while any of those exist.
  return call('lms.lms.api.admin_delete_course', { course: name });
}

export async function cloneCourse(name: string) {
  // Clone by fetching original and creating a copy
  const original = await getCourseDetail(name);
  const cloneData = { ...original, name: undefined, title: `${original.title} (Copy)`, published: 0 };
  return createCourse(cloneData);
}

// Chapters

export async function getCourseChapters(course: string) {
  // Backend signature is get_course_chapters(course_name=...); passing `course`
  // throws "Course name is required." and the editor shows 0 chapters.
  return call('lms.lms.api.get_course_chapters', { course_name: course });
}

export async function createChapter(data: Record<string, any>) {
  const res = await api.post(resource('Course Chapter'), data);
  return unwrap(res);
}

export async function updateChapter(name: string, data: Record<string, any>) {
  const res = await api.put(docResource('Course Chapter', name), data);
  return unwrap(res);
}

export async function deleteChapter(name: string) {
  // Cascade delete (lessons first) — see deleteCourse.
  return call('lms.lms.api.admin_delete_chapter', { chapter: name });
}

// Lessons

export async function createLesson(data: Record<string, any>) {
  const res = await api.post(resource('Course Lesson'), data);
  return unwrap(res);
}

export async function updateLesson(name: string, data: Record<string, any>) {
  const res = await api.put(docResource('Course Lesson', name), data);
  return unwrap(res);
}

export async function deleteLesson(name: string) {
  // Use a server endpoint that first clears dependent records (student progress)
  // which otherwise make Frappe reject the delete (LinkExistsError). A raw
  // resource DELETE silently fails for any lesson a student has completed.
  return call('lms.lms.api.admin_delete_lesson', { lesson: name });
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
  const res = await api.put(docResource('LMS Category', name), data);
  return unwrap(res);
}

export async function deleteCategory(name: string) {
  const res = await api.delete(docResource('LMS Category', name));
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
  const res = await api.get(docResource('User', name));
  return unwrap(res);
}

export async function updateUser(name: string, data: Record<string, any>) {
  const res = await api.put(docResource('User', name), data);
  return unwrap(res);
}

export async function banUser(user: string) {
  return call('lms.lms.security.ban_user', { email: user });
}

export async function unbanUser(user: string) {
  return call('lms.lms.security.unban_user', { email: user });
}

export async function deleteUser(name: string) {
  const res = await api.delete(docResource('User', name));
  return unwrap(res);
}

export async function getBannedUsers(params?: Record<string, any>) {
  return call('lms.lms.security.get_banned_users', params);
}

// ---------------------------------------------------------------------------
// Enrollments
// ---------------------------------------------------------------------------

export async function getEnrollments(params?: { limit?: number; offset?: number; search?: string; course?: string }) {
  // Hits a custom endpoint that joins LMS Enrollment with LMS Course so
  // the frontend gets course_title + a derived status without N+1 queries.
  return call('lms.lms.api.admin_get_enrollments', params);
}

export async function createEnrollment(data: Record<string, any>) {
  const res = await api.post(resource('LMS Enrollment'), data);
  return unwrap(res);
}

// Manually enrol an existing (already signed-up) student in a course, bypassing
// payment. Grants Course Access + LMS Enrollment server-side.
export async function manualEnroll(student: string, course: string) {
  return call('lms.lms.api.admin_manual_enroll', { student, course });
}

export async function deleteEnrollment(name: string) {
  const res = await api.delete(docResource('LMS Enrollment', name));
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
  const res = await api.get(docResource('LMS Quiz', name));
  return unwrap(res);
}

export async function getQuizQuestions(quiz: string) {
  return call('lms.lms.custom_api.get_quiz_questions', { quiz });
}

export async function createQuiz(data: Record<string, any>) {
  // Routed through custom_api: maps portal fields onto the real LMS Quiz schema
  // (duration, enable_negative_marking) and sets the mandatory total_marks.
  return call('lms.lms.custom_api.create_quiz', data);
}

export async function updateQuiz(name: string, data: Record<string, any>) {
  return call('lms.lms.custom_api.update_quiz', { quiz: name, ...data });
}

export async function deleteQuiz(name: string) {
  return call('lms.lms.custom_api.delete_quiz', { quiz: name });
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
  const res = await api.get(docResource('LMS Certificate', name));
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
  const res = await api.delete(docResource('LMS Course Review', name));
  return unwrap(res);
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function getPaymentTransactions(params?: Record<string, any>) {
  // Frappe's generic /api/resource endpoint returns ONLY `name` unless fields
  // are requested — which left every row without status/amount, so the status
  // filter matched nothing ("No transactions found"). Request all fields.
  const res = await api.get(resource('Payment Transaction'), {
    params: {
      fields: JSON.stringify(['*']),
      order_by: 'creation desc',
      limit_page_length: 200,
      ...params,
    },
  });
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
// Telegram
// ---------------------------------------------------------------------------

export interface TelegramStats {
  enabled: boolean;
  linked_count: number;
}

export async function getTelegramStats(): Promise<TelegramStats> {
  return call('lms.lms.telegram_bot.admin_get_telegram_stats');
}

export async function sendTelegramBroadcast(message: string): Promise<{
  queued: boolean;
  recipients: number;
}> {
  return call('lms.lms.telegram_bot.admin_broadcast', { message });
}

// ---------------------------------------------------------------------------
// File upload (Frappe `/api/method/upload_file`)
// ---------------------------------------------------------------------------

export interface UploadedFile {
  file_url: string;        // e.g. "/files/my-image.jpg"
  file_name: string;
  is_private: number;
}

/**
 * Upload a file to Frappe and (optionally) attach it to a doctype.
 *
 * Returns the public file_url (starts with /files/...). Combine with
 * the API base when displaying in <img> if cross-origin.
 */
export async function uploadFile(
  file: File,
  options?: { doctype?: string; docname?: string; isPrivate?: boolean; folder?: string },
): Promise<UploadedFile> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('is_private', options?.isPrivate ? '1' : '0');
  fd.append('folder', options?.folder || 'Home');
  if (options?.doctype) fd.append('doctype', options.doctype);
  if (options?.docname) fd.append('docname', options.docname);

  const res = await api.post('/api/method/upload_file', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const message = res.data?.message;
  if (!message?.file_url) {
    throw new Error('Upload succeeded but no file_url was returned');
  }
  return {
    file_url: message.file_url,
    file_name: message.file_name || file.name,
    is_private: message.is_private || 0,
  };
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
  const res = await api.get(docResource('LMS Settings', 'LMS Settings'));
  return unwrap(res);
}

export async function updateLMSSettings(data: Record<string, any>) {
  const res = await api.put(docResource('LMS Settings', 'LMS Settings'), data);
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

// Assignable instructors (Course Creator / Instructor users) + per-course assignment
export async function getInstructors() {
  return call('lms.lms.api.get_instructors');
}

export async function setCourseInstructor(course: string, instructor: string) {
  return call('lms.lms.api.set_course_instructor', { course, instructor });
}

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

export default api;
