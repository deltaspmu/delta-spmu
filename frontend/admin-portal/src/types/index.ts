// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------
export interface User {
  name: string;
  email: string;
  full_name: string;
  first_name: string;
  last_name: string;
  user_image: string | null;
  bio: string | null;
  roles: string[];
  enabled: number;
  language: string;
  last_active: string | null;
  creation: string;
}

// ---------------------------------------------------------------------------
// Course
// ---------------------------------------------------------------------------
export interface Course {
  name: string;
  title: string;
  description: string;
  short_introduction: string;
  image: string | null;
  course_price: number;
  currency: string;
  published: number;
  upcoming: number;
  instructor: string;
  instructor_name: string;
  instructor_image: string | null;
  category: string;
  tags: string;
  avg_rating: number;
  review_count: number;
  enrollment_count: number;
  lesson_count: number;
  video_count: number;
  total_duration: number;
  access_duration_days: number;
  creation: string;
  modified: string;
}

// ---------------------------------------------------------------------------
// Chapter & Lesson
// ---------------------------------------------------------------------------
export interface Chapter {
  name: string;
  title: string;
  description: string;
  course: string;
  chapter_number: number;
  lessons: Lesson[];
}

export interface Lesson {
  name: string;
  title: string;
  content: string;
  chapter: string;
  lesson_number: number;
  youtube: string | null;
  quiz_id: string | null;
  duration: number;
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------
export interface Quiz {
  name: string;
  title: string;
  course: string;
  max_attempts: number;
  passing_percentage: number;
  negative_marking: number;
  time_limit: number;
  questions: QuizQuestion[];
  creation: string;
  modified: string;
}

export interface QuizQuestion {
  name: string;
  question: string;
  question_type: 'Single Choice' | 'Multiple Choice';
  options: QuizOption[];
  marks: number;
  negative_marks: number;
}

export interface QuizOption {
  option: string;
  is_correct?: boolean;
}

// ---------------------------------------------------------------------------
// Certificate
// ---------------------------------------------------------------------------
export interface Certificate {
  name: string;
  student: string;
  student_name: string;
  course: string;
  course_title: string;
  certificate_id: string;
  issue_date: string;
  creation: string;
}

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------
export interface Enrollment {
  name: string;
  student: string;
  student_name: string;
  student_email: string;
  course: string;
  course_title: string;
  enrollment_date: string;
  progress: number;
  access_start: string | null;
  access_end: string | null;
  status: 'Active' | 'Expired' | 'Suspended';
  creation: string;
}

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------
export interface PaymentTransaction {
  name: string;
  transaction_id: string;
  user: string;
  user_name: string;
  course: string;
  course_title: string;
  original_amount: number;
  currency: string;
  discount_percent: number;
  discount_amount: number;
  final_amount: number;
  payment_method: string;
  status: 'Pending' | 'Processing' | 'Completed' | 'Failed' | 'Pending Verification';
  expires_at: string;
  completed_at: string | null;
  error_message: string | null;
  creation: string;
}

// ---------------------------------------------------------------------------
// Course Access
// ---------------------------------------------------------------------------
export interface CourseAccess {
  name: string;
  user: string;
  course: string;
  access_start: string;
  access_end: string;
  days_remaining: number;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------
export interface Review {
  name: string;
  owner: string;
  owner_name: string;
  owner_image: string | null;
  course: string;
  course_title: string;
  rating: number;
  review: string;
  creation: string;
}

// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------
export interface Category {
  name: string;
  category: string;
  description: string | null;
  image: string | null;
  course_count: number;
  creation: string;
}

// ---------------------------------------------------------------------------
// LMS Settings
// ---------------------------------------------------------------------------
export interface LMSSettings {
  site_name: string;
  logo: string | null;
  favicon: string | null;
  banner_image: string | null;
  description: string;
  default_currency: string;
  payment_methods: string[];
  access_duration_days: number;
  allow_self_enrollment: boolean;
  enable_reviews: boolean;
  enable_certificates: boolean;
}

// ---------------------------------------------------------------------------
// Dashboard Stats
// ---------------------------------------------------------------------------
export interface DashboardStats {
  total_users: number;
  total_courses: number;
  total_enrollments: number;
  total_revenue: number;
  active_users_today: number;
  new_enrollments_today: number;
  revenue_this_month: number;
  completion_rate: number;
  recent_enrollments: Enrollment[];
  recent_payments: PaymentTransaction[];
  revenue_trend: { date: string; amount: number }[];
  enrollment_trend: { date: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------
export interface VideoInfo {
  name: string;
  title: string;
  vimeo_id: string;
  vimeo_hash: string;
  duration: number;
  thumbnail: string | null;
  status: 'uploading' | 'processing' | 'available' | 'error';
  size: number;
  lesson: string | null;
  course: string | null;
  creation: string;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
export interface AnalyticsData {
  period: string;
  total_views: number;
  unique_users: number;
  avg_session_duration: number;
  top_courses: { course: string; title: string; views: number; enrollments: number }[];
  user_activity: { date: string; active_users: number; new_users: number }[];
  completion_by_course: { course: string; title: string; completion_rate: number }[];
  revenue_by_course: { course: string; title: string; revenue: number }[];
  geographic_data: { country: string; users: number }[];
}

// ---------------------------------------------------------------------------
// Generic API types
// ---------------------------------------------------------------------------
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ApiResponse<T = unknown> {
  message: T;
}
