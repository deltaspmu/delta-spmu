import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onChange?: (rating: number) => void;
  className?: string;
}

const sizeMap = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-6 h-6' };

export default function StarRating({
  rating,
  maxStars = 5,
  size = 'md',
  interactive = false,
  onChange,
  className,
}: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const displayRating = interactive && hovered !== null ? hovered : rating;
  const starSize = sizeMap[size];

  const handleClick = (value: number) => {
    if (interactive && onChange) onChange(value);
  };

  return (
    <div
      className={cn('inline-flex items-center gap-0.5', className)}
      onMouseLeave={() => interactive && setHovered(null)}
    >
      {Array.from({ length: maxStars }, (_, i) => {
        const starValue = i + 1;
        const fill = displayRating >= starValue
          ? 'full'
          : displayRating >= starValue - 0.5
            ? 'half'
            : 'empty';

        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            className={cn(
              'relative shrink-0 disabled:cursor-default',
              interactive && 'cursor-pointer hover:scale-110 transition-transform'
            )}
            onMouseEnter={() => interactive && setHovered(starValue)}
            onClick={() => handleClick(starValue)}
            aria-label={`${starValue} star${starValue > 1 ? 's' : ''}`}
          >
            {/* Empty star (background) */}
            <Star className={cn(starSize, 'text-gray-300')} />
            {/* Filled overlay */}
            {fill !== 'empty' && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: fill === 'half' ? '50%' : '100%' }}
              >
                <Star className={cn(starSize, 'fill-yellow-400 text-yellow-400')} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
