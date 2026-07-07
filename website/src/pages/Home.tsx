import { Sword, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import HowItWorks from '../components/HowItWorks';
import Stats from '../components/Stats';
import Features from '../components/Features';
import GameModes from '../components/GameModes';
import Releases from '../components/Releases';
import AppPreview from '../components/AppPreview';
import ScrollReveal from '../components/ScrollReveal';

// Home page: hero, how-it-works, features, game modes, and stats
export default function Home() {
  return (
    <>
      {/* full-viewport hero section */}
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
            Where every move matters. Challenge your friends, track your games, and experience smooth drag-and-drop
            chess — all in a beautiful desktop app.
          </p>

          <div className="flex gap-4 flex-wrap justify-center mb-14">
            <Link
              to="/download"
              className="inline-flex items-center gap-2 px-7 py-3 text-sm font-semibold rounded-xl bg-accent text-white shadow-lg shadow-accent/25 hover:bg-accent-hover transition-all hover:-translate-y-0.5"
            >
              <Sword size={18} />
              Download for Linux
            </Link>
            <Link
              to="/features"
              className="inline-flex items-center gap-2 px-7 py-3 text-sm font-semibold rounded-xl border border-border text-text bg-surface hover:bg-surface-alt transition-all hover:-translate-y-0.5"
            >
              Explore Features
            </Link>
          </div>

          <ScrollReveal variant="scale-up">
            <div className="flex justify-center">
              <AppPreview />
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* compose landing page from independent sections */}
      <HowItWorks />
      <Stats />
      <Features />
      <GameModes />
      <Releases />
    </>
  );
}
