import { Download, Github, ExternalLink } from 'lucide-react';
import ScrollReveal from './ScrollReveal';
import Placeholder from './Placeholder';

const platforms = [
  { name: 'Linux', format: '.AppImage / .deb', icon: '🐧' },
  { name: 'macOS', format: '.dmg', icon: '🍎' },
  { name: 'Windows', format: '.exe (NSIS)', icon: '🪟' },
];

export default function Releases() {
  return (
    <section id="download" className="py-24 md:py-32 px-6 bg-surface-alt/50">
      <div className="max-w-4xl mx-auto text-center">
        <ScrollReveal>
          <h2 className="text-[clamp(28px,4vw,40px)] font-bold tracking-tight mb-3">
            Ready to play?
          </h2>
          <p className="text-muted text-lg max-w-lg mx-auto mb-10">
            Download the app for your platform and start challenging your friends.
          </p>

          <Placeholder label="App screenshot" className="w-full max-w-lg h-56 mx-auto mb-10" />
        </ScrollReveal>

        <ScrollReveal>
          <div className="flex flex-wrap gap-4 justify-center mb-12">
            <a
              href="https://github.com/linuxbeste/chess_electron/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-8 py-3.5 text-base font-semibold rounded-xl bg-accent text-white shadow-lg shadow-accent/20 hover:bg-accent-hover transition-all hover:-translate-y-0.5"
            >
              <Download size={20} />
              Download Latest Release
            </a>
            <a
              href="https://github.com/linuxbeste/chess_electron"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold rounded-xl border border-border text-text bg-surface hover:bg-surface-alt transition-all hover:-translate-y-0.5"
            >
              <Github size={20} />
              Source Code
            </a>
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fade-up" delay={0.15}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto">
            {platforms.map((p) => (
              <div key={p.name} className="bg-surface border border-border rounded-xl px-5 py-4 text-center">
                <div className="text-xl mb-1">{p.icon}</div>
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="text-muted text-xs">{p.format}</div>
              </div>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.25}>
          <div className="mt-8">
            <a
              href="https://github.com/linuxbeste/chess_electron/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover transition-colors"
            >
              See all releases <ExternalLink size={14} />
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
