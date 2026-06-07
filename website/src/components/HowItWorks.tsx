import { Swords, Share2, Trophy } from 'lucide-react';
import ScrollReveal from './ScrollReveal';
import Placeholder from './Placeholder';

const steps = [
  {
    icon: Swords,
    num: '01',
    title: 'Create or Join a Game',
    desc: "Start a new match or hop into a public one. No sign-up required — just a name and you're in.",
    img: 'Create game screen',
  },
  {
    icon: Share2,
    num: '02',
    title: 'Share the Room Code',
    desc: "Give your friend the room code. They enter it on their end and you're connected — no sign-up, no hassle.",
    img: 'Room code dialog',
  },
  {
    icon: Trophy,
    num: '03',
    title: 'Play & Conquer',
    desc: 'Drag pieces, chat with your opponent, and claim your victory. Every move syncs in real-time.',
    img: 'In-game board screenshot',
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 md:py-32 px-6">
      <div className="max-w-5xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-16">
            <h2 className="text-[clamp(28px,4vw,40px)] font-bold tracking-tight mb-3">How it works</h2>
            <p className="text-muted text-lg max-w-lg mx-auto">From zero to game in under a minute.</p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((s, i) => (
            <ScrollReveal
              key={s.title}
              variant={i === 0 ? 'fade-left' : i === 2 ? 'fade-right' : 'fade-up'}
              delay={i * 0.12}
            >
              <div className="text-center">
                <Placeholder label={s.img} className="w-full h-40 mb-5" />
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-accent/10 text-accent mx-auto mb-4">
                  <s.icon size={26} />
                </div>
                <span className="text-xs font-bold text-accent/60 tracking-widest">{s.num}</span>
                <h3 className="text-lg font-semibold mt-1 mb-2">{s.title}</h3>
                <p className="text-muted text-sm leading-relaxed max-w-xs mx-auto">{s.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
