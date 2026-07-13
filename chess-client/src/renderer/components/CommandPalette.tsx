import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '../store';
import { t } from '../translate';
import { loadSettings, saveSettings } from '../settings';
import logger from '../logger';

interface Command {
  id: string;
  label: string;
  category: string;
  action: () => void;
}

interface CommandPaletteProps {
  onClose: () => void;
  onOpenSettings?: () => void;
  onOpenHistory?: () => void;
}

export default function CommandPalette({ onClose, onOpenSettings, onOpenHistory }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const playerId = store.get('playerId');
  const isLoggedIn = !!(store.get('token') && store.get('username'));
  const hash = window.location.hash;
  const isOnGamePage = hash.startsWith('#/game/');

  const commands: Command[] = [
    {
      id: 'local',
      label: 'Start Local Game',
      category: 'Create',
      action: () => {
        navigate('/local');
        onClose();
      },
    },
    {
      id: 'newGame',
      label: 'New Game',
      category: 'Create',
      action: () => {
        navigate('/lobby');
        onClose();
      },
    },
    {
      id: 'lobby',
      label: 'Go to Lobby',
      category: 'Navigate',
      action: () => {
        navigate('/lobby');
        onClose();
      },
    },
    {
      id: 'login',
      label: 'Login / Sign In',
      category: 'Navigate',
      action: () => {
        navigate('/login');
        onClose();
      },
    },
    {
      id: 'leaderboard',
      label: t('navbar.leaderboard'),
      category: 'Navigate',
      action: () => {
        navigate('/leaderboard');
        onClose();
      },
    },
    {
      id: 'archive',
      label: t('navbar.archive'),
      category: 'Navigate',
      action: () => {
        navigate('/archive');
        onClose();
      },
    },
    {
      id: 'tournaments',
      label: t('navbar.tournaments'),
      category: 'Navigate',
      action: () => {
        navigate('/tournaments');
        onClose();
      },
    },
    {
      id: 'editor',
      label: t('navbar.editor'),
      category: 'Navigate',
      action: () => {
        navigate('/editor');
        onClose();
      },
    },
    ...(playerId
      ? [
          {
            id: 'profile',
            label: 'My Profile',
            category: 'Navigate',
            action: () => {
              navigate(`/profile/${playerId}`);
              onClose();
            },
          },
        ]
      : []),
    {
      id: 'settings',
      label: t('navbar.settings'),
      category: 'Actions',
      action: () => {
        onClose();
        onOpenSettings?.();
      },
    },
    ...(isLoggedIn
      ? [
          {
            id: 'history',
            label: t('navbar.history'),
            category: 'Actions',
            action: () => {
              onClose();
              onOpenHistory?.();
            },
          },
        ]
      : []),
    {
      id: 'sidebar',
      label: 'Toggle Sidebar',
      category: 'Actions',
      action: () => {
        const open = store.get('sidebarOpen');
        const min = store.get('sidebarMinimized');
        if (!open || min) {
          store.set('sidebarOpen', true);
          store.set('sidebarMinimized', false);
        } else {
          store.set('sidebarOpen', false);
        }
        onClose();
      },
    },
    {
      id: 'sound',
      label: 'Toggle Sound',
      category: 'Actions',
      action: () => {
        const s = loadSettings();
        saveSettings({ ...s, soundEnabled: !s.soundEnabled });
        onClose();
      },
    },
    {
      id: 'compact',
      label: 'Toggle Compact Mode',
      category: 'Actions',
      action: () => {
        const s = loadSettings();
        saveSettings({ ...s, compactMode: !s.compactMode });
        onClose();
      },
    },
    {
      id: 'reload',
      label: 'Reload App',
      category: 'Actions',
      action: () => {
        window.location.reload();
      },
    },
    {
      id: 'logout',
      label: t('navbar.logout'),
      category: 'Actions',
      action: () => {
        store.set('token', null);
        store.set('playerId', null);
        store.set('username', null);
        store.set('avatarUrl', null);
        store.set('offline', false);
        store.clearSession();
        store.set('currentGame', null);
        navigate('/login');
        onClose();
      },
    },
    ...(isOnGamePage
      ? [
          {
            id: 'resign',
            label: t('game.resign'),
            category: 'Game',
            action: () => {
              logger.info('Command: resign');
              onClose();
            },
          },
          {
            id: 'offerDraw',
            label: t('game.offerDraw'),
            category: 'Game',
            action: () => {
              logger.info('Command: offer draw');
              onClose();
            },
          },
          {
            id: 'copyId',
            label: t('common.copyGameId'),
            category: 'Game',
            action: () => {
              onClose();
            },
          },
        ]
      : []),
  ];

  const filtered = query.trim()
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  const grouped = filtered.reduce<{ category: string; items: Command[] }[]>((acc, cmd) => {
    const last = acc[acc.length - 1];
    if (last && last.category === cmd.category) {
      last.items.push(cmd);
    } else {
      acc.push({ category: cmd.category, items: [cmd] });
    }
    return acc;
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const execute = useCallback((cmd: Command) => {
    logger.info('Command executed', { id: cmd.id, label: cmd.label });
    cmd.action();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[activeIndex]) {
      e.preventDefault();
      execute(filtered[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  useEffect(() => {
    const idx = activeIndex;
    const el = listRef.current?.querySelector(`[data-index="${idx}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  let flatIndex = 0;

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-input-wrap">
          <span className="cmd-prompt">&gt;</span>
          <input
            ref={inputRef}
            className="cmd-input"
            type="text"
            placeholder="Type a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
          />
          <span className="cmd-hint">Esc</span>
        </div>
        <div ref={listRef} className="cmd-results">
          {grouped.length === 0 && <div className="cmd-empty">No matching commands</div>}
          {grouped.map((group) => (
            <div key={group.category}>
              <div className="cmd-category">{group.category}</div>
              {group.items.map((cmd) => {
                const idx = flatIndex++;
                return (
                  <div
                    key={cmd.id}
                    data-index={idx}
                    className={`cmd-item ${idx === activeIndex ? 'cmd-active' : ''}`}
                    onClick={() => execute(cmd)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    {cmd.label}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
