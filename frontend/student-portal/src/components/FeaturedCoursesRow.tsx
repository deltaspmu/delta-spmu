import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { getCourseImageUrl, formatPrice } from '@/lib/utils';
import type { Course } from '@/types';

interface FeaturedCoursesRowProps {
  title: string;
  courses: Course[];
  seeAllLink?: string;
}

export default function FeaturedCoursesRow({ title, courses, seeAllLink }: FeaturedCoursesRowProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  if (courses.length === 0) return null;

  return (
    <section className="py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-2xl font-bold text-gray-900">{title}</h2>
        {seeAllLink && (
          <Link
            to={seeAllLink}
            className="text-sm font-medium text-primary hover:underline"
          >
            {t('See All', 'See All')}
          </Link>
        )}
      </div>

      {/* Scroll container with arrows */}
      <div className="relative group">
        {/* Left arrow */}
        <button
          onClick={() => scroll('left')}
          className="hidden md:group-hover:flex absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-white shadow-lg hover:bg-gray-50 transition-colors"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>

        {/* Right arrow */}
        <button
          onClick={() => scroll('right')}
          className="hidden md:group-hover:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-white shadow-lg hover:bg-gray-50 transition-colors"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-5 h-5 text-gray-700" />
        </button>

        {/* Cards */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 scrollbar-hide"
        >
          {courses.map((course) => (
            <Link
              key={course.name}
              to={`/courses/${course.name}`}
              className="snap-start shrink-0 w-[280px] rounded-xl overflow-hidden border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <img
                src={getCourseImageUrl(course)}
                alt={course.title}
                className="w-full h-40 object-cover"
              />
              <div className="p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm leading-snug">
                  {course.title}
                </h3>
                <p className="text-xs text-gray-500">{course.instructor_name}</p>
                <div className="flex items-center gap-1 text-xs">
                  <span className="font-semibold text-gray-800">
                    {course.avg_rating?.toFixed(1) || '—'}
                  </span>
                  <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="text-gray-400">({course.review_count})</span>
                </div>
                <p className="font-bold text-gray-900 text-sm">
                  {formatPrice(course.course_price, course.currency)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
