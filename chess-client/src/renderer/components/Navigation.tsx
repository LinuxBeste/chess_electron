import { useLayoutEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStoreValue } from '../hooks/useStore';
import { store } from '../store';
import { t } from '../translate';
import { Swords, Trophy, Archive, Award, PenLine, ChevronLeft, ChevronRight } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/lobby', icon: Swords, labelKey: 'navbar.play' as const },
  { path: '/leaderboard', icon: Trophy, labelKey: 'navbar.leaderboard' as const },
  { path: '/archive', icon: Archive, labelKey: 'navbar.archive' as const },
  { path: '/tournaments', icon: Award, labelKey: 'navbar.tournaments' as const },
  { path: '/editor', icon: PenLine, labelKey: 'navbar.editor' as const },
];

function updateNavPush(open: boolean, minimized: boolean) {
  let width: string;
  if (!open) {
    width = '0px';
  } else if (minimized) {
    width = '44px';
  } else {
    width = '160px';
  }
  document.documentElement.style.setProperty('--nav-push-left', width);
}

updateNavPush(store.get('navOpen'), store.get('navMinimized'));

export default function Navigation() {
  const navOpen = useStoreValue('navOpen');
  const navMinimized = useStoreValue('navMinimized');
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  useLayoutEffect(() => {
    updateNavPush(navOpen, navMinimized);
  }, [navOpen, navMinimized]);

  if (!navOpen) return null;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 900;

  if (navMinimized) {
    return (
      <div className={`nav-panel nav-minimized ${isMobile ? 'nav-mobile' : ''}`}>
        <button
          className="nav-item nav-expand-btn nav-expand-top"
          onClick={() => store.set('navMinimized', false)}
          title="Expand"
        >
          <ChevronRight size={16} />
        </button>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path;
          return (
            <button
              key={item.path}
              className={`nav-item ${isActive ? 'nav-active' : ''}`}
              onClick={() => navigate(item.path)}
              title={t(item.labelKey)}
            >
              <Icon size={18} />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`nav-panel ${isMobile ? 'nav-mobile' : ''}`}>
      <div className="nav-inner">
        <div className="nav-header">
          <button className="nav-minimize-btn" onClick={() => store.set('navMinimized', true)} title="Minimize">
            <ChevronLeft size={14} />
          </button>
        </div>
        <div className="nav-items">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.path}
                className={`nav-item ${isActive ? 'nav-active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <Icon size={16} />
                <span>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
