import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { getEnrolledCourses, getCourseProgress, getCourseAccess } from '@/api/client';
import type { Course, CourseProgress, CourseAccess } from '@/types';
import { getCourseImageUrl, cn } from '@/lib/utils';
import {
  BookOpen,
  ArrowRight,
  AlertCircle,
  Clock,
  RefreshCw,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'all' | 'in-progress' | 'completed';

interface EnrichedCourse extends Course {
  progress: number;
  accessDaysRemaining: number;
  accessExpired: boolean;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function CourseRowSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse">
      <div className="flex flex-col sm:flex-row">
        <div className="sm:w-56 lg:w-64 aspect-video sm:aspect-auto bg-gray-200 shrink-0" />
        <div className="p-5 flex-1 space-y-3">
          <div className="h-5 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-2 bg-gray-200 rounded-full w-full" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function MyCourses() {
  const { t } = useTranslation(['common', 'pages']);
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('all');

  // Fetch enrolled courses
  const {
    data: enrolledData,
    isLoading: enrolledLoading,
    isError: enrolledError,
    refetch: refetchEnrolled,
  } = useQuery({
    queryKey: ['enrolledCourses'],
    queryFn: () => getEnrolledCourses(),
  });

  // Parse enrolled courses.
  // get_enrolled_courses returns LMS Enrollment rows: the top-level `name` is
  // the ENROLLMENT id (a hash like "b3jppnuqso"), while the real course lives
  // under `course` (slug) and `course_data` (metadata). Normalise each row to a
  // Course keyed by the course slug, otherwise links resolve to /learn/<enrollment-id>
  // ("Course not found") and progress/access are queried with the wrong id.
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

  // Fetch progress + access for all enrolled courses
  const { data: enrichmentData, isLoading: enrichmentLoading } = useQuery({
    queryKey: ['courseEnrichment', enrolledCourses.map((c) => c.name)],
    queryFn: async () => {
      const results: Record<string, { progress: CourseProgress; access: CourseAccess }> = {};
      await Promise.all(
        enrolledCourses.map(async (course) => {
          let progress: CourseProgress = { progress_percentage: 0, completed_lessons: [], total_lessons: 0 };
          let access: CourseAccess = { has_access: true, access_start: null, access_end: null, days_remaining: 365, is_expiring_soon: false };
          try {
            progress = (await getCourseProgress(course.name)) as CourseProgress;
          } catch { /* use defaults */ }
          try {
            const a = (await getCourseAccess(course.name)) as CourseAccess;
            if (a && typeof a.has_access === 'boolean') access = a;
          } catch { /* use defaults */ }
          results[course.name] = { progress, access };
        })
      );
      return results;
    },
    enabled: enrolledCourses.length > 0,
  });

  // Enrich courses with progress and access
  const enrichedCourses: EnrichedCourse[] = useMemo(() => {
    return enrolledCourses.map((c) => {
      const data = enrichmentData?.[c.name];
      const progress = data?.progress?.progress_percentage ?? 0;
      const daysRemaining = data?.access?.days_remaining ?? 365;
      return {
        ...c,
        progress,
        accessDaysRemaining: daysRemaining,
        // Only treat as "expired" when an access window actually existed (a
        // non-null access_end). A roster entry with no granted window should
        // not show the alarming "Expired — Renew" CTA.
        accessExpired:
          daysRemaining <= 0 &&
          !(data?.access?.has_access ?? true) &&
          !!data?.access?.access_end,
      };
    });
  }, [enrolledCourses, enrichmentData]);

  // Filter by tab
  const filteredCourses = useMemo(() => {
    switch (activeTab) {
      case 'in-progress':
        return enrichedCourses.filter((c) => c.progress < 100);
      case 'completed':
        return enrichedCourses.filter((c) => c.progress >= 100);
      default:
        return enrichedCourses;
    }
  }, [enrichedCourses, activeTab]);

  const isLoading = enrolledLoading || enrichmentLoading;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'all', label: t('common:all', 'All'), count: enrichedCourses.length },
    {
      key: 'in-progress',
      label: t('pages:myCourses.inProgress', 'In Progress'),
      count: enrichedCourses.filter((c) => c.progress < 100).length,
    },
    {
      key: 'completed',
      label: t('pages:myCourses.completed', 'Completed'),
      count: enrichedCourses.filter((c) => c.progress >= 100).length,
    },
  ];

  return (
    <div className="min-h-screen bg-alabaster">
      {/* Header */}
      <div className="bg-dark text-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold">
            {t('pages:myCourses.title', 'My Courses')}
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Filter */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                activeTab === tab.key
                  ? 'bg-dark text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'ml-2 text-xs px-1.5 py-0.5 rounded-full',
                  activeTab === tab.key
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-gray-500'
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <CourseRowSkeleton key={i} />
            ))}
          </div>
        ) : enrolledError ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">Something went wrong while loading your courses.</p>
            <button
              onClick={() => refetchEnrolled()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-dark text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center">
            <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h3 className="font-heading text-lg font-semibold text-dark mb-1">
              {t('pages:myCourses.empty', 'No courses found in this category.')}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {activeTab !== 'all'
                ? t(
                    'pages:myCourses.emptyHint',
                    'Try switching tabs or browse available courses.'
                  )
                : t(
                    'pages:myCourses.noEnrollments',
                    'Start learning by enrolling in a course.'
                  )}
            </p>
            <Link
              to="/courses"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-dark text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Browse Courses
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCourses.map((course) => {
              const isCompleted = course.progress >= 100;
              const isExpired = course.accessExpired;

              return (
                <div
                  key={course.name}
                  className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* Course Image */}
                    <Link
                      to={isExpired ? `/payment/${course.name}` : `/learn/${course.name}`}
                      className="sm:w-56 lg:w-64 shrink-0 overflow-hidden"
                    >
                      <img
                        src={getCourseImageUrl(course)}
                        alt={course.title}
                        className="w-full h-full object-cover aspect-video sm:aspect-[4/3]"
                        loading="lazy"
                      />
                    </Link>

                    {/* Details */}
                    <div className="p-5 flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <Link
                            to={isExpired ? `/payment/${course.name}` : `/learn/${course.name}`}
                            className="min-w-0"
                          >
                            <h3 className="font-heading font-semibold text-dark text-base sm:text-lg line-clamp-2 hover:text-primary transition-colors">
                              {course.title}
                            </h3>
                          </Link>
                          <span
                            className={cn(
                              'shrink-0 text-xs font-medium px-2.5 py-1 rounded-full',
                              isCompleted
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            )}
                          >
                            {isCompleted
                              ? t('pages:myCourses.statusCompleted', 'Completed')
                              : t('pages:myCourses.statusInProgress', 'In Progress')}
                          </span>
                        </div>

                        {course.instructor_name && (
                          <p className="text-sm text-gray-500 mb-3">
                            {course.instructor_name}
                          </p>
                        )}

                        {/* Progress bar */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>{Math.round(course.progress)}% complete</span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500',
                                isCompleted ? 'bg-green-500' : 'bg-primary'
                              )}
                              style={{ width: `${course.progress}%` }}
                            />
                          </div>
                        </div>

                        {/* Access expiry info */}
                        {!isCompleted && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            {isExpired ? (
                              <span className="text-red-500 font-medium">Access expired</span>
                            ) : course.accessDaysRemaining <= 30 ? (
                              <span className="text-yellow-600">
                                Access expires in {course.accessDaysRemaining} day
                                {course.accessDaysRemaining !== 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="text-gray-400">
                                {course.accessDaysRemaining} days remaining
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action */}
                      <div className="mt-4">
                        {isExpired ? (
                          <Link
                            to={`/payment/${course.name}`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                          >
                            <RefreshCw className="w-4 h-4" />
                            {t('pages:myCourses.renew', 'Expired — Renew')}
                          </Link>
                        ) : (
                          <Link
                            to={`/learn/${course.name}`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-dark text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                          >
                            {isCompleted
                              ? t('pages:myCourses.reviewCourse', 'Review Course')
                              : t('pages:myCourses.continueLearning', 'Continue Learning')}
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
