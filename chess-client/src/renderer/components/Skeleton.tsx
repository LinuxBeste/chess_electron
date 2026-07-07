interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

// Generic shimmer placeholder for loading states
export function Skeleton({ width = '100%', height = 16, borderRadius = 'var(--radius-sm)', style }: SkeletonProps) {
  return <div className="shimmer" style={{ width, height, borderRadius, ...style }} />;
}

// Skeleton line for text placeholder
export function SkeletonLine({ width = '100%', style }: { width?: string | number; style?: React.CSSProperties }) {
  return <div className="shimmer shimmer-line" style={{ width, ...style }} />;
}

// Circular skeleton for avatar loading
export function SkeletonAvatar({ size = 80 }: { size?: number }) {
  return <div className="shimmer" style={{ width: size, height: size, borderRadius: '50%', margin: '0 auto 12px' }} />;
}

// Card-shaped skeleton placeholder
export function SkeletonCard({
  width = 280,
  height = 120,
  style,
}: {
  width?: string | number;
  height?: number;
  style?: React.CSSProperties;
}) {
  return <div className="shimmer" style={{ width, height, borderRadius: 'var(--radius)', ...style }} />;
}

// Full chess board skeleton for page loading
export function SkeletonBoard() {
  return (
    <div className="skeleton-page">
      <div
        className="shimmer skeleton-board"
        style={{ width: 'min(75vh, calc(100vw - 300px), 700px)', aspectRatio: '1', borderRadius: 'var(--radius)' }}
      />
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <Skeleton width={100} height={32} borderRadius="var(--radius-sm)" />
        <Skeleton width={100} height={32} borderRadius="var(--radius-sm)" />
      </div>
    </div>
  );
}

// Lobby page skeleton placeholder
export function SkeletonLobby() {
  return (
    <div className="page-container" style={{ padding: 24, display: 'flex', gap: 24, flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <SkeletonCard width={200} height={160} />
        <SkeletonCard width={200} height={160} />
        <SkeletonCard width={200} height={160} />
      </div>
      <SkeletonCard width="100%" height={200} />
    </div>
  );
}
