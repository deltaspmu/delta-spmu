import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import {
  getCourseDetail,
  getCourseChapters,
  getLessonDetails,
  checkLessonAccess,
  getCourseProgress,
  markLessonComplete,
  saveCurrentLesson,
} from '@/api/client';
import { useCourseAccess } from '@/hooks/useCourseAccess';
import { useAuth } from '@/context/AuthContext';
import VimeoPlayer from '@/components/VimeoPlayer';
import VideoWatermark from '@/components/VideoWatermark';
import type { Course, Chapter, Lesson, CourseProgress } from '@/types';
import { parseVimeoVideo, cn, formatDuration } from '@/lib/utils';
import {
  learnCoursePath,
  learnLessonPath,
  resolveLessonRouteId,
} from '@/utils/learnRoutes';
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Play,
  Lock,
  CheckCircle,
  AlertTriangle,
  BookOpen,
  Loader2,
  FileText,
  Clock,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-alabaster animate-pulse">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="h-5 bg-gray-200 rounded w-48 mb-4" />
        <div className="h-2 bg-gray-200 rounded w-full mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-9 space-y-4">
            <div className="aspect-video bg-gray-200 rounded-xl" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded w-full" />
              ))}
            </div>
          </div>
          <div className="lg:col-span-3 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar — Course Outline
// ---------------------------------------------------------------------------

interface SidebarProps {
  chapters: Chapter[];
  progress: CourseProgress | null;
  currentLessonName: string | null;
  onSelectLesson: (chapterNum: number, lessonNum: number, lessonName: string) => void;
  accessibleLessons: Set<string>;
}

