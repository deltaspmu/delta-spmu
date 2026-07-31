import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { getEnrolledCourses, getCertificates, getCourses, getCourseProgress } from '@/api/client';
import type { Course, Certificate, CourseProgress } from '@/types';
import {
  getCourseImageUrl,
  formatPrice,
  formatDuration,
  cn,
} from '@/lib/utils';
import Avatar from '@/components/Avatar';
import {
  BookOpen,
  Award,
  GraduationCap,
  Clock,
  Star,
  ChevronRight,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EnrolledCourse extends Course {
  progress?: number;
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

interface StatCardProps {
  icon: React.ReactNode;
  value: number | string;
  label: string;
}

function StatCard({ icon, value, label }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="font-heading text-2xl font-bold text-dark">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------

function StatSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4 animate-pulse">
      <div className="w-12 h-12 rounded-full bg-gray-200" />
      <div className="space-y-2">
        <div className="h-6 w-12 bg-gray-200 rounded" />
        <div className="h-4 w-24 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

function CourseCardSkeleton() {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm animate-pulse min-w-[280px] w-[300px] shrink-0">
      <div className="aspect-video bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="h-2 bg-gray-200 rounded-full w-full" />
        <div className="h-4 bg-gray-200 rounded w-16" />
      </div>
    </div>
  );
}

function RecommendationSkeleton() {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm animate-pulse">
      <div className="aspect-video bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-200 rounded w-1/3" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const { t } = useTranslation(['common', 'pages']);
  const { user } = useAuth();

  // Fetch enrolled courses
  const {
    data: enrolledData,
    isLoading: enrolledLoading,
    isError: enrolledError,
  } = useQuery({
    queryKey: ['enrolledCourses'],
    queryFn: () => getEnrolledCourses(),
  });

  // Fetch certificates
  const { data: certificatesData, isLoading: certsLoading } = useQuery({
    queryKey: ['certificates'],
    queryFn: () => getCertificates(),
  });

  // Fetch all courses for recommendations
  const { data: allCoursesData, isLoading: allCoursesLoading } = useQuery({
    queryKey: ['courses', { limit: 20 }],
    queryFn: () => getCourses({ limit: 20 }),
    staleTime: 5 * 60 * 1000,
  });

  // Parse enrolled courses.
  // get_enrolled_courses returns LMS Enrollment rows: the top-level `name` is
  // the ENROLLMENT id, the real course is under `course` (slug) + `course_data`.
  // Normalise to a Course keyed by the course slug so links and progress
  // lookups don't use the enrollment id.
  const enrolledCourses: Course[] = useMemo(() => {
    const rows = Array.isArray(enrolledData)
      ? enrolledData
      : enrolledData &&
          typeof enrolledData === 'object' &&
          'data' in (enrolledData as Record<string, unknown>)
        ? (enrolledData as { data: unknown[] }).data
        : [];
    return (rows as Array<Record<string, unknown>>).map((row) => {
      const cd = (row.course_data as Record<string, unknown>) ?? row;
      return {
        ...cd,
        name: (row.course as string) ?? (cd.name as string),
      } as unknown as Course;
    });
  }, [enrolledData]);

  // Fetch progress for each enrolled course
  const progressQueries = useQuery({
    queryKey: ['allProgress', enrolledCourses.map((c) => c.name)],
    queryFn: async () => {
      const results: Record<string, CourseProgress> = {};
      await Promise.all(
        enrolledCourses.map(async (course) => {
          try {
            const progress = (await getCourseProgress(course.name)) as CourseProgress;
            results[course.name] = progress;
          } catch {
            results[course.name] = { progress_percentage: 0, completed_lessons: [], total_lessons: 0 };
          }
        })
      );
      return results;
    },
    enabled: enrolledCourses.length > 0,
  });

  const progressMap = progressQueries.data ?? {};

  // Build enriched enrolled courses with progress.
  // Guard against non-finite values so progress bars/labels never show "NaN".
  const enrichedCourses: EnrolledCourse[] = useMemo(() => {
    return enrolledCourses.map((c) => {
      const raw = progressMap[c.name]?.progress_percentage;
      return {
        ...c,
        progress: Number.isFinite(raw) ? (raw as number) : 0,
      };
    });
  }, [enrolledCourses, progressMap]);

  const inProgressCourses = useMemo(
    () => enrichedCourses.filter((c) => (c.progress ?? 0) < 100),
    [enrichedCourses]
  );

  const completedCourses = useMemo(
    () => enrichedCourses.filter((c) => (c.progress ?? 0) >= 100),
    [enrichedCourses]
  );

  // Parse certificates
  const certificates: Certificate[] = useMemo(() => {
    if (!certificatesData) return [];
    if (Array.isArray(certificatesData)) return certificatesData as Certificate[];
    if (typeof certificatesData === 'object' && 'data' in (certificatesData as Record<string, unknown>)) {
      return (certificatesData as { data: Certificate[] }).data;
    }
    return [];
  }, [certificatesData]);

  // Calculate total hours. `total_duration` may be absent on enrolled-course
  // payloads, so coerce every term to a finite number to avoid a "NaN" stat.
  const totalHours = useMemo(() => {
    const totalMinutes = enrolledCourses.reduce((sum, c) => {
      const progress = Number(progressMap[c.name]?.progress_percentage) || 0;
      const duration = Number(c.total_duration) || 0;
      return sum + (duration * progress) / 100;
    }, 0);
    const hours = Math.round(totalMinutes / 60);
    return Number.isFinite(hours) ? hours : 0;
  }, [enrolledCourses, progressMap]);

  // Parse all courses and pick recommendations
  const recommendations: Course[] = useMemo(() => {
    if (!allCoursesData) return [];
    let allCourses: Course[] = [];
    if (Array.isArray(allCoursesData)) {
      allCourses = allCoursesData as Course[];
    } else if (typeof allCoursesData === 'object' && 'data' in (allCoursesData as Record<string, unknown>)) {
      allCourses = (allCoursesData as { data: Course[] }).data;
    }
    const enrolledNames = new Set(enrolledCourses.map((c) => c.name));
    return allCourses.filter((c) => !enrolledNames.has(c.name)).slice(0, 4);
  }, [allCoursesData, enrolledCourses]);

  const isLoading = enrolledLoading || certsLoading;

  return (
    <div className="min-h-screen bg-alabaster">
      {/* Header */}
      <div className="bg-dark text-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            {user && (
              <Avatar
                src={user.user_image}
                name={user.full_name}
                size={56}
                alt={user.full_name}
                className="w-14 h-14 rounded-full object-cover border-2 border-primary/30"
              />
            )}
            <div>
              <h1 className="font-heading text-2xl sm:text-3xl font-bold">
                {t('pages:dashboard.welcome', 'Welcome back, {{name}}!', {
                  name: user?.first_name || user?.full_name || 'Student',
                })}
              </h1>
              <p className="text-gray-300 text-sm mt-1">
                {t('pages:dashboard.subtitle', "Here's your learning overview")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Stats Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatSkeleton key={i} />
            ))}
          </div>
        ) : enrolledError ? (
          <div className="bg-white rounded-xl shadow-sm p-6 text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Failed to load your dashboard data.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<BookOpen className="w-6 h-6 text-primary" />}
              value={enrolledCourses.length}
              label={t('pages:dashboard.enrolledCourses', 'Enrolled Courses')}
            />
            <StatCard
              icon={<Award className="w-6 h-6 text-primary" />}
              value={completedCourses.length}
              label={t('pages:dashboard.completedCourses', 'Completed Courses')}
            />
            <StatCard
              icon={<GraduationCap className="w-6 h-6 text-primary" />}
              value={certificates.length}
              label={t('pages:dashboard.certificates', 'Certificates Earned')}
            />
            <StatCard
              icon={<Clock className="w-6 h-6 text-primary" />}
              value={totalHours}
              label={t('pages:dashboard.hoursLearned', 'Hours Learned')}
            />
          </div>
        )}

        {/* Continue Learning */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl font-bold text-dark">
              {t('pages:dashboard.continueLearning', 'Continue Learning')}
            </h2>
            {inProgressCourses.length > 0 && (
              <Link
                to="/my-courses"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                {t('common:viewAll', 'View All')}
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {enrolledLoading || progressQueries.isLoading ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <CourseCardSkeleton key={i} />
              ))}
            </div>
          ) : enrolledCourses.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">
                {t(
                  'pages:dashboard.no_courses',
                  "You haven't enrolled in any courses yet."
                )}
              </p>
              <Link
                to="/courses"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-dark text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                {t('pages:dashboard.explore_courses', 'Explore Courses')}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : inProgressCourses.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <Award className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">
                {t(
                  'pages:dashboard.all_courses_completed',
                  "You've completed all your enrolled courses."
                )}
              </p>
              <Link
                to="/my-courses"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-dark text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                {t('pages:dashboard.view_completed_courses', 'View Completed Courses')}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              {inProgressCourses.map((course) => (
                <Link
                  key={course.name}
                  to={`/learn/${course.name}`}
                  className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow min-w-[280px] w-[300px] shrink-0 group"
                >
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={getCourseImageUrl(course)}
                      alt={course.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-heading font-semibold text-dark text-sm line-clamp-2 mb-3">
                      {course.title}
                    </h3>
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>{Math.round(course.progress ?? 0)}% complete</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${course.progress ?? 0}%` }}
                        />
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-dark group-hover:text-primary transition-colors">
                      Continue
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Recommendations */}
        {(allCoursesLoading || recommendations.length > 0) && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-xl font-bold text-dark">
                {t('pages:dashboard.recommendations', 'Recommended for You')}
              </h2>
              <Link
                to="/courses"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                {t('common:browseAll', 'Browse All')}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {allCoursesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <RecommendationSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {recommendations.map((course) => (
                  <Link
                    key={course.name}
                    to={`/course/${course.name}`}
                    className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group"
                  >
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={getCourseImageUrl(course)}
                        alt={course.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-heading font-semibold text-dark text-sm line-clamp-2 mb-2">
                        {course.title}
                      </h3>
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar
                          src={course.instructor_image}
                          name={course.instructor_name}
                          size={20}
                          alt={course.instructor_name}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                        <span className="text-xs text-gray-500 truncate">
                          {course.instructor_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mb-2">
                        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                        <span className="text-xs font-medium text-dark">
                          {course.avg_rating > 0 ? course.avg_rating.toFixed(1) : 'New'}
                        </span>
                        {course.review_count > 0 && (
                          <span className="text-xs text-gray-400">({course.review_count})</span>
                        )}
                      </div>
                      <p className="font-heading font-bold text-primary text-sm">
                        {course.course_price > 0
                          ? formatPrice(course.course_price, course.currency)
                          : 'Free'}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
