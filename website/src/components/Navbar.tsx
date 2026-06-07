import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Github, Download, Moon, Sun } from 'lucide-react';

interface Props {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const links = [
  { to: '/features', label: 'Features' },
  { to: '/themes', label: 'Themes' },
  { to: '/how-to-play', label: 'How to Play' },
  { to: '/download', label: 'Download' },
  { to: '/faq', label: 'FAQ' },
];

export default function Navbar({ theme, onToggleTheme }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isHome = location.pathname === '/';

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-8 h-16 transition-all duration-300 ${
        scrolled ? 'bg-bg/90 border-b border-border backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <Link to="/" className="text-lg font-bold text-text tracking-tight flex items-center gap-3">
        <span>
          <span className="text-accent mr-0.5">♚</span> Chess
        </span>
        <span className="text-xs font-normal text-muted hidden sm:inline">Where every move matters.</span>
      </Link>
      <nav className="flex items-center gap-3 md:gap-5">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="text-muted text-sm font-medium hover:text-text transition-colors max-md:hidden"
          >
            {link.label}
          </Link>
        ))}
        {isHome && (
          <a
            href="#features"
            className="text-muted text-sm font-medium hover:text-text transition-colors max-sm:hidden"
          >
            Overview
          </a>
        )}
        <button
          onClick={onToggleTheme}
          className="flex items-center justify-center w-9 h-9 rounded-lg text-muted hover:text-text hover:bg-surface border border-border transition-all"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <a
          href="https://github.com/linuxbeste/chess_electron"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-9 h-9 rounded-lg text-muted hover:text-text hover:bg-surface border border-border transition-all"
        >
          <Github size={17} />
        </a>
        <Link
          to="/download"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover transition-all hover:-translate-y-0.5"
        >
          <Download size={15} />
          <span className="max-sm:hidden">Download</span>
        </Link>
      </nav>
    </header>
  );
}
