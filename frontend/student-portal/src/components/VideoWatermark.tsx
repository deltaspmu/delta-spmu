import { cn } from '@/lib/utils';

interface VideoWatermarkProps {
  email: string;
  className?: string;
}

export default function VideoWatermark({ email, className }: VideoWatermarkProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 pointer-events-none select-none overflow-hidden z-10',
        className
      )}
    >
      <span className="absolute top-4 right-4 text-white/20 text-sm -rotate-12">
        {email}
      </span>
      <span className="absolute bottom-4 left-4 text-white/20 text-sm -rotate-12">
        {email}
      </span>
    </div>
  );
}
