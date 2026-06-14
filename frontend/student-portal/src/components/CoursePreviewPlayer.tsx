import { parseVimeoVideo } from '@/lib/utils';
import VimeoPlayer from './VimeoPlayer';

interface CoursePreviewPlayerProps {
  videoValue: string | null;
  // Kept for call-site compatibility; the autoplaying player uses the video's
  // own Vimeo thumbnail as its poster, so these are no longer needed.
  thumbnailUrl?: string;
  courseTitle?: string;
}

export default function CoursePreviewPlayer({ videoValue }: CoursePreviewPlayerProps) {
  const parsed =
    videoValue && videoValue.trim() ? parseVimeoVideo(videoValue) : null;

  if (!parsed) return null;

  return (
    <div className="aspect-video rounded-xl overflow-hidden bg-black">
      {/* Autoplays muted as a silent teaser. Controls let the viewer unmute;
          if a browser blocks muted autoplay, Vimeo shows the video's own
          thumbnail with a play button. */}
      <VimeoPlayer
        videoId={parsed.id}
        hash={parsed.hash}
        autoplay
        muted
        className="w-full h-full"
      />
    </div>
  );
}
