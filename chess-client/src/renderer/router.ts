/**
 * Hash-based view router.
 *
 * Each view exports a `mount(container: HTMLElement): () => void` function
 * that builds its DOM and returns an unmount/cleanup function.  The router
 * calls unmount on the previous view before mounting the next, preventing
 * event listener leaks and DOM accumulation.
 *
 * Route map:
 *   #login  → login view
 *   #lobby  → lobby view
 *   #game   → game view
 *   #result → result view
 */

import type { ViewName } from '../types';
import { store } from './store';

/** A view module: mount returns an unmount function */
interface View {
  mount(container: HTMLElement): () => void;
}

type ViewMap = Record<ViewName, View>;

/** Currently mounted view's cleanup function */
let currentCleanup: (() => void) | null = null;

/** The global app container element */
let appContainer: HTMLElement | null = null;

/**
 * Map view names to their route hash patterns.
 * #login and #lobby match exact hashes.
 * #game and #result support params: #game/<gameId>, #result/<gameId>
 */
export function getViewFromHash(): { view: ViewName; params: Record<string, string> } {
  const hash = window.location.hash.slice(1).toLowerCase();

  if (hash.startsWith('game/')) {
    return { view: 'game', params: { gameId: hash.slice(5) } };
  }
  if (hash.startsWith('result/')) {
    return { view: 'result', params: { gameId: hash.slice(7) } };
  }
  if (hash === 'lobby') return { view: 'lobby', params: {} };
  if (hash === 'result') return { view: 'result', params: {} };

  return { view: 'login', params: {} };
}

/**
 * Navigate to a view by name, optionally with a parameter.
 * Sets the hash and triggers routing via the hashchange event.
 */
export function navigate(view: ViewName, param?: string): void {
  let hash = `#${view}`;
  if (param) hash += `/${param}`;
  window.location.hash = hash;
}

/**
 * Initialize the router with the app container and view map.
 * Listens for hashchange events and routes accordingly.
 */
export function initRouter(container: HTMLElement, views: ViewMap): void {
  appContainer = container;

  /**
   * Route to the current hash: unmount the old view, mount the new one,
   * and track its cleanup function.  All view mounting/unmounting goes
   * through this function.
   */
  function route(): void {
    if (currentCleanup) {
      currentCleanup();
      currentCleanup = null;
    }

    const { view, params } = getViewFromHash();
    store.set('currentView', view);

    /* Clear the container before mounting the new view */
    container.innerHTML = '';

    const viewModule = views[view];
    if (!viewModule) {
      navigate('login');
      return;
    }

    currentCleanup = viewModule.mount(container);
  }

  window.addEventListener('hashchange', route);

  /* Initial route based on current hash */
  route();
}
