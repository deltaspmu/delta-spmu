import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCourses, getCategories } from '@/api/client';
import { useWishlist } from '@/hooks/useWishlist';
import type { Course } from '@/types';
import {
  getCourseImageUrl,
  formatPrice,
  formatDuration,
  cn,
} from '@/lib/utils';
import Avatar from '@/components/Avatar';
import HeroBannerCarousel from '@/components/HeroBannerCarousel';
import SPMUTopics from '@/components/SPMUTopics';
import {
  Search,
  Star,
  Clock,
  BookOpen,
  ChevronDown,
  Heart,
  ChevronRight,
  GraduationCap,
  Users,
  Award,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 12;

// These values map to keys in the backend's `allowed_orders` dict
// (lms.lms.api.get_courses). Mismatched keys silently fall back to
// "creation desc", so keep this in sync with that mapping.
const SORT_OPTIONS = [
  { value: 'creation', label: 'Newest' },
  { value: 'enrollment_count', label: 'Popular' },
  { value: 'course_price', label: 'Price: Low to High' },
  { value: 'course_price_desc', label: 'Price: High to Low' },
  { value: 'avg_rating', label: 'Highest Rated' },
] as const;

// ---------------------------------------------------------------------------
// Skeleton Card
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm animate-pulse">
      <div className="aspect-video bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-3 bg-gray-200 rounded w-1/4" />
        <div className="h-5 bg-gray-200 rounded w-full" />
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-200" />
          <div className="h-3 bg-gray-200 rounded w-1/3" />
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 bg-gray-200 rounded w-20" />
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="h-3 bg-gray-200 rounded w-16" />
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
}

