import { Link } from 'react-router-dom';
import { ArrowLeft, Gamepad2, Share2, Trophy, Monitor, Globe } from 'lucide-react';
import ScrollReveal from '../components/ScrollReveal';
import Placeholder from '../components/Placeholder';

const steps = [
  {
    icon: Gamepad2,
    num: '01',
    title: 'Launch the App',
    desc: "Download and open the Chess App. No account needed — just pick a display name and you're ready.",
  },
  {
    icon: Monitor,
    num: '02',
    title: 'Choose Your Mode',
    desc: 'Start a local hotseat game to play with a friend on the same machine, or create an online room to play remotely.',
  },
  {
    icon: Share2,
    num: '03',
    title: 'Share the Room Code',
    desc: "If playing online, share the generated room code with your friend. They enter it on their end and you're connected instantly.",
  },
  {
    icon: Globe,
    num: '04',
    title: 'Spectate or Jump In',
    desc: 'Browse public games to spectate, or join a match in progress. Every move syncs in real-time with live move highlights.',
  },
  {
    icon: Trophy,
    num: '05',
    title: 'Play & Improve',
    desc: 'Drag pieces to move, use legal-move hints to avoid blunders, and review your move history after the game.',
  },
];

export default function HowToPlayPage() {
  return (
    <div className="pt-24 pb-20 px-6">
      <div className="max-w-4xl mx-auto">
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
          <div className="text-center mb-16">
            <h1 className="text-[clamp(32px,5vw,48px)] font-extrabold tracking-tight mb-4">How to play</h1>
            <p className="text-muted text-lg max-w-xl mx-auto">
              From download to your first checkmate in five simple steps.
            </p>
          </div>
        </ScrollReveal>

        <div className="space-y-12">
          {steps.map((s, i) => (
            // alternate reveal direction and layout per step
            <ScrollReveal key={s.num} variant={i % 2 === 0 ? 'fade-left' : 'fade-right'} delay={i * 0.06}>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
                {/* swap text and image order on alternating rows */}
                <div className={`md:col-span-3 ${i % 2 === 0 ? 'md:order-1' : 'md:order-2'}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-accent/10 text-accent">
                      <s.icon size={20} />
                    </div>
                    <span className="text-xs font-bold text-accent/60 tracking-widest">{s.num}</span>
                  </div>
                  <h2 className="text-xl font-bold mb-2">{s.title}</h2>
                  <p className="text-muted leading-relaxed">{s.desc}</p>
                </div>
                <div className={`md:col-span-2 ${i % 2 === 0 ? 'md:order-2' : 'md:order-1'}`}>
                  <Placeholder label={`Step ${s.num}: ${s.title}`} className="w-full h-36" />
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal variant="fade-up" delay={0.1}>
          <div className="mt-16 text-center p-8 bg-surface border border-border rounded-2xl">
            <h2 className="text-lg font-bold mb-2">Need help?</h2>
            <p className="text-muted text-sm mb-4">Check the FAQ page or open an issue on GitHub.</p>
            <div className="flex gap-3 justify-center">
              <Link
                to="/faq"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold rounded-lg border border-border text-text bg-surface hover:bg-surface-alt transition-all"
              >
                View FAQ
              </Link>
              <a
                href="https://github.com/linuxbeste/chess_electron/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold rounded-lg border border-border text-text bg-surface hover:bg-surface-alt transition-all"
              >
                GitHub Issues
              </a>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
