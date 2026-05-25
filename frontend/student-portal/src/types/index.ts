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
  creation?: string;
}

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
  creation: string;
  modified: string;
}

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
  youtube: string | null; // Vimeo video ID stored as "id/hash"
  quiz_id: string | null;
  duration: number;
  is_completed?: boolean;
}

export interface Quiz {
  name: string;
  title: string;
  course: string;
  max_attempts: number;
  passing_percentage: number;
  negative_marking: number;
  time_limit: number;
  questions: QuizQuestion[];
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
  is_correct?: boolean; // Only available in admin
}

export interface QuizSubmission {
  score: number;
  score_percentage: number;
  passed: boolean;
  total_questions: number;
  correct_count: number;
  attempt_number: number;
}

export interface Certificate {
  name: string;
  student: string;
  student_name: string;
  course: string;
  course_title: string;
  certificate_id: string;
  issue_date: string;
}

export interface CourseAccess {
  has_access: boolean;
  access_start: string | null;
  access_end: string | null;
  days_remaining: number;
  is_expiring_soon: boolean;
}

export interface PaymentInfo {
  original_price: number;
  discount_percent: number;
  discount_amount: number;
  final_price: number;
  currency: string;
  bundle_available: boolean;
  bundle_price: number;
}

export interface PaymentTransaction {
  name: string;
  transaction_id: string;
  user: string;
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

export interface CourseProgress {
  progress_percentage: number;
  completed_lessons: string[];
  total_lessons: number;
}

export interface Review {
  name: string;
  owner: string;
  owner_name: string;
  owner_image: string | null;
  course: string;
  rating: number;
  review: string;
  creation: string;
}

export interface Notification {
  name: string;
  subject: string;
  message: string;
  read: boolean;
  creation: string;
  type: string;
}

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

export interface Branding {
  site_name: string;
  logo: string | null;
  favicon: string | null;
  banner_image: string | null;
  description: string;
}
