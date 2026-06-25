import { Sword, Sparkles } from 'lucide-react';

export default function Hero() {
  return (
    // full-viewport hero with padding for fixed navbar overlap
    <section className="relative min-h-screen flex items-center justify-center px-6 pt-24 pb-20 text-center">
      <div className="relative max-w-2xl">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-6">
          <Sparkles size={14} />
          Multiplayer desktop chess
        </div>

        <h1 className="text-[clamp(36px,7vw,68px)] font-extrabold tracking-tight leading-tight mb-5 text-text">
          Battle your
          <br />
          <span className="text-accent">friends</span> in chess.
        </h1>

        <p className="text-muted text-lg md:text-xl leading-relaxed mb-8 max-w-lg mx-auto">
          A beautiful desktop app for real-time chess. Challenge your friends, track your games, and enjoy a smooth
          drag-and-drop experience — all built from scratch.
        </p>

        <div className="flex gap-4 flex-wrap justify-center">
          {/* primary CTA links to GitHub releases; secondary scrolls to features */}
          <a
            href="https://github.com/linuxbeste/chess_electron/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3 text-sm font-semibold rounded-xl bg-accent text-white shadow-lg shadow-accent/25 hover:bg-accent-hover transition-all hover:-translate-y-0.5"
          >
            <Sword size={18} />
            Download for Linux
          </a>
          <a
            href="#features"
            className="inline-flex items-center gap-2 px-7 py-3 text-sm font-semibold rounded-xl border border-border text-text bg-surface hover:bg-surface-alt transition-all hover:-translate-y-0.5"
          >
            Learn More
          </a>
        </div>
      </div>
    </section>
  );
}
