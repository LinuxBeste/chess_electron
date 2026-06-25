import { Link } from 'react-router-dom';
import { ArrowLeft, Palette } from 'lucide-react';
import ScrollReveal from '../components/ScrollReveal';
import Placeholder from '../components/Placeholder';

const themes = [
  { name: 'Classic Wood', desc: 'Warm brown squares with traditional carved pieces.', colors: '#b58863 / #f0d9b5' },
  { name: 'Modern Blue', desc: 'Cool blue tones with a clean, minimal look.', colors: '#4a6fa5 / #e8e8e8' },
  { name: 'Grey Minimal', desc: 'Subtle greys for a distraction-free playing experience.', colors: '#888 / #ccc' },
  { name: 'Dark Mode', desc: 'Dark squares optimized for low-light environments.', colors: '#555 / #333' },
  { name: 'Green Felt', desc: 'Green board reminiscent of a real chess table.', colors: '#5a8a5a / #c8d8c8' },
  { name: 'High Contrast', desc: 'Maximum contrast for accessibility and visibility.', colors: '#222 / #eee' },
];

export default function ThemesPage() {
  return (
    <div className="pt-24 pb-20 px-6">
      <div className="max-w-5xl mx-auto">
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
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-accent/10 text-accent mx-auto mb-4">
              <Palette size={28} />
            </div>
            <h1 className="text-[clamp(32px,5vw,48px)] font-extrabold tracking-tight mb-4">Board themes</h1>
            <p className="text-muted text-lg max-w-xl mx-auto">
              Customize the look and feel of your chess board. Choose from six handcrafted themes.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {themes.map((t, i) => (
            // cascading entrance for each theme card
            <ScrollReveal key={t.name} variant="scale-up" delay={i * 0.06}>
              <div className="bg-surface border border-border rounded-2xl overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5">
                <Placeholder label={`${t.name} theme preview`} className="w-full h-40 rounded-none" />
                <div className="p-5">
                  <h3 className="font-semibold mb-1">{t.name}</h3>
                  <p className="text-muted text-sm leading-relaxed mb-3">{t.desc}</p>
                  {/* render color swatches from the paired color string */}
                  <div className="flex gap-1.5">
                    {t.colors.split(' / ').map((c) => (
                      <div key={c} className="w-5 h-5 rounded border border-border" style={{ background: c.trim() }} />
                    ))}
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal variant="fade-up">
          <div className="bg-surface border border-border rounded-2xl p-8 text-center">
            <h2 className="text-xl font-bold mb-2">More coming soon</h2>
            <p className="text-muted text-sm max-w-md mx-auto">
              New themes are added regularly. Have an idea? Open a suggestion on GitHub.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