function CourseSidebar({
  chapters,
  progress,
  currentLessonName,
  onSelectLesson,
  accessibleLessons,
}: SidebarProps) {
  const totalLessons = progress?.total_lessons ?? 0;
  const completedCount = progress?.completed_lessons?.length ?? 0;

  // Open the chapter that contains the current lesson by default
  const defaultOpen = useMemo(() => {
    const set = new Set<number>();
    for (const ch of chapters) {
      if (ch.lessons?.some((l) => l.name === currentLessonName)) {
        set.add(ch.chapter_number);
        break;
      }
    }
    if (set.size === 0 && chapters.length > 0) {
      set.add(chapters[0].chapter_number);
    }
    return set;
  }, [chapters, currentLessonName]);

  const [openChapters, setOpenChapters] = useState<Set<number>>(defaultOpen);

  // Update open chapters when current lesson changes
  useEffect(() => {
    setOpenChapters((prev) => {
      const next = new Set(prev);
      for (const ch of chapters) {
        if (ch.lessons?.some((l) => l.name === currentLessonName)) {
          next.add(ch.chapter_number);
        }
      }
      return next;
    });
  }, [currentLessonName, chapters]);

  const toggleChapter = (num: number) => {
    setOpenChapters((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  const completedSet = useMemo(
    () => new Set(progress?.completed_lessons ?? []),
    [progress]
  );

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Progress summary */}
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-sm font-medium text-dark mb-2">
          {completedCount} of {totalLessons} lessons complete
        </p>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{
              width: `${totalLessons > 0 ? (completedCount / totalLessons) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Chapter list */}
      <div className="divide-y divide-gray-50">
        {chapters.map((chapter) => {
          const isOpen = openChapters.has(chapter.chapter_number);
          const lessonCount = chapter.lessons?.length ?? 0;

          return (
            <div key={chapter.name}>
              <button
                onClick={() => toggleChapter(chapter.chapter_number)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-gray-400 transition-transform flex-shrink-0',
                      isOpen && 'rotate-180'
                    )}
                  />
                  <div className="min-w-0">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                      Chapter {chapter.chapter_number}
                    </span>
                    <h4 className="font-medium text-dark text-sm truncate">
                      {chapter.title}
                    </h4>
                  </div>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                  {lessonCount} {lessonCount === 1 ? 'lesson' : 'lessons'}
                </span>
              </button>

              {isOpen && chapter.lessons && (
                <div className="bg-gray-50/50 pb-1">
                  {chapter.lessons.map((lesson) => {
                    const isCurrent = lesson.name === currentLessonName;
                    const isCompleted = completedSet.has(lesson.name);
                    const isAccessible = accessibleLessons.has(lesson.name);

                    return (
                      <button
                        key={lesson.name}
                        onClick={() => {
                          if (isAccessible) {
                            onSelectLesson(
                              chapter.chapter_number,
                              lesson.lesson_number,
                              lesson.name
                            );
                          }
                        }}
                        disabled={!isAccessible}
                        className={cn(
                          'w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors',
                          isCurrent && 'bg-primary/10 border-l-2 border-primary',
                          !isCurrent && isAccessible && 'hover:bg-gray-100',
                          !isAccessible && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        {/* Status icon */}
                        <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center">
                          {isCompleted ? (
                            <CheckCircle className="w-4.5 h-4.5 text-green-500" />
                          ) : isCurrent ? (
                            <Play className="w-4 h-4 text-primary" fill="currentColor" />
                          ) : !isAccessible ? (
                            <Lock className="w-3.5 h-3.5 text-gray-300" />
                          ) : (
                            <span className="text-xs text-gray-400 font-medium">
                              {lesson.lesson_number}
                            </span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              'text-sm truncate',
                              isCurrent ? 'text-primary font-medium' : 'text-dark'
                            )}
                          >
                            {lesson.title}
                          </p>
                        </div>

                        {/* Duration */}
                        {lesson.duration > 0 && (
                          <span className="text-[11px] text-gray-400 flex-shrink-0">
                            {formatDuration(lesson.duration)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sanitized Lesson Content renderer
// ---------------------------------------------------------------------------

function LessonContent({ html }: { html: string }) {
  const sanitized = useMemo(() => {
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ['iframe'],
      ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target'],
    });
  }, [html]);

  return (
    <div
      className="prose prose-sm sm:prose max-w-none text-gray-700
        prose-headings:text-dark prose-headings:font-heading
        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
        prose-img:rounded-lg prose-pre:bg-gray-900 prose-pre:text-gray-100
        prose-code:text-primary prose-code:bg-primary/5 prose-code:px-1 prose-code:rounded"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main Learn Page
// ---------------------------------------------------------------------------

export default function Learn() {
  const { courseId, lessonId } = useParams<{
    courseId: string;
    lessonId?: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [hasAutoCompleted, setHasAutoCompleted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sentinel placed at the end of text-only lesson content. When it scrolls
  // into the viewport we treat the lesson as "read" and auto-mark complete
  // (parallel to the 90%-watched rule for video lessons).
  const textBottomRef = useRef<HTMLDivElement>(null);

  // =========================================================================
  // Access check
  // =========================================================================

  const {
    hasAccess,
    isExpiringSoon,
    daysRemaining,
    isLoading: accessLoading,
  } = useCourseAccess(courseId || '');

  // Redirect if no access
  useEffect(() => {
    if (!accessLoading && !hasAccess && courseId) {
      navigate(`/course/${courseId}`, { replace: true });
    }
  }, [accessLoading, hasAccess, courseId, navigate]);

  // =========================================================================
  // Data fetching
  // =========================================================================

  const { data: courseData, isLoading: courseLoading } = useQuery({
    queryKey: ['learnCourse', courseId],
    queryFn: () => getCourseDetail(courseId!),
    enabled: !!courseId && hasAccess,
  });

  const { data: chaptersData, isLoading: chaptersLoading } = useQuery({
    queryKey: ['learnChapters', courseId],
    queryFn: () => getCourseChapters(courseId!),
    enabled: !!courseId && hasAccess,
  });

  const { data: progressData } = useQuery<CourseProgress>({
    queryKey: ['progress', courseId],
    queryFn: () => getCourseProgress(courseId!) as Promise<CourseProgress>,
    enabled: !!courseId && hasAccess,
  });

  const course = courseData as Course | undefined;
  const chapters: Chapter[] = useMemo(() => {
    if (!chaptersData) return [];
    if (Array.isArray(chaptersData)) return chaptersData as Chapter[];
    return [];
  }, [chaptersData]);

  const progress = (progressData as CourseProgress) ?? null;

  // Build flat lesson list for navigation
  const flatLessons = useMemo(() => {
    const list: {
      name: string;
      title: string;
      chapterNum: number;
      lessonNum: number;
      youtube: string | null;
      quiz_id: string | null;
      content: string;
      duration: number;
    }[] = [];
    for (const ch of chapters) {
      for (const l of ch.lessons ?? []) {
        list.push({
          name: l.name,
          title: l.title,
          chapterNum: ch.chapter_number,
          lessonNum: l.lesson_number,
          youtube: l.youtube,
          quiz_id: l.quiz_id,
          content: l.content,
          duration: l.duration,
        });
      }
    }
    return list;
  }, [chapters]);

  // Determine current lesson
  const completedSet = useMemo(
    () => new Set(progress?.completed_lessons ?? []),
    [progress]
  );

  // If no lessonId, find the first incomplete lesson
  useEffect(() => {
    if (lessonId || flatLessons.length === 0 || !courseId) return;

    const firstIncomplete = flatLessons.find((l) => !completedSet.has(l.name));
    const target = firstIncomplete ?? flatLessons[0];
    navigate(learnLessonPath(courseId, target.name), { replace: true });
  }, [lessonId, flatLessons, completedSet, courseId, navigate]);

  const resolvedLessonId = useMemo(
    () => resolveLessonRouteId(flatLessons.map((lesson) => lesson.name), lessonId || ''),
    [flatLessons, lessonId]
  );
  const currentIndex = useMemo(
    () => flatLessons.findIndex((lesson) => lesson.name === resolvedLessonId),
    [flatLessons, resolvedLessonId]
  );
  const currentLesson = currentIndex >= 0 ? flatLessons[currentIndex] : null;
  const prevLesson = currentIndex > 0 ? flatLessons[currentIndex - 1] : null;
  const nextLesson =
    currentIndex >= 0 && currentIndex < flatLessons.length - 1
      ? flatLessons[currentIndex + 1]
      : null;

  // Canonicalize links produced before lesson path segments were encoded.
  useEffect(() => {
    if (courseId && lessonId && resolvedLessonId && lessonId !== resolvedLessonId) {
      navigate(learnLessonPath(courseId, resolvedLessonId), { replace: true });
    }
  }, [courseId, lessonId, navigate, resolvedLessonId]);

  // Fetch detailed lesson data
  const {
    data: lessonDetailData,
    isLoading: lessonLoading,
  } = useQuery({
    queryKey: ['lesson', courseId, currentLesson?.name],
    queryFn: () =>
      getLessonDetails(
        courseId!,
        currentLesson!.chapterNum,
        currentLesson!.lessonNum,
        currentLesson!.name
      ),
    enabled: !!courseId && !!currentLesson,
  });

  const lessonDetail = lessonDetailData as Lesson | undefined;

  // Check lesson access (sequential gating)
  const { data: lessonAccessData } = useQuery({
    queryKey: ['lessonAccess', courseId, currentLesson?.name],
    queryFn: () => checkLessonAccess(courseId!, currentLesson!.name),
    enabled: !!courseId && !!currentLesson,
  });

  // Backend check_lesson_access returns { access, reason } (NOT has_access/message).
  const lessonAccess = lessonAccessData as { access: boolean; reason?: string } | undefined;

  // Build accessible lessons set
  const accessibleLessons = useMemo(() => {
    const set = new Set<string>();
    for (const l of flatLessons) {
      // First lesson is always accessible; completed lessons are accessible;
      // next lesson after last completed is accessible
      if (l === flatLessons[0] || completedSet.has(l.name)) {
        set.add(l.name);
      }
    }
    // Also allow the first incomplete lesson
    const firstIncomplete = flatLessons.find((l) => !completedSet.has(l.name));
    if (firstIncomplete) set.add(firstIncomplete.name);

    return set;
  }, [flatLessons, completedSet]);

  // Save current lesson position
  useEffect(() => {
    if (courseId && currentLesson) {
      saveCurrentLesson(courseId, currentLesson.name).catch(() => {});
    }
  }, [courseId, currentLesson]);

  // =========================================================================
  // Mutations
  // =========================================================================

  const markCompleteMutation = useMutation({
    mutationFn: () => markLessonComplete(courseId!, currentLesson!.name),
    onSuccess: () => {
      // The backend (`mark_lesson_complete`) issues the course certificate
      // itself once every lesson is complete, so there's nothing to do here
      // beyond refreshing progress.
      queryClient.invalidateQueries({ queryKey: ['progress', courseId] });
      queryClient.invalidateQueries({ queryKey: ['learnChapters', courseId] });
    },
  });

  const isCurrentLessonCompleted = currentLesson
    ? completedSet.has(currentLesson.name)
    : false;

  // Auto-completion is now driven by VimeoPlayer's onComplete callback
  // (fires once when watch fraction reaches completionThreshold). Reset
  // the guard flag when the lesson changes.
  useEffect(() => {
    setHasAutoCompleted(false);
  }, [lessonId]);

  // =========================================================================
  // Navigation helpers
  // =========================================================================

  const handleSelectLesson = useCallback(
    (_chapterNum: number, _lessonNum: number, lessonName: string) => {
      if (courseId) {
        navigate(learnLessonPath(courseId, lessonName));
      }
    },
    [courseId, navigate]
  );

  // Derived lesson media/content. Computed here (before the render guards) so
  // that the hooks below always run on every render — moving them after an
  // early return violates the Rules of Hooks (React error #310).
  const videoData = currentLesson?.youtube
    ? parseVimeoVideo(currentLesson.youtube)
    : lessonDetail?.youtube
      ? parseVimeoVideo(lessonDetail.youtube)
      : null;

  const lessonContent = lessonDetail?.content || currentLesson?.content || '';

  // A lesson paired with a quiz is only completed by passing that quiz (the
  // backend marks it complete on a passing submission). For these lessons we
  // suppress video/scroll auto-completion and the manual "Mark Complete" button.
  const lessonQuizId = currentLesson?.quiz_id || lessonDetail?.quiz_id || null;
  const hasQuiz = !!lessonQuizId;

  // Reading-time estimate for text-only lessons (250 wpm).
  const readingTimeMinutes = useMemo(() => {
    if (!lessonContent) return 0;
    const text = lessonContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = text ? text.split(' ').length : 0;
    return Math.max(1, Math.round(words / 250));
  }, [lessonContent]);

  // Auto-complete on scroll-to-bottom for text-only lessons. Only fires when
  // there is no video (video lessons complete via the player's onComplete).
  useEffect(() => {
    if (videoData) return;
    if (hasQuiz) return; // quiz lessons complete only on a passing quiz attempt
    if (!textBottomRef.current) return;
    if (!lessonId || !courseId) return;
    if (hasAutoCompleted || isCurrentLessonCompleted) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setHasAutoCompleted(true);
          markCompleteMutation.mutate();
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(textBottomRef.current);
    return () => observer.disconnect();
  // markCompleteMutation is stable — exclude it to avoid re-subscribing per render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoData, hasQuiz, lessonId, courseId, hasAutoCompleted, isCurrentLessonCompleted, lessonContent]);

  // =========================================================================
  // Render guards
  // =========================================================================

  if (accessLoading || courseLoading || chaptersLoading) {
    return <PageSkeleton />;
  }

  if (!hasAccess) {
    return null; // Will redirect via useEffect
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-alabaster flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-heading text-xl font-semibold text-dark mb-2">
            Course not found
          </h2>
          <p className="text-gray-500 mb-4">
            We could not load this course.
          </p>
          <Link
            to="/courses"
            className="px-5 py-2 bg-dark text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            Browse Courses
          </Link>
        </div>
      </div>
    );
  }

  // If we're still waiting for lesson redirect
  if (!lessonId) {
    return <PageSkeleton />;
  }

  if (!currentLesson) {
    return (
      <div className="min-h-screen bg-alabaster flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <AlertTriangle className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="font-heading text-xl font-semibold text-dark mb-2">
            Lesson not found
          </h2>
          <p className="text-gray-500 mb-6">
            This lesson link is invalid or no longer available. Return to the course to continue.
          </p>
          <Link
            to={`/course/${courseId}`}
            className="px-5 py-2.5 bg-dark text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            Back to Course
          </Link>
        </div>
      </div>
    );
  }

  // Sequential gating: lesson locked
  if (lessonAccess && !lessonAccess.access) {
    return (
      <div className="min-h-screen bg-alabaster flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <Lock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="font-heading text-xl font-semibold text-dark mb-2">
            Lesson Locked
          </h2>
          <p className="text-gray-500 mb-6">
            {lessonAccess.reason || 'Complete the previous lesson to unlock this one.'}
          </p>
          <Link
            to={learnCoursePath(courseId!)}
            className="px-5 py-2.5 bg-dark text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            Back to Course
          </Link>
        </div>
      </div>
    );
  }

  const progressPercentage = progress
    ? Math.round(
        (progress.completed_lessons.length / Math.max(progress.total_lessons, 1)) * 100
      )
    : 0;

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="min-h-screen bg-alabaster">
      {/* Expiry banner */}
      {isExpiringSoon && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2.5 text-center">
          <p className="text-sm text-yellow-800 flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Your access expires in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}.
            Please complete the course before your access ends.
          </p>
        </div>
      )}

      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                to={`/course/${courseId}`}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-dark transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Course</span>
              </Link>
              <div className="h-5 w-px bg-gray-200 flex-shrink-0" />
              <h1 className="font-heading font-semibold text-dark text-sm sm:text-base truncate">
                {course.title}
              </h1>
            </div>

            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden flex items-center gap-1.5 text-sm text-gray-500 hover:text-dark transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              <span>Outline</span>
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3 pb-2">
            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {progressPercentage}%
            </span>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* =============================================================== */}
          {/* MAIN AREA                                                       */}
          {/* =============================================================== */}
          <div className="lg:col-span-9 space-y-6">
            {/* Video or content area */}
            {videoData ? (
              <div className="relative">
                <VimeoPlayer
                  videoId={videoData.id}
                  hash={videoData.hash}
                  lessonId={currentLesson.name}
                  onComplete={() => {
                    if (
                      !hasQuiz &&
                      !hasAutoCompleted &&
                      !isCurrentLessonCompleted &&
                      currentLesson &&
                      courseId
                    ) {
                      setHasAutoCompleted(true);
                      markCompleteMutation.mutate();
                    }
                  }}
                  completionThreshold={0.9}
                />
                {user?.email && <VideoWatermark email={user.email} />}
              </div>
            ) : (
              <div className="bg-gradient-to-br from-primary-light/30 to-alabaster border border-primary/20 rounded-xl p-5 sm:p-6 flex items-center gap-4">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary-dark" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dark">Reading lesson</p>
                  {readingTimeMinutes > 0 && (
                    <p className="text-xs text-dark-light mt-0.5">
                      About {readingTimeMinutes} {readingTimeMinutes === 1 ? 'minute' : 'minutes'}
                      {!isCurrentLessonCompleted && ' • auto-completes when you reach the end'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Lesson title */}
            {currentLesson && (
              <div>
                <h2 className="font-heading text-xl sm:text-2xl font-bold text-dark">
                  {currentLesson.title}
                </h2>
                {currentLesson.duration > 0 && (
                  <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-400">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDuration(currentLesson.duration)}
                  </div>
                )}
              </div>
            )}

            {/* Lesson content */}
            {lessonLoading ? (
              <div className="space-y-3 animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded w-full" />
                ))}
              </div>
            ) : lessonContent ? (
              <div className="bg-white rounded-xl border border-gray-100 p-5 sm:p-8">
                <LessonContent html={lessonContent} />
                {/* Sentinel: when this scrolls into view we mark text lessons complete */}
                <div ref={textBottomRef} aria-hidden="true" className="h-px w-full" />
              </div>
            ) : null}

            {/* Bottom navigation */}
            <div className="flex items-center justify-between gap-4 pt-2 pb-8">
              {/* Previous */}
              {prevLesson ? (
                <Link
                  to={learnLessonPath(courseId!, prevLesson.name)}
                  className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Link>
              ) : (
                <div />
              )}

              {/* Center actions */}
              <div className="flex items-center gap-3">
                {/* Completion status / action */}
                {isCurrentLessonCompleted ? (
                  <span className="flex items-center gap-2 px-4 py-2.5 text-green-600 text-sm font-medium">
                    <CheckCircle className="w-4 h-4" />
                    Completed
                  </span>
                ) : hasQuiz ? (
                  // Quiz lessons are completed by passing the quiz, not a manual
                  // button — nudge the student toward the quiz instead.
                  <span className="hidden sm:flex items-center gap-2 px-4 py-2.5 text-gray-500 text-sm">
                    Pass the quiz to complete this lesson
                  </span>
                ) : (
                  <button
                    onClick={() => markCompleteMutation.mutate()}
                    disabled={markCompleteMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2.5 bg-dark text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {markCompleteMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Mark Complete
                  </button>
                )}

                {/* Quiz button */}
                {hasQuiz && (
                  <Link
                    to={`/quiz/${lessonQuizId}`}
                    className="flex items-center gap-2 px-4 py-2.5 bg-dark text-white rounded-lg text-sm font-medium hover:bg-dark/90 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Take Quiz
                  </Link>
                )}
              </div>

              {/* Next */}
              {nextLesson ? (
                <Link
                  to={learnLessonPath(courseId!, nextLesson.name)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-dark text-white rounded-lg text-sm font-medium hover:bg-dark/90 transition-colors"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              ) : (
                <div />
              )}
            </div>
          </div>

          {/* =============================================================== */}
          {/* SIDEBAR                                                         */}
          {/* =============================================================== */}

          {/* Mobile overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/30 z-30 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <div
            className={cn(
              'lg:col-span-3',
              // Mobile: slide-in drawer
              'fixed lg:static inset-y-0 right-0 z-40 w-80 lg:w-auto',
              'transform transition-transform duration-300 lg:transform-none',
              sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
            )}
          >
            <div className="lg:sticky lg:top-20 h-full lg:h-auto overflow-y-auto bg-alabaster lg:bg-transparent">
              {/* Mobile close */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 lg:hidden bg-white">
                <span className="font-heading font-semibold text-dark text-sm">
                  Course Outline
                </span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-gray-400 hover:text-dark transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <CourseSidebar
                chapters={chapters}
                progress={progress}
                currentLessonName={lessonId || null}
                onSelectLesson={handleSelectLesson}
                accessibleLessons={accessibleLessons}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
