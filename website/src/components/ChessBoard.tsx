import Placeholder from './Placeholder';

// fallback size matches preview container width
export default function ChessBoard({ size = 280 }: { size?: number }) {
  return (
    {/* lock container to exact pixel size for consistent preview */}
    <div style={{ width: size, height: size }}>
      <Placeholder label="Chess board screenshot" className="w-full h-full rounded-xl" />
    </div>
  );
}
