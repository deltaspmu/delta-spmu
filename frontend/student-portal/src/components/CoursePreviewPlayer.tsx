import { useState } from 'react';
import { parseVimeoVideo, cn } from '@/lib/utils';
import VimeoPlayer from './VimeoPlayer';
import { Play, X } from 'lucide-react';

interface CoursePreviewPlayerProps {
  videoValue: string | null;
  thumbnailUrl?: string;
  courseTitle: string;
}

export default function CoursePreviewPlayer({
  videoValue,
  thumbnailUrl,
  courseTitle,
}: CoursePreviewPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const hasVideo = videoValue != null && videoValue.trim() !== '';
  const parsed = hasVideo ? parseVimeoVideo(videoValue!) : null;

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
      {/* Thumbnail / background */}
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
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
