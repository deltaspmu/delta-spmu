import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import {
  getCourseDetail,
  getCourseChapters,
  getCourseReviews,
  submitReview,
} from '@/api/client';
import { useCourseAccess } from '@/hooks/useCourseAccess';
import { useCoursePrice } from '@/hooks/useCoursePrice';
import { useWishlist } from '@/hooks/useWishlist';
import { useAuth } from '@/context/AuthContext';
import type { Course, Chapter, Review } from '@/types';
import {
  getCourseImageUrl,
  formatPrice,
  formatDuration,
  formatDate,
  parseVimeoVideo,
  cn,
} from '@/lib/utils';
import Avatar from '@/components/Avatar';
import {
  Star,
  Clock,
  Users,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Play,
  Lock,
  Heart,
  CheckCircle,
  Award,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-alabaster animate-pulse">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb skeleton */}
        <div className="h-4 bg-gray-200 rounded w-48 mb-6" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="h-6 bg-gray-200 rounded w-24" />
            <div className="h-10 bg-gray-200 rounded w-3/4" />
            <div className="h-5 bg-gray-200 rounded w-full" />
            <div className="h-5 bg-gray-200 rounded w-2/3" />
            <div className="flex gap-4">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-4 bg-gray-200 rounded w-24" />
            </div>
            <div className="aspect-video bg-gray-200 rounded-xl" />
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded w-full" />
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="aspect-video bg-gray-200 rounded-xl" />
            <div className="h-10 bg-gray-200 rounded w-1/2" />
            <div className="h-12 bg-gray-200 rounded-lg w-full" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Star Rating Input
// ---------------------------------------------------------------------------

function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5 transition-colors"
        >
          <Star
            className={cn(
              'w-6 h-6 transition-colors',
              (hover || value) >= star
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300'
            )}
          />
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Star Display
// ---------------------------------------------------------------------------

function StarDisplay({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            cls,
            rating >= star
              ? 'text-yellow-400 fill-yellow-400'
              : rating >= star - 0.5
                ? 'text-yellow-400 fill-yellow-400/50'
                : 'text-gray-300'
          )}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Curriculum Accordion
// ---------------------------------------------------------------------------

function CurriculumAccordion({
  chapters,
  hasAccess,
}: {
  chapters: Chapter[];
  hasAccess: boolean;
}) {
  const [openChapters, setOpenChapters] = useState<Set<number>>(() => new Set([0]));

  const toggle = (idx: number) => {
    setOpenChapters((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (chapters.length === 0) {
    return (
      <p className="text-gray-500 text-sm py-4">
        Curriculum details will be available soon.
      </p>
    );
  }

  return (
    <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
      {chapters.map((chapter, idx) => {
        const isOpen = openChapters.has(idx);
        return (
          <div key={chapter.name}>
            {/* Chapter header */}
            <button
              onClick={() => toggle(idx)}
              className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-gray-400 transition-transform',
                    isOpen && 'rotate-180'
                  )}
                />
                <div>
                  <span className="text-xs text-gray-400 uppercase tracking-wide">
                    Chapter {chapter.chapter_number}
                  </span>
                  <h4 className="font-heading font-medium text-dark text-sm">
                    {chapter.title}
                  </h4>
                </div>
              </div>
              <span className="text-xs text-gray-400">
                {chapter.lessons?.length || 0} lessons
              </span>
            </button>

            {/* Lessons */}
            {isOpen && chapter.lessons && (
              <div className="bg-gray-50/50">
                {chapter.lessons.map((lesson, lIdx) => (
                  <div
                    key={lesson.name}
                    className="flex items-center gap-3 px-5 py-3 border-t border-gray-100"
                  >
                    {/* Number / status icon */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs">
                      {lesson.is_completed ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : !hasAccess ? (
                        <Lock className="w-4 h-4 text-gray-300" />
                      ) : (
                        <span className="text-gray-400 font-medium">
                          {lIdx + 1}
                        </span>
                      )}
                    </div>

                    {/* Lesson info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-dark truncate">{lesson.title}</p>
                    </div>

                    {/* Duration & video indicator */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {lesson.youtube && (
                        <Play className="w-3.5 h-3.5 text-gray-400" />
                      )}
                      {lesson.duration > 0 && (
                        <span className="text-xs text-gray-400">
                          {formatDuration(lesson.duration)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review Card
// ---------------------------------------------------------------------------

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      <div className="flex items-start gap-3 mb-3">
        <Avatar
          src={review.owner_image}
          name={review.owner_name}
          size={40}
          alt={review.owner_name}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-dark text-sm">{review.owner_name}</p>
          <p className="text-xs text-gray-400">{formatDate(review.creation)}</p>
        </div>
        <StarDisplay rating={review.rating} />
      </div>
      {review.review && (
        <p className="text-sm text-gray-600 leading-relaxed">{review.review}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const { t } = useTranslation(['common', 'pages']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const { toggleWishlist, isInWishlist } = useWishlist();

  const [activeTab, setActiveTab] = useState<'description' | 'curriculum' | 'reviews'>(
    'description'
  );
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const {
    data: courseData,
    isLoading: courseLoading,
    isError: courseError,
    refetch: refetchCourse,
  } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => getCourseDetail(courseId!),
    enabled: !!courseId,
  });

  const { data: chaptersData } = useQuery({
    queryKey: ['courseChapters', courseId],
    queryFn: () => getCourseChapters(courseId!),
    enabled: !!courseId,
  });

  const { data: reviewsData } = useQuery({
    queryKey: ['courseReviews', courseId],
    queryFn: () => getCourseReviews(courseId!),
    enabled: !!courseId,
  });

  const { hasAccess, daysRemaining, isExpiringSoon, isLoading: accessLoading } =
    useCourseAccess(courseId || '');

  const { priceInfo, isLoading: priceLoading } = useCoursePrice(courseId || '');

  // Parse data
  const course = courseData as Course | undefined;
  const chapters: Chapter[] = useMemo(() => {
    if (!chaptersData) return [];
    if (Array.isArray(chaptersData)) return chaptersData as Chapter[];
    return [];
  }, [chaptersData]);

  const reviews: Review[] = useMemo(() => {
    if (!reviewsData) return [];
    if (Array.isArray(reviewsData)) return reviewsData as Review[];
    if (
      typeof reviewsData === 'object' &&
      'data' in (reviewsData as Record<string, unknown>)
    ) {
      return (reviewsData as { data: Review[] }).data;
    }
    return [];
  }, [reviewsData]);

  const totalLessons = useMemo(
    () => chapters.reduce((sum, ch) => sum + (ch.lessons?.length || 0), 0),
    [chapters]
  );

  // Preview video
  const previewVideo = useMemo(() => {
    if (!course) return null;
    // Check first lesson of first chapter for a preview
    if (chapters.length > 0 && chapters[0].lessons?.length > 0) {
      return parseVimeoVideo(chapters[0].lessons[0].youtube);
    }
    return null;
  }, [course, chapters]);

  const wishlisted = isInWishlist(courseId || '');

  // Submit review mutation
  const submitReviewMutation = useMutation({
    mutationFn: () => submitReview(courseId!, reviewRating, reviewText),
    onSuccess: () => {
      setReviewRating(0);
      setReviewText('');
      queryClient.invalidateQueries({ queryKey: ['courseReviews', courseId] });
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    },
  });

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (courseLoading) return <PageSkeleton />;

  if (courseError || !course) {
    return (
      <div className="min-h-screen bg-alabaster flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-heading text-xl font-semibold text-dark mb-2">
            Course not found
          </h2>
          <p className="text-gray-500 mb-4">
            We could not load this course. It may have been removed or the link is incorrect.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => refetchCourse()}
              className="px-5 py-2 bg-dark text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Try Again
            </button>
            <Link
              to="/courses"
              className="px-5 py-2 border border-gray-200 text-dark rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Browse Courses
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // CTA logic
  // ---------------------------------------------------------------------------

  let ctaLabel = '';
  let ctaAction: () => void = () => {};
  let ctaVariant: 'primary' | 'secondary' = 'primary';

  if (!isAuthenticated) {
    ctaLabel = 'Log In to Enroll';
    ctaAction = () => navigate('/login');
  } else if (hasAccess) {
    ctaLabel = 'Continue Learning';
    ctaAction = () => navigate(`/learn/${courseId}`);
    ctaVariant = 'secondary';
  } else {
    ctaLabel = `Buy Now \u2014 ${formatPrice(priceInfo.final_price, priceInfo.currency)}`;
    ctaAction = () => navigate(`/payment/${courseId}`);
  }

  const TABS = [
    { key: 'description' as const, label: 'Description' },
    { key: 'curriculum' as const, label: 'Curriculum' },
    { key: 'reviews' as const, label: `Reviews (${course.review_count || 0})` },
  ];

  return (
    <div className="min-h-screen bg-alabaster">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link to="/courses" className="hover:text-primary transition-colors">
            Courses
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-dark truncate max-w-xs">{course.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ================================================================ */}
          {/* MAIN COLUMN                                                      */}
          {/* ================================================================ */}
          <div className="lg:col-span-2 space-y-6">
            {/* Category badge */}
            {course.category && (
              <span className="inline-block bg-primary/10 text-primary text-xs font-medium px-3 py-1 rounded-full">
                {course.category}
              </span>
            )}

            {/* Title */}
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-dark">
              {course.title}
            </h1>

            {/* Short intro */}
            {course.short_introduction && (
              <p className="text-lg text-gray-600 leading-relaxed">
                {course.short_introduction}
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1.5">
                <StarDisplay rating={course.avg_rating} />
                <span className="font-medium text-dark">
                  {course.avg_rating > 0 ? course.avg_rating.toFixed(1) : 'New'}
                </span>
                {course.review_count > 0 && (
                  <span className="text-gray-400">
                    ({course.review_count} reviews)
                  </span>
                )}
              </div>
              <span className="text-gray-300">|</span>
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>{course.enrollment_count || 0} enrolled</span>
              </div>
              <span className="text-gray-300">|</span>
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                <span>{course.lesson_count || totalLessons} lessons</span>
              </div>
            </div>

            {/* Instructor row */}
            <div className="flex items-center gap-3">
              <Avatar
                src={course.instructor_image}
                name={course.instructor_name}
                size={40}
                alt={course.instructor_name}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div>
                <p className="text-sm font-medium text-dark">
                  {course.instructor_name}
                </p>
                <p className="text-xs text-gray-400">Instructor</p>
              </div>
            </div>

            {/* Preview video placeholder */}
            <div className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden group cursor-pointer">
              <img
                src={getCourseImageUrl(course)}
                alt={`${course.title} preview`}
                className="w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Play className="w-7 h-7 text-dark ml-1" fill="currentColor" />
                </div>
              </div>
              {!previewVideo && (
                <div className="absolute bottom-4 left-4 bg-black/60 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
                  Preview coming soon
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <div className="flex gap-0">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px',
                      activeTab === tab.key
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-dark hover:border-gray-300'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="min-h-[200px]">
              {/* Description */}
              {activeTab === 'description' && (
                <div className="prose prose-sm max-w-none text-gray-600">
                  {course.description ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(course.description),
                      }}
                    />
                  ) : (
                    <p className="text-gray-400">
                      No description available for this course yet.
                    </p>
                  )}
                </div>
              )}

              {/* Curriculum */}
              {activeTab === 'curriculum' && (
                <CurriculumAccordion
                  chapters={chapters}
                  hasAccess={hasAccess}
                />
              )}

              {/* Reviews */}
              {activeTab === 'reviews' && (
                <div className="space-y-6">
                  {/* Write review form (if enrolled) */}
                  {isAuthenticated && hasAccess && (
                    <div className="bg-white rounded-xl p-5 border border-gray-100">
                      <h3 className="font-heading font-semibold text-dark text-sm mb-3">
                        Write a Review
                      </h3>
                      <div className="mb-3">
                        <StarRatingInput
                          value={reviewRating}
                          onChange={setReviewRating}
                        />
                      </div>
                      <textarea
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        placeholder="Share your experience with this course..."
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                        rows={4}
                      />
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => submitReviewMutation.mutate()}
                          disabled={
                            reviewRating === 0 ||
                            !reviewText.trim() ||
                            submitReviewMutation.isPending
                          }
                          className="px-5 py-2 bg-dark text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {submitReviewMutation.isPending
                            ? 'Submitting...'
                            : 'Submit Review'}
                        </button>
                      </div>
                      {submitReviewMutation.isError && (
                        <p className="text-red-500 text-xs mt-2">
                          Failed to submit review. Please try again.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Reviews list */}
                  {reviews.length === 0 ? (
                    <div className="text-center py-8">
                      <Star className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">
                        No reviews yet. Be the first to review this course!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reviews.map((review) => (
                        <ReviewCard key={review.name} review={review} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ================================================================ */}
          {/* SIDEBAR                                                          */}
          {/* ================================================================ */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-5">
              {/* Course image */}
              <div className="relative rounded-xl overflow-hidden shadow-sm">
                <img
                  src={getCourseImageUrl(course)}
                  alt={course.title}
                  className="w-full aspect-video object-cover"
                />
                {/* Wishlist */}
                <button
                  onClick={() => toggleWishlist(course.name)}
                  className={cn(
                    'absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-colors',
                    wishlisted
                      ? 'bg-red-500 text-white'
                      : 'bg-white/80 text-gray-600 hover:bg-white hover:text-red-500'
                  )}
                  aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                >
                  <Heart
                    className="w-4.5 h-4.5"
                    fill={wishlisted ? 'currentColor' : 'none'}
                  />
                </button>
              </div>

              {/* Price */}
              <div className="bg-white rounded-xl p-5 border border-gray-100">
                {priceLoading ? (
                  <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse" />
                ) : (
                  <div className="flex items-baseline gap-3 mb-4">
                    <span className="font-heading text-3xl font-bold text-dark">
                      {priceInfo.final_price > 0
                        ? formatPrice(priceInfo.final_price, priceInfo.currency)
                        : 'Free'}
                    </span>
                    {priceInfo.discount_percent > 0 && (
                      <>
                        <span className="text-gray-400 line-through text-lg">
                          {formatPrice(priceInfo.original_price, priceInfo.currency)}
                        </span>
                        <span className="text-green-600 text-sm font-medium">
                          {priceInfo.discount_percent}% off
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* CTA */}
                <button
                  onClick={ctaAction}
                  disabled={accessLoading}
                  className={cn(
                    'w-full py-3 rounded-lg font-medium text-sm transition-colors',
                    ctaVariant === 'primary'
                      ? 'bg-dark text-white hover:bg-primary/90'
                      : 'bg-dark text-white hover:bg-dark/90'
                  )}
                >
                  {accessLoading ? 'Loading...' : ctaLabel}
                </button>

                {/* Expiring warning */}
                {isAuthenticated && hasAccess && isExpiringSoon && (
                  <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2.5 text-xs text-yellow-700">
                    <Clock className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                    Access expires in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
                  </div>
                )}
              </div>

              {/* Bundle offer */}
              {priceInfo.bundle_available && !hasAccess && (
                <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-5 border border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="w-5 h-5 text-primary" />
                    <h3 className="font-heading font-semibold text-dark text-sm">
                      Bundle Offer
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Get all 4 courses for{' '}
                    <span className="font-bold text-dark">
                      {formatPrice(priceInfo.bundle_price, priceInfo.currency)}
                    </span>
                  </p>
                  <button
                    onClick={() => navigate('/payment/all-courses-bundle')}
                    className="w-full py-2.5 bg-dark text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Buy Bundle
                  </button>
                </div>
              )}

              {/* Course includes */}
              <div className="bg-white rounded-xl p-5 border border-gray-100">
                <h3 className="font-heading font-semibold text-dark text-sm mb-3">
                  This course includes
                </h3>
                <ul className="space-y-2.5">
                  <li className="flex items-center gap-3 text-sm text-gray-600">
                    <BookOpen className="w-4 h-4 text-primary flex-shrink-0" />
                    {course.lesson_count || totalLessons} lessons
                  </li>
                  <li className="flex items-center gap-3 text-sm text-gray-600">
                    <Play className="w-4 h-4 text-primary flex-shrink-0" />
                    {course.total_duration > 0
                      ? formatDuration(course.total_duration)
                      : 'Video content'}{' '}
                    of video
                  </li>
                  <li className="flex items-center gap-3 text-sm text-gray-600">
                    <Award className="w-4 h-4 text-primary flex-shrink-0" />
                    Certificate of completion
                  </li>
                  <li className="flex items-center gap-3 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    Lifetime support
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
