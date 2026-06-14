import { useState, useEffect } from 'react';
import { parseVimeoVideo, cn } from '@/lib/utils';
import VimeoPlayer from './VimeoPlayer';
import { Play, X } from 'lucide-react';

interface CoursePreviewPlayerProps {
  videoValue: string | null;
  /** Fallback poster (e.g. the course image) used only if the video's own
   *  Vimeo thumbnail can't be fetched. */
  thumbnailUrl?: string;
  courseTitle: string;
}

export default function CoursePreviewPlayer({
  videoValue,
  thumbnailUrl,
  courseTitle,
}: CoursePreviewPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoThumb, setVideoThumb] = useState<string | null>(null);

  const hasVideo = videoValue != null && videoValue.trim() !== '';
  const parsed = hasVideo ? parseVimeoVideo(videoValue!) : null;
  const videoId = parsed?.id ?? null;
  const videoHash = parsed?.hash ?? null;

  // Use the preview video's OWN Vimeo thumbnail as the poster (fetched via
  // oEmbed — public, no token) rather than repeating the course image.
  useEffect(() => {
    if (!videoId) {
      setVideoThumb(null);
      return;
    }
    let cancelled = false;
    const link = videoHash
      ? `https://vimeo.com/${videoId}/${videoHash}`
      : `https://vimeo.com/${videoId}`;
    fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(link)}&width=1280`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.thumbnail_url) setVideoThumb(data.thumbnail_url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [videoId, videoHash]);

  // Video thumbnail takes priority; course image is only a fallback.
  const poster = videoThumb || thumbnailUrl || null;

  if (isPlaying && parsed) {
    return (
      <div className="aspect-video rounded-xl overflow-hidden relative bg-black">
        <VimeoPlayer
          videoId={parsed.id}
          hash={parsed.hash}
          autoplay
          className="w-full h-full"
        />
        <button
          onClick={() => setIsPlaying(false)}
          className="absolute top-3 right-3 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
          aria-label="Close video"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'aspect-video rounded-xl overflow-hidden relative bg-gray-900 group',
        hasVideo && 'cursor-pointer'
      )}
      onClick={() => {
        if (hasVideo) setIsPlaying(true);
      }}
    >
      {/* Poster: the video's own thumbnail (falls back to course image) */}
      {poster ? (
        <img
          src={poster}
          alt={courseTitle}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
      )}

      {/* Dark overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      {/* Play button */}
      {hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="w-16 h-16 rounded-full bg-white/90 group-hover:bg-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
            <Play className="w-7 h-7 text-gray-900 ml-1" fill="currentColor" />
          </div>
        </div>
      )}

      {/* Course title */}
      <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
        <h3 className="text-white font-semibold text-lg leading-snug line-clamp-2">
          {courseTitle}
        </h3>
      </div>
    </div>
  );
}
