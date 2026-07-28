import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn, getCourseImageUrl } from '@/lib/utils';
import type { Course } from '@/types';

interface HeroBannerCarouselProps {
  courses: Course[];
}

export default function HeroBannerCarousel({ courses }: HeroBannerCarouselProps) {
  const { t } = useTranslation(['common', 'pages']);
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const slides = courses.slice(0, 3);

  const goTo = useCallback((index: number) => {
    setCurrent(index);
  }, []);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  // Auto-rotate
  useEffect(() => {
    if (isPaused || slides.length <= 1) return;
    timerRef.current = setInterval(next, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, next, slides.length]);

  if (slides.length === 0) return null;

  return (
    <div
      className="relative w-full h-[420px] md:h-[480px] rounded-2xl overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Slides */}
      {slides.map((course, index) => (
        <div
          key={course.name}
          className={cn(
            'absolute inset-0 transition-opacity duration-700 ease-in-out',
            index === current ? 'opacity-100 z-10' : 'opacity-0 z-0'
          )}
        >
          {/* Background image */}
          <img
            src={getCourseImageUrl(course)}
            alt={course.title}
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Dark overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />

          {/* Content */}
          <div className="relative z-10 h-full flex flex-col justify-center px-8 md:px-16 max-w-2xl">
            <h2 className="font-heading text-4xl md:text-5xl text-white font-bold leading-tight mb-4">
              {course.title}
            </h2>
            <p className="text-white/80 text-base md:text-lg mb-6 line-clamp-3">
              {course.short_introduction || course.description}
            </p>
            <Link
              to={`/courses/${course.name}`}
              className="inline-flex items-center gap-2 bg-dark text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity w-fit"
            >
              {t('buttons.view_course')}
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      ))}

      {/* Dot indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goTo(index)}
              className={cn(
                'h-2.5 rounded-full transition-all duration-300',
                index === current
                  ? 'w-8 bg-white'
                  : 'w-2.5 bg-white/50 hover:bg-white/70'
              )}
              aria-label={t('pages:courses.go_to_slide', { number: index + 1 })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
