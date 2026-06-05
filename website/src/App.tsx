import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import BackgroundPieces from './components/BackgroundPieces';
import Home from './pages/Home';
import FeaturesPage from './pages/FeaturesPage';
import HowToPlayPage from './pages/HowToPlayPage';
import ThemesPage from './pages/ThemesPage';
import FaqPage from './pages/FaqPage';
import DownloadPage from './pages/DownloadPage';

type Theme = 'light' | 'dark';

function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-[3px] bg-transparent">
      <div
        className="h-full bg-accent transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));

  return (
    <BrowserRouter>
      <div className="bg-bg text-text min-h-screen relative">
        <ScrollProgress />
        <BackgroundPieces />
        <div className="relative z-10">
          <Routes>
            <Route path="/" element={<Layout theme={theme} onToggleTheme={toggleTheme}><Home /></Layout>} />
            <Route path="/features" element={<Layout theme={theme} onToggleTheme={toggleTheme}><FeaturesPage /></Layout>} />
            <Route path="/how-to-play" element={<Layout theme={theme} onToggleTheme={toggleTheme}><HowToPlayPage /></Layout>} />
            <Route path="/themes" element={<Layout theme={theme} onToggleTheme={toggleTheme}><ThemesPage /></Layout>} />
            <Route path="/faq" element={<Layout theme={theme} onToggleTheme={toggleTheme}><FaqPage /></Layout>} />
            <Route path="/download" element={<Layout theme={theme} onToggleTheme={toggleTheme}><DownloadPage /></Layout>} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
