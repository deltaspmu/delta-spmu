import { useTranslation } from 'react-i18next';
import { cn, getUserAvatarUrl, formatDate } from '@/lib/utils';
import StarRating from './StarRating';
import type { Review } from '@/types';

interface CourseReviewsProps {
  reviews: Review[];
  averageRating: number;
  totalCount: number;
  onLoadMore?: () => void;
}

export default function CourseReviews({
  reviews,
  averageRating,
  totalCount,
  onLoadMore,
}: CourseReviewsProps) {
  const { t } = useTranslation();

  // Compute rating distribution from the reviews we have
  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => Math.round(r.rating) === star).length;
    const percent = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0;
    return { star, count, percent };
  });

  return (
    <section className="space-y-8">
      <h3 className="font-heading text-xl font-bold text-gray-900">
        {t('Student Reviews', 'Student Reviews')}
      </h3>

      {/* Summary row */}
      <div className="flex flex-col md:flex-row gap-8">
        {/* Average rating */}
        <div className="flex flex-col items-center justify-center shrink-0 px-6">
          <span className="text-5xl font-bold text-gray-900">
            {averageRating.toFixed(1)}
          </span>
          <StarRating rating={averageRating} size="md" className="mt-2" />
          <span className="text-sm text-gray-500 mt-1">
            {t('{{count}} reviews', { count: totalCount })}
          </span>
        </div>

        {/* Distribution bars */}
        <div className="flex-1 space-y-2">
          {distribution.map(({ star, count, percent }) => (
            <div key={star} className="flex items-center gap-3 text-sm">
              <span className="w-6 text-right font-medium text-gray-700">{star}</span>
              <StarRating rating={star} maxStars={1} size="sm" />
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="w-10 text-right text-gray-500">{percent}%</span>
              <span className="w-8 text-right text-gray-400">({count})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Individual reviews */}
      <div className="space-y-6">
        {reviews.map((review) => (
          <div
            key={review.name}
            className="border-b border-gray-100 pb-6 last:border-0"
          >
            <div className="flex items-center gap-3 mb-2">
              <img
                src={getUserAvatarUrl({
                  user_image: review.owner_image,
                  full_name: review.owner_name,
                })}
                alt={review.owner_name}
                className="w-10 h-10 rounded-full object-cover"
              />
              <div>
                <p className="font-semibold text-gray-900 text-sm">
                  {review.owner_name}
                </p>
                <p className="text-xs text-gray-400">{formatDate(review.creation)}</p>
              </div>
            </div>
            <StarRating rating={review.rating} size="sm" className="mb-2" />
            <p className="text-gray-700 text-sm leading-relaxed">{review.review}</p>
          </div>
        ))}
      </div>

      {/* Load more */}
      {onLoadMore && reviews.length < totalCount && (
        <div className="flex justify-center pt-2">
          <button
            onClick={onLoadMore}
            className={cn(
              'bg-dark text-white px-6 py-2.5 rounded-lg font-medium text-sm',
              'hover:opacity-90 transition-opacity'
            )}
          >
            {t('Load More', 'Load More')}
          </button>
        </div>
      )}
    </section>
  );
}
