import { useNavigate } from 'react-router-dom';

// 404 page with decorative chess board layout
const START_POSITION = [
  '♜',
  '♞',
  '♝',
  '♛',
  '♚',
  '♝',
  '♞',
  '♜',
  '♟',
  '♟',
  '♟',
  '♟',
  '♟',
  '♟',
  '♟',
  '♟',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '♙',
  '♙',
  '♙',
  '♙',
  '♙',
  '♙',
  '♙',
  '♙',
  '♖',
  '♘',
  '♗',
  '♕',
  '♔',
  '♗',
  '♘',
  '♖',
];

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div
      className="page-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: 32,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 32px)',
          gridTemplateRows: 'repeat(8, 32px)',
          border: '2px solid var(--sq-dark)',
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
          animation: 'fadeInUp 500ms ease',
        }}
      >
        {START_POSITION.map((piece, i) => {
          const r = Math.floor(i / 8);
          const c = i % 8;
          const isLight = (r + c) % 2 === 0;
          return (
            <div
              key={i}
              style={{
                background: isLight ? 'var(--sq-light)' : 'var(--sq-dark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                color: r < 2 ? '#222' : '#fff',
                textShadow: r < 2 ? '0 1px 1px rgba(255,255,255,0.2)' : '0 1px 1px rgba(0,0,0,0.3)',
              }}
            >
              {piece}
            </div>
          );
        })}
      </div>
      <h1
        style={{
          fontSize: 72,
          fontWeight: 800,
          letterSpacing: -3,
          color: 'var(--accent)',
          margin: 0,
          lineHeight: 1,
          animation: 'glow 2s ease-in-out infinite, fadeInUp 400ms ease 300ms both',
        }}
      >
        404
      </h1>
      <p style={{ fontSize: 16, color: 'var(--muted)', margin: 0, animation: 'fadeInUp 400ms ease 500ms both' }}>
        This page is out of bounds
      </p>
      <button
        className="btn btn-primary"
        onClick={() => navigate('/lobby')}
        style={{ animation: 'fadeInUp 400ms ease 700ms both' }}
      >
        ← Back to lobby
      </button>
    </div>
  );
}