function CourseCard({ course }: CourseCardProps) {
  const { toggleWishlist, isInWishlist } = useWishlist();
  const wishlisted = isInWishlist(course.name);

  return (
    <Link
      to={`/course/${course.name}`}
      className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col"
    >
      {/* Image */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={getCourseImageUrl(course)}
          alt={course.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {/* Category badge */}
        {course.category && (
          <span className="absolute top-3 left-3 bg-dark/90 text-white text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur-sm">
            {course.category}
          </span>
        )}
        {/* Wishlist heart */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(course.name);
          }}
          className={cn(
            'absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors',
            wishlisted
              ? 'bg-red-500 text-white'
              : 'bg-white/80 text-gray-600 hover:bg-white hover:text-red-500'
          )}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className="w-4 h-4" fill={wishlisted ? 'currentColor' : 'none'} />
        </button>
        {/* Coming soon badge */}
        {course.upcoming === 1 && (
          <span className="absolute bottom-3 left-3 bg-dark/90 text-white text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
            Coming Soon
          </span>
        )}
        {/* Promo badge */}
        {course.upcoming !== 1 &&
          !!course.discount_percent &&
          course.discount_percent > 0 && (
            <span className="absolute bottom-3 left-3 bg-primary text-dark text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
              {course.discount_percent}% OFF
            </span>
          )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-heading font-semibold text-dark text-base line-clamp-2 mb-2">
          {course.title}
        </h3>

        {/* Instructor */}
        <div className="flex items-center gap-2 mb-2">
          <Avatar
            src={course.instructor_image}
            name={course.instructor_name}
            size={32}
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

        {/* Spacer to push bottom row down */}
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
          {course.upcoming === 1 ? (
            <span className="font-heading font-bold text-primary text-sm">
              Coming Soon
            </span>
          ) : !!course.discount_percent && course.discount_percent > 0 ? (
            <span className="flex items-baseline gap-1.5">
              <span className="font-heading font-bold text-primary text-sm">
                {formatPrice(course.course_price, course.currency)}
              </span>
              <span className="text-gray-400 line-through text-xs">
                {formatPrice(course.original_price ?? course.course_price, course.currency)}
              </span>
            </span>
          ) : (
            <span className="font-heading font-bold text-primary text-sm">
              {course.course_price > 0
                ? formatPrice(course.course_price, course.currency)
                : 'Free'}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Courses() {
  const { t } = useTranslation(['common', 'pages']);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [orderBy, setOrderBy] = useState('creation');
  const [page, setPage] = useState(1);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [category, orderBy]);

  const filters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      category: category || undefined,
      order_by: orderBy,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    [debouncedSearch, category, orderBy, page]
  );

  // Fetch courses
  const {
    data: coursesData,
    isLoading: coursesLoading,
    isError: coursesError,
    refetch: refetchCourses,
  } = useQuery({
    queryKey: ['courses', filters],
    queryFn: () => getCourses(filters),
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
    staleTime: 10 * 60 * 1000,
  });

  // Parse response - handle both paginated and array responses
  const courses: Course[] = useMemo(() => {
    if (!coursesData) return [];
    if (Array.isArray(coursesData)) return coursesData as Course[];
    const d = coursesData as Record<string, unknown>;
    if (typeof d === 'object') {
      if ('courses' in d) return d.courses as Course[];
      if ('data' in d) return d.data as Course[];
    }
    return [];
  }, [coursesData]);

  const totalCourses: number = useMemo(() => {
    if (!coursesData) return 0;
    if (Array.isArray(coursesData)) return coursesData.length;
    if (typeof coursesData === 'object' && 'total' in (coursesData as Record<string, unknown>)) {
      return (coursesData as { total: number }).total;
    }
    return courses.length;
  }, [coursesData, courses.length]);

  const totalPages = Math.max(1, Math.ceil(totalCourses / PAGE_SIZE));

  const categories: string[] = useMemo(() => {
    if (!categoriesData) return [];
    if (Array.isArray(categoriesData)) {
      return categoriesData.map((c: unknown) =>
        typeof c === 'string' ? c : (c as { name: string }).name
      );
    }
    return [];
  }, [categoriesData]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-alabaster">
      {/* Hero rotator — featured course banners.
          Falls back to a static hero block when the catalog is empty
          (won't render anything for an empty courses array). */}
      {courses.length > 0 ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <HeroBannerCarousel courses={courses} />
        </div>
      ) : (
        <div
          className="relative bg-dark text-white py-16 sm:py-20 overflow-hidden"
          style={{
            backgroundImage:
              "linear-gradient(rgba(26,47,35,0.78), rgba(26,47,35,0.88)), url('/images/hero.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold mb-3">
              {t('common:courses', 'Courses')}
            </h1>
            <p className="text-primary-light text-lg max-w-2xl">
              Professional permanent makeup &amp; beauty certificates &mdash;
              from ombré brows to bridal artistry.
            </p>
          </div>
        </div>
      )}

      {/* Trust strip — academy credentials at a glance */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-light/60 flex items-center justify-center text-primary-dark shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-dark-light">Programs</p>
              <p className="text-base font-semibold text-dark">4 certificates</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-light/60 flex items-center justify-center text-primary-dark shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-dark-light">Curriculum</p>
              <p className="text-base font-semibold text-dark">Video + theory</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-light/60 flex items-center justify-center text-primary-dark shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-dark-light">Certified</p>
              <p className="text-base font-semibold text-dark">On completion</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-light/60 flex items-center justify-center text-primary-dark shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-dark-light">Blended</p>
              <p className="text-base font-semibold text-dark">Online + Studio</p>
            </div>
          </div>
        </div>
      </div>

      <div id="courses-grid" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search courses..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>

          {/* Category filter */}
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="appearance-none w-full sm:w-48 px-4 py-3 pr-10 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value)}
              className="appearance-none w-full sm:w-52 px-4 py-3 pr-10 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Course Grid */}
        {coursesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : coursesError ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">
              Something went wrong while loading courses.
            </p>
            <button
              onClick={() => refetchCourses()}
              className="px-6 py-2 bg-dark text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="font-heading text-lg font-semibold text-dark mb-1">
              No courses found
            </h3>
            <p className="text-gray-500 text-sm">
              {debouncedSearch || category
                ? 'Try adjusting your search or filters.'
                : 'Check back soon for new courses.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {courses.map((course) => (
                <CourseCard key={course.name} course={course} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }).map((_, i) => {
                  const pageNum = i + 1;
                  // Show first, last, current, and neighbors
                  if (
                    pageNum === 1 ||
                    pageNum === totalPages ||
                    Math.abs(pageNum - page) <= 1
                  ) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={cn(
                          'w-10 h-10 text-sm rounded-lg border transition-colors',
                          pageNum === page
                            ? 'bg-dark text-white border-primary'
                            : 'bg-white border-gray-200 hover:bg-gray-50 text-dark'
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                  // Show ellipsis
                  if (
                    (pageNum === 2 && page > 3) ||
                    (pageNum === totalPages - 1 && page < totalPages - 2)
                  ) {
                    return (
                      <span key={pageNum} className="px-1 text-gray-400">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}

                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* SPMU Skill Topics */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SPMUTopics />
      </div>

      {/* Meet Your Instructor — anchored to Eden Kassahun, the academy
          founder & lead educator. Static for now; later pull from a
          real instructor profile when we expose one. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden grid grid-cols-1 md:grid-cols-[280px_1fr]">
          <div className="aspect-square md:aspect-auto md:min-h-[260px] bg-primary/15">
            <img
              src="/images/eden-kassahun.jpg"
              alt="Eden Kassahun, Founder & Lead Educator of Delta SPMU Academy"
              className="w-full h-full object-cover object-top"
            />
          </div>
          <div className="p-6 sm:p-8 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-primary-dark text-xs uppercase tracking-[0.2em] font-medium mb-2">
              <Award className="w-3.5 h-3.5" />
              <span>Meet Your Instructor</span>
            </div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-dark mb-2">
              Eden Kassahun
            </h2>
            <p className="text-sm text-dark-light mb-4">
              Founder &amp; Lead Educator, Delta SPMU Academy
            </p>
            <p className="text-sm text-dark-light leading-relaxed">
              As the founder and lead educator of Delta SPMU Academy, Eden
              guides students through the academy&rsquo;s signature curriculum
              with a deep passion for the craft of permanent makeup — from
              foundational hygiene and safety through advanced brow artistry and
              instructor-level training.
            </p>
          </div>
        </div>
      </div>

      {/* Final CTA banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-dark to-dark-light p-8 sm:p-10">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-primary/10" />
          <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-primary/5" />
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-white mb-2">
                Ready to begin your journey?
              </h2>
              <p className="text-primary-light text-base max-w-xl">
                Whether you're starting from scratch or refining a craft —
                there's a program ready for the next step.
              </p>
            </div>
            <Link
              to="#courses-grid"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('courses-grid')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-dark font-semibold px-6 py-3 rounded-lg transition-colors whitespace-nowrap"
            >
              Browse Programs <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
