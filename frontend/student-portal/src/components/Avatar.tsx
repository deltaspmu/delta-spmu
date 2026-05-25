import { useState } from 'react';
import { getFileUrl } from '@/lib/utils';

/**
 * Builds the initials-fallback URL from a person's name.
 * Uses ui-avatars.com to generate a clean colored circle with up to 2 letters.
 */
function initialsAvatarUrl(fullName: string | undefined, size = 128): string {
  const name = fullName || 'U';
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=D1BFAE&color=121212&size=${size}`;
}

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * Avatar with automatic initials-fallback.
 *
 * Renders the user-uploaded image (Frappe path or absolute URL) when present,
 * and falls back to a clean initials avatar via ui-avatars.com if the image
 * either is missing OR fails to load (broken-image icon scenario).
 *
 * Use this anywhere you'd render a user / instructor avatar — Profile,
 * Dashboard, CourseCard, CourseDetail, Reviews, Wishlist.
 */
export default function Avatar({ src, name, size = 128, className, alt }: AvatarProps) {
  // Treat empty string the same as null
  const initial = src && src.trim() ? getFileUrl(src) : initialsAvatarUrl(name, size);
  const [current, setCurrent] = useState(initial);

  return (
    <img
      src={current}
      alt={alt ?? name ?? 'User'}
      className={className}
      onError={() => {
        const fallback = initialsAvatarUrl(name, size);
        if (current !== fallback) setCurrent(fallback);
      }}
    />
  );
}
