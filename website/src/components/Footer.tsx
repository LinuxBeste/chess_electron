import { Github, Heart } from 'lucide-react';
import ScrollReveal from './ScrollReveal';

export default function Footer() {
  return (
    <footer className="py-10 px-6 text-center border-t border-border">
      <ScrollReveal variant="fade-up">
        <div className="flex gap-6 justify-center mb-3">
          <a
            href="https://github.com/linuxbeste/chess_electron"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted text-sm hover:text-text transition-colors inline-flex items-center gap-1.5"
          >
            <Github size={14} /> GitHub
          </a>
          <a
            href="https://github.com/linuxbeste/chess_electron/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted text-sm hover:text-text transition-colors"
          >
            Releases
          </a>
          <a href="#features" className="text-muted text-sm hover:text-text transition-colors">
            Features
          </a>
        </div>
        <p className="text-muted text-xs flex items-center justify-center gap-1">
          Built with <Heart size={12} className="text-red-400" /> &mdash; MIT License
        </p>
      </ScrollReveal>
    </footer>
  );
}
