import { useState, useEffect } from 'react';
import { parseVimeoVideo } from '@/lib/utils';
import { Play } from 'lucide-react';

interface CoursePreviewPlayerProps {
  videoValue: string | null;
  /** Fallback poster (e.g. the course image) if the video's own thumbnail
   *  can't be fetched. */
  thumbnailUrl?: string;
  courseTitle?: string;
}

// NOTE: This is a static placeholder for now — it shows the preview video's
// thumbnail with a decorative play icon but does not play. The interactive
// video preview will be reimplemented later.
export default function CoursePreviewPlayer({
  videoValue,
  thumbnailUrl,
  courseTitle,
}: CoursePreviewPlayerProps) {
  const [videoThumb, setVideoThumb] = useState<string | null>(null);

  const parsed =
    videoValue && videoValue.trim() ? parseVimeoVideo(videoValue) : null;
  const videoId = parsed?.id ?? null;
  const videoHash = parsed?.hash ?? null;

  // Fetch the preview video's own Vimeo thumbnail (public oEmbed, no token).
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

  const poster = videoThumb || thumbnailUrl || null;

  return (
    <div className="aspect-video rounded-xl overflow-hidden relative bg-gray-900">
      {poster ? (
        <img
          src={poster}
          alt={courseTitle ?? 'Course preview'}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
      )}

      {/* Subtle darkening so the play icon stays legible */}
      <div className="absolute inset-0 bg-black/20" />

      {/* Decorative play icon (no playback yet) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
          <Play className="w-7 h-7 text-gray-900 ml-1" fill="currentColor" />
        </div>
      </div>
    </div>
  );
}
