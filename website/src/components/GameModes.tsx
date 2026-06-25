import { Monitor, Globe } from 'lucide-react';
import ScrollReveal from './ScrollReveal';
import Placeholder from './Placeholder';

const modes = [
  {
    icon: Monitor,
    title: 'Local Hotseat',
    desc: 'Pass the keyboard back and forth. Play with a friend on the same machine — just like the old days.',
    highlight: 'Perfect for couch gaming',
    img: 'Local hotseat screenshot',
  },
  {
    icon: Globe,
    title: 'Online Multiplayer',
    desc: 'Create a room and share the code. Your friend joins from anywhere in the world. Real-time sync, zero lag.',
    highlight: 'Play across the globe',
    img: 'Online lobby screenshot',
  },
];

export default function GameModes() {
  return (
    <section className="py-24 md:py-32 px-6 bg-surface/50">
      <div className="max-w-3xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-16">
            <h2 className="text-[clamp(28px,4vw,40px)] font-bold tracking-tight mb-3">Two ways to play</h2>
            <p className="text-muted text-lg max-w-lg mx-auto">
              Whether you&apos;re in the same room or across the globe.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modes.map((m, i) => (
            // first card slides from left, second from right
            <ScrollReveal key={m.title} variant={i === 0 ? 'fade-left' : 'fade-right'} delay={i * 0.1}>
              {/* remove default rounding on Placeholder for seamless image */}
              <div className="bg-surface border border-border rounded-2xl overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1">
                <Placeholder label={m.img} className="w-full h-44 rounded-none" />
                <div className="p-8">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-accent/10 text-accent mb-5">
                    <m.icon size={24} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{m.title}</h3>
                  <p className="text-muted text-sm leading-relaxed mb-4">{m.desc}</p>
                  <span className="inline-block text-xs font-semibold text-accent bg-accent/10 px-3 py-1 rounded-full">
                    {m.highlight}
                  </span>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
