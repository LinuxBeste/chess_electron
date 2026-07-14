import { useEffect, useRef } from 'react';
import { store } from '../store';
import { loadSettings, saveSettings } from '../settings';

/**
 * useKeyboardShortcuts — global keyboard shortcut handler.
 *
 * Handles single-key shortcuts (F, ?, arrows) and G+letter sequences.
 * Dispatches custom events on window for page-level consumers:
 *   - 'shortcut:flipBoard'
 *   - 'shortcut:prevMove'
 *   - 'shortcut:nextMove'
 *   - 'shortcut:startReview'
 *   - 'shortcut:endReview'
 *
 * Ignores keystrokes when focus is inside an input, textarea, or select.
 */

const INPUT_SELECTOR = 'input, textarea, select, [contenteditable]';

/* G+letter sequences that we recognise — maps the second key to a handler */
const G_SEQUENCES: Record<string, () => void> = {
  s: () => store.set('sidebarOpen', !store.get('sidebarOpen')),
  u: () => {
    const s = loadSettings();
    s.soundEnabled = !s.soundEnabled;
    saveSettings(s);
  },
  r: () => location.reload(),
  h: () => {
    window.dispatchEvent(new CustomEvent('shortcut:goHome'));
  },
  p: () => {
    window.dispatchEvent(new CustomEvent('shortcut:goPlay'));
  },
  f: () => {
    window.dispatchEvent(new CustomEvent('shortcut:goFriends'));
  },
  n: () => {
    window.dispatchEvent(new CustomEvent('shortcut:newGame'));
  },
  d: () => {
    window.dispatchEvent(new CustomEvent('shortcut:offerDraw'));
  },
  c: () => {
    window.dispatchEvent(new CustomEvent('shortcut:toggleChat'));
  },
};

export function useKeyboardShortcuts() {
  const gPendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      /* Ignore when user is typing in an input/textarea */
      if ((e.target as HTMLElement).closest(INPUT_SELECTOR)) return;

      /* ── Single-key shortcuts ── */
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        /* Open command palette — dispatch Ctrl+K to Navbar */
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
        return;
      }

      /* F — flip board (only on game page) */
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('shortcut:flipBoard'));
        return;
      }

      /* Arrow keys — move review (only on game page) */
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('shortcut:prevMove'));
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('shortcut:nextMove'));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('shortcut:startReview'));
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('shortcut:endReview'));
        return;
      }

      /* ── G+letter sequences ── */
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (gPendingRef.current) clearTimeout(gPendingRef.current);
        gPendingRef.current = setTimeout(() => {
          gPendingRef.current = null;
        }, 500);
        return;
      }

      if (gPendingRef.current) {
        const key = e.key.toLowerCase();
        if (key in G_SEQUENCES) {
          e.preventDefault();
          clearTimeout(gPendingRef.current);
          gPendingRef.current = null;
          G_SEQUENCES[key]();
          return;
        }
        /* If the second key doesn't match a sequence, cancel the pending G */
        clearTimeout(gPendingRef.current);
        gPendingRef.current = null;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
