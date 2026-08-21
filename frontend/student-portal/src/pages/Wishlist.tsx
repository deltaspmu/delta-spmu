import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCourseDetail } from '@/api/client';
import { useWishlist } from '@/hooks/useWishlist';
import { useAuth } from '@/context/AuthContext';
import type { Course } from '@/types';
import {
  getCourseImageUrl,
  formatPrice,
  formatDuration,
} from '@/lib/utils';
import Avatar from '@/components/Avatar';
import {
  Heart,
  Star,
  Clock,
  BookOpen,
  ShoppingCart,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Skeleton Card
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm animate-pulse">
      <div className="aspect-video bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-gray-200 rounded w-full" />
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-200" />
          <div className="h-3 bg-gray-200 rounded w-1/3" />
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="h-3 bg-gray-200 rounded w-16" />
          <div className="h-5 bg-gray-200 rounded w-20" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Course Card
// ---------------------------------------------------------------------------

interface CourseCardProps {
  course: Course;
  onRemove: (courseId: string) => void;
}

function CourseCard({ course, onRemove }: CourseCardProps) {
  return (
    <div className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col relative">
      {/* Remove button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove(course.name);
        }}
        className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
        aria-label="Remove from wishlist"
      >
        <Heart className="w-4 h-4" fill="currentColor" />
      </button>

      {/* Image */}
      <Link to={`/course/${course.name}`} className="relative aspect-video overflow-hidden">
        <img
          src={getCourseImageUrl(course)}
          alt={course.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {course.category && (
          <span className="absolute top-3 left-3 bg-dark/90 text-white text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur-sm">
            {course.category}
          </span>
        )}
      </Link>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <Link to={`/course/${course.name}`}>
          <h3 className="font-heading font-semibold text-dark text-base line-clamp-2 mb-2 hover:text-primary transition-colors">
            {course.title}
          </h3>
        </Link>

        {/* Instructor */}
        <div className="flex items-center gap-2 mb-2">
          <Avatar
            src={course.instructor_image}
            name={course.instructor_name}
            size={24}
            alt={course.instructor_name}
            className="w-6 h-6 rounded-full object-cover"
          />
          <span className="text-sm text-gray-500 truncate">
            {course.instructor_name}
          </span>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-3">
          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <span className="text-sm font-medium text-dark">
            {course.avg_rating > 0 ? course.avg_rating.toFixed(1) : 'New'}
          </span>
          {course.review_count > 0 && (
            <span className="text-sm text-gray-400">
              ({course.review_count})
            </span>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom row */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-3 text-gray-400 text-xs">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              {course.lesson_count}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDuration(course.total_duration)}
            </span>
          </div>
          <span className="font-heading font-bold text-primary text-sm">
            {course.course_price > 0
              ? formatPrice(course.course_price, course.currency)
              : 'Free'}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-3">
          <Link
            to={`/course/${course.name}`}
            className="flex-1 text-center px-3 py-2 border border-gray-200 text-dark rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            View Course
          </Link>
          <Link
            to={`/payment/${course.name}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-dark text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Buy Now
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Wishlist() {
  const { t } = useTranslation(['common', 'pages']);
  const { user } = useAuth();
  const { wishlist, removeFromWishlist } = useWishlist();

  // Fetch course details for all wishlist items
  const {
    data: coursesData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['wishlistCourses', wishlist],
    queryFn: async () => {
      if (wishlist.length === 0) return [];
      const results = await Promise.allSettled(
        wishlist.map((courseId) => getCourseDetail(courseId))
      );
      return results
        .filter(
          (r): r is PromiseFulfilledResult<unknown> => r.status === 'fulfilled'
        )
        .map((r) => r.value as Course)
        .filter(Boolean);
    },
    enabled: !!user && wishlist.length > 0,
  });

  const courses: Course[] = useMemo(() => {
    if (!coursesData) return [];
    if (Array.isArray(coursesData)) return coursesData as Course[];
    return [];
  }, [coursesData]);

  const isEmpty = !isLoading && wishlist.length === 0;

  return (
    <div className="min-h-screen bg-alabaster">
      {/* Header */}
      <div className="bg-dark text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-2">
            <Heart className="w-8 h-8 text-primary" />
            <h1 className="font-heading text-3xl sm:text-4xl font-bold">
              {t('pages:wishlist.title', 'My Wishlist')}
            </h1>
            {wishlist.length > 0 && (
              <span className="ml-2 px-2.5 py-0.5 bg-primary/20 text-primary text-sm font-medium rounded-full">
                {wishlist.length}
              </span>
            )}
          </div>
          <p className="text-gray-300 text-lg">
            Courses you've saved for later
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading */}
        {isLoading && wishlist.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: wishlist.length }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : isError ? (
          /* Error */
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">
              Something went wrong while loading your wishlist.
            </p>
            <button
              onClick={() => refetch()}
              className="px-6 py-2 bg-dark text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        ) : isEmpty ? (
          /* Empty state */
          <div className="text-center py-16">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-heading text-lg font-semibold text-dark mb-1">
              Your wishlist is empty.
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              Browse courses to add to your wishlist.
            </p>
            <Link
              to="/courses"
              className="inline-flex items-center px-6 py-2.5 bg-dark text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Browse Courses
            </Link>
          </div>
        ) : (
          /* Course grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {courses.map((course) => (
              <CourseCard
                key={course.name}
                course={course}
                onRemove={removeFromWishlist}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
