import { Users, Palette, Cpu, Download, Gamepad2, Shield } from 'lucide-react';
import ScrollReveal from './ScrollReveal';
import Placeholder from './Placeholder';

const features = [
  {
    icon: Users,
    title: 'Play with Friends',
    desc: 'Create a game, share the room code, and play in real-time. Spectate ongoing matches or jump into a public game.',
  },
  {
    icon: Gamepad2,
    title: 'Drag & Drop Moves',
    desc: 'Click or drag pieces to make your move. Legal hints show you where each piece can go — no more accidental blunders.',
  },
  {
    icon: Palette,
    title: 'Customize Your Board',
    desc: 'Choose from multiple board themes, toggle coordinates, adjust animations, and set your preferred sound volume.',
  },
  {
    icon: Cpu,
    title: 'Full Chess Rules',
    desc: 'Every FIDE rule is implemented: castling, en passant, pawn promotion, checkmate, stalemate, and the 50-move draw rule.',
  },
  {
    icon: Download,
    title: 'Works Offline-ish',
    desc: 'Once downloaded, the desktop app runs on your machine. Start your own server or connect to a friend\'s.',
  },
  {
    icon: Shield,
    title: 'Free & Open Source',
    desc: 'No ads, no subscriptions, no tracking. The full source is on GitHub — MIT licensed.',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 md:py-32 px-6">
      <div className="max-w-5xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-16">
            <h2 className="text-[clamp(28px,4vw,40px)] font-bold tracking-tight mb-3">
              Everything you need to play
            </h2>
            <p className="text-muted text-lg max-w-lg mx-auto">
              Designed for casual games with friends — no account needed, no hassle.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <ScrollReveal key={f.title} variant="scale-up" delay={i * 0.05}>
              <div className="bg-surface border border-border rounded-xl p-7 transition-all hover:shadow-md hover:-translate-y-0.5">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-accent/10 text-accent mb-4">
                  <f.icon size={20} />
                </div>
                <h3 className="text-base font-semibold mb-1.5">{f.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{f.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal variant="zoom-in" delay={0.3}>
          <div className="mt-14 max-w-3xl mx-auto">
            <Placeholder label="App screenshot" className="w-full h-56 md:h-72 rounded-xl" />
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
