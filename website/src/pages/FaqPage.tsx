import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import ScrollReveal from '../components/ScrollReveal';

const faqs = [
  {
    q: 'Is the app free?',
    a: 'Yes, completely free. No ads, no subscriptions, no tracking. The source code is MIT licensed, so you can even modify and redistribute it.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. Just pick a display name when you start the app. No email, no password, no sign-up required.',
  },
  {
    q: 'How do I play with a friend online?',
    a: "Create a new online room from the main menu. Share the generated room code with your friend. They enter the code on their end and you're connected immediately.",
  },
  {
    q: 'Can I play on the same computer?',
    a: 'Yes. The local hotseat mode lets two players take turns on the same machine. Perfect for couch gaming.',
  },
  {
    q: 'Does the app work on my operating system?',
    a: 'The app supports Linux (AppImage/.deb), macOS (.dmg), and Windows (.exe). See the download page for the latest builds.',
  },
  {
    q: 'Is there a bot opponent?',
    a: 'Yes! You can play against the Stockfish engine at various difficulty levels. Select "Play vs Bot" in the lobby and choose your preferred difficulty and color.',
  },
  {
    q: 'Can I change the board appearance?',
    a: 'Yes. The app includes multiple board themes, piece sets, and display options. Toggle coordinates, adjust animation speed, and control sound volume from the settings menu.',
  },
  {
    q: 'How do I report a bug or suggest a feature?',
    a: 'Open an issue on the GitHub repository. Bug reports with steps to reproduce are especially helpful.',
  },
  {
    q: 'Is there a mobile version?',
    a: 'Currently the app is desktop-only. A web-based spectator mode is planned.',
  },
  {
    q: 'Are all chess rules implemented?',
    a: 'Yes. Castling, en passant, pawn promotion, checkmate, stalemate, threefold repetition, and the 50-move rule are all implemented according to FIDE standards.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-text hover:bg-surface-alt transition-colors"
      >
        {q}
        <ChevronDown
          size={16}
          className={`text-muted shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="px-5 pb-4 text-sm text-muted leading-relaxed">{a}</div>}
    </div>
  );
}

export default function FaqPage() {
  return (
    <div className="pt-24 pb-20 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-12">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors"
          >
            <ArrowLeft size={14} />
            Back to home
          </Link>
        </div>

        <ScrollReveal>
          <div className="text-center mb-12">
            <h1 className="text-[clamp(32px,5vw,48px)] font-extrabold tracking-tight mb-4">FAQ</h1>
            <p className="text-muted text-lg max-w-lg mx-auto">Questions? We&apos;ve got answers.</p>
          </div>
        </ScrollReveal>

        <div className="space-y-3">
          {faqs.map((f, i) => (
            <ScrollReveal key={f.q} variant="fade-up" delay={i * 0.03}>
              <FaqItem q={f.q} a={f.a} />
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal variant="fade-up" delay={0.1}>
          <div className="mt-12 text-center p-8 bg-surface border border-border rounded-2xl">
            <h2 className="font-bold mb-1">Still have questions?</h2>
            <p className="text-muted text-sm mb-4">Open an issue on GitHub and we&apos;ll help you out.</p>
            <a
              href="https://github.com/linuxbeste/chess_electron/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold rounded-lg border border-border text-text bg-surface hover:bg-surface-alt transition-all"
            >
              Ask on GitHub
            </a>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
