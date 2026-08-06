import { useEffect, useRef, useState, useCallback } from 'react';
import Player from '@vimeo/player';

interface VimeoPlayerProps {
  videoId: string;
  hash?: string | null;
  onProgress?: (percent: number) => void;
  onComplete?: () => void;
  completionThreshold?: number;
  lessonId?: string;
  className?: string;
  autoplay?: boolean;
  muted?: boolean;
}

export default function VimeoPlayer({
  videoId,
  hash = null,
  onProgress,
  onComplete,
  completionThreshold = 0.9,
  lessonId,
  className,
  autoplay = false,
  muted = false,
}: VimeoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const completionTriggeredRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const storageKey = lessonId ? `vimeo_progress_${lessonId}` : null;

  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    completionTriggeredRef.current = false;

    if (playerRef.current) {
      playerRef.current.destroy().catch(() => {});
      playerRef.current = null;
    }

    initializePlayer();
  }, []);

  const initializePlayer = useCallback(() => {
    if (!containerRef.current) return;

    const options: Record<string, unknown> = {
      responsive: true,
      autoplay: autoplay || false,
      muted: muted || false,
      title: false,
      byline: false,
      portrait: false,
    };

    // Unlisted videos must be referenced by their full private URL
    // (vimeo.com/<id>/<hash>). Vimeo's oEmbed 404s when given the bare id with
    // the hash as a separate ?h param, which breaks playback.
    if (hash) {
      options.url = `https://vimeo.com/${videoId}/${hash}`;
    } else {
      options.id = parseInt(videoId, 10);
    }

    try {
      const player = new Player(containerRef.current, options);
      playerRef.current = player;

      player.ready().then(() => {
        setIsLoading(false);

        // Restore saved progress. Vimeo rejects a seek that is not strictly
        // less than the duration and raises a player `error` — which would
        // replace the player with the error card on every load, Retry
        // included. A learner who watched to the end stores exactly that, so
        // bound the seek and drop a value the current video can't hold.
        if (storageKey) {
          const savedTime = parseFloat(localStorage.getItem(storageKey) ?? '');
          if (savedTime > 0) {
            player.getDuration().then((duration) => {
              if (savedTime < duration) {
                player.setCurrentTime(savedTime).catch(() => {});
              } else {
                localStorage.removeItem(storageKey);
              }
            }).catch(() => {});
          }
        }
      }).catch((err: Error) => {
        console.error('Vimeo player ready error:', err);
        setError('Failed to load video. Please try again.');
        setIsLoading(false);
      });

      player.on('timeupdate', (data: { percent: number; seconds: number }) => {
        const { percent, seconds } = data;

        onProgress?.(percent);

        // Save progress to localStorage
        if (storageKey) {
          localStorage.setItem(storageKey, seconds.toString());
        }

        // Trigger completion when threshold is reached
        if (
          percent >= completionThreshold &&
          !completionTriggeredRef.current
        ) {
          completionTriggeredRef.current = true;
          onComplete?.();
        }
      });

      player.on('ended', () => {
        if (!completionTriggeredRef.current) {
          completionTriggeredRef.current = true;
          onComplete?.();
        }
      });

      player.on('error', (err: { name: string; message: string }) => {
        console.error('Vimeo player error:', err);
        setError(`Video error: ${err.message || 'An unexpected error occurred.'}`);
      });
    } catch (err) {
      console.error('Vimeo player initialization error:', err);
      setError('Failed to initialize video player.');
      setIsLoading(false);
    }
  }, [videoId, hash, autoplay, muted, storageKey, completionThreshold, onProgress, onComplete]);

  useEffect(() => {
    completionTriggeredRef.current = false;
    initializePlayer();

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy().catch(() => {});
        playerRef.current = null;
      }
    };
  }, [videoId, hash]);

  if (error) {
    return (
      <div className={`aspect-video bg-black rounded-xl flex flex-col items-center justify-center gap-4 ${className ?? ''}`}>
        <p className="text-white/70 text-sm text-center px-4">{error}</p>
        <button
          onClick={handleRetry}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`aspect-video bg-black rounded-xl overflow-hidden relative ${className ?? ''}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
