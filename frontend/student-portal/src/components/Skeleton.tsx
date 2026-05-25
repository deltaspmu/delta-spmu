interface SkeletonBaseProps {
  className?: string;
}

interface SkeletonLineProps extends SkeletonBaseProps {
  width?: string;
  height?: string;
}

interface SkeletonCircleProps extends SkeletonBaseProps {
  size?: string;
}

interface SkeletonTextProps extends SkeletonBaseProps {
  lines?: number;
}

const pulse = 'animate-pulse bg-gray-200 rounded';

export function SkeletonLine({ width = '100%', height = '1rem', className = '' }: SkeletonLineProps) {
  return <div className={`${pulse} ${className}`} style={{ width, height }} />;
}

export function SkeletonCircle({ size = '3rem', className = '' }: SkeletonCircleProps) {
  return <div className={`${pulse} rounded-full ${className}`} style={{ width: size, height: size }} />;
}

export function SkeletonCard({ className = '' }: SkeletonBaseProps) {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-white p-4 ${className}`}>
      <div className={`${pulse} mb-4 h-40 w-full rounded-xl`} />
      <SkeletonLine width="70%" height="1.25rem" className="mb-2" />
      <SkeletonLine width="90%" className="mb-2" />
      <SkeletonLine width="50%" />
    </div>
  );
}

export function SkeletonText({ lines = 3, className = '' }: SkeletonTextProps) {
  const widths = ['100%', '92%', '80%', '95%', '60%'];
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLine key={i} width={widths[i % widths.length]} />
      ))}
    </div>
  );
}
