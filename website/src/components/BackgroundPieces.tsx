const CHARS = ['♜', '♞', '♝', '♛', '♚', '♖', '♘', '♗', '♕', '♔', '♟', '♙'];

interface Piece {
  char: string;
  left: string;
  top: string;
  size: string;
  anim: string;
  opacity: string;
}

const pieces: Piece[] = [];

// inclusive random integer helper
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// size doubles as opacity range — larger = more visible
const sizes = [
  { class: 'text-3xl md:text-5xl', range: [30, 50] },
  { class: 'text-4xl md:text-6xl', range: [50, 70] },
  { class: 'text-5xl md:text-7xl', range: [70, 90] },
  { class: 'text-6xl md:text-8xl', range: [90, 110] },
];

const anims = ['animate-float', 'animate-float-delayed', 'animate-float-slow'];

// generate static set of floating pieces — deterministic per render
for (let i = 0; i < 30; i++) {
  const sizeObj = sizes[rand(0, sizes.length - 1)];
  pieces.push({
    char: CHARS[rand(0, CHARS.length - 1)],
    left: `${rand(1, 96)}%`,
    top: `${rand(2, 94)}%`,
    size: sizeObj.class,
    anim: anims[rand(0, anims.length - 1)],
    // lower bound of range → opacity (e.g. 30 → 0.3)
    opacity: `${sizeObj.range[0] / 100}`,
  });
}

export default function BackgroundPieces() {
  return (
    // decorative layer — invisible to screen readers and interactions
    <div className="fixed inset-0 z-0 pointer-events-none select-none overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <div
          key={i}
          className={`absolute ${p.size} ${p.anim} text-text`}
          style={{
            left: p.left,
            top: p.top,
            opacity: p.opacity,
          }}
        >
          {p.char}
        </div>
      ))}
    </div>
  );
}
