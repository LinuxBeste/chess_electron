import Placeholder from './Placeholder';

export default function ChessBoard({ size = 280 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size }}>
      <Placeholder label="Chess board screenshot" className="w-full h-full rounded-xl" />
    </div>
  );
}
