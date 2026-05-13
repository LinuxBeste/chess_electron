import { store } from '../store';
import * as api from '../api';
import { navigate } from '../router';
import { el } from '../chess';
import type { GameState } from '../../types';

/* Track current game cards by ID for diff-based updates */
let gameCardMap = new Map<string, HTMLElement>();

export const lobbyView = {
  mount(container: HTMLElement): () => void {
    gameCardMap.clear();

    const wrapper = el('div', [], {
      style: 'display:flex;gap:24px;padding:32px;height:100%;max-width:960px;margin:0 auto',
    });

    /* Left column: open games list */
    const leftCol = el('div', [], {
      style: 'flex:1;display:flex;flex-direction:column',
    });

    const leftHeader = el('h2', [], {
      style: 'font-size:20px;font-weight:700;color:#e0e0e0;letter-spacing:-0.3px;margin-bottom:16px',
    }, 'Open Games');
    leftCol.appendChild(leftHeader);

    const statusEl = el('div', [], {
      style: 'font-size:13px;font-weight:300;color:#888;text-align:center;padding:16px;display:none',
    });
    leftCol.appendChild(statusEl);

    const gameList = el('div', [], {
      style: 'flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:4px',
    });
    leftCol.appendChild(gameList);
    wrapper.appendChild(leftCol);

    /* Right column: create game panel */
    const rightCol = el('div', [], {
      style: 'width:280px;flex-shrink:0',
    });

    const rightCard = el('div', [], {
      style: 'background:#1a1a1f;border-radius:12px;border:1px solid rgba(255,255,255,0.06);box-shadow:0 4px 16px rgba(0,0,0,0.3);padding:24px',
    });
    const rightTitle = el('h2', [], {
      style: 'font-size:20px;font-weight:700;color:#e0e0e0;letter-spacing:-0.3px;margin-bottom:20px',
    }, 'Create Game');
    rightCard.appendChild(rightTitle);

    const createBtn = el('button', [], {
      style: 'width:100%;padding:14px;background:#4f8ef7;color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:500;cursor:pointer;transition:background 150ms ease,transform 150ms ease;letter-spacing:0.3px',
    }, 'New Game');

    createBtn.addEventListener('mouseenter', () => { createBtn.style.background = '#5d9af8'; });
    createBtn.addEventListener('mouseleave', () => { createBtn.style.background = '#4f8ef7'; });
    createBtn.addEventListener('mousedown', () => { createBtn.style.transform = 'scale(0.98)'; });
    createBtn.addEventListener('mouseup', () => { createBtn.style.transform = 'scale(1)'; });

    createBtn.addEventListener('click', async () => {
      try {
        const game = await api.createGame();
        store.set('currentGame', game);
        navigate('game', game.id);
      } catch (err: any) {
        store.toast(err.message || 'Failed to create game');
      }
    });
    rightCard.appendChild(createBtn);

    /* "New Window" button for testing multi-player — opens a second Electron window */
    const newWindowBtn = el('button', [], {
      style: 'margin-top:12px;width:100%;padding:10px;background:transparent;color:#888;border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:color 150ms ease,border-color 150ms ease;letter-spacing:0.3px',
    }, 'New Window');
    newWindowBtn.addEventListener('mouseenter', () => { newWindowBtn.style.color = '#e0e0e0'; newWindowBtn.style.borderColor = 'rgba(255,255,255,0.2)'; });
    newWindowBtn.addEventListener('mouseleave', () => { newWindowBtn.style.color = '#888'; newWindowBtn.style.borderColor = 'rgba(255,255,255,0.1)'; });
    newWindowBtn.addEventListener('click', () => {
      window.electronAPI?.openNewWindow();
    });
    rightCard.appendChild(newWindowBtn);

    rightCol.appendChild(rightCard);
    wrapper.appendChild(rightCol);

    container.appendChild(wrapper);

    /* Poll open games every 3s, diff DOM to avoid full re-render */
    let polling = true;
    let hasGames = false;

    async function poll(): Promise<void> {
      if (!polling) return;
      try {
        const games = await api.getOpenGames();
        hasGames = games.length > 0;
        updateGameList(gameList, games);
        statusEl.style.display = hasGames ? 'none' : 'block';
        statusEl.style.color = '#888';
        statusEl.textContent = 'No open games yet';
      } catch {
        statusEl.style.display = 'block';
        statusEl.style.color = 'rgba(220,80,80,0.7)';
        statusEl.textContent = 'Cannot connect to server';
      }
      if (polling) setTimeout(poll, 3000);
    }

    poll();

    checkActiveGame();

    return () => {
      polling = false;
      gameCardMap.clear();
      wrapper.remove();
    };
  },
};

/* Patch DOM: add new cards, remove stale ones, skip unchanged ones.
   Avoids rebuilding the entire list on every 3s poll. */
function updateGameList(container: HTMLElement, games: GameState[]): void {
  const newIds = new Set(games.map(g => g.id));
  const existingIds = new Set(gameCardMap.keys());

  for (const id of existingIds) {
    if (!newIds.has(id)) {
      const card = gameCardMap.get(id);
      if (card) card.remove();
      gameCardMap.delete(id);
    }
  }

  for (const game of games) {
    const existing = gameCardMap.get(game.id);
    const creatorId = game.players.white;
    const creatorName = creatorId === store.get('playerId') ? 'You' : creatorId?.slice(0, 8) ?? 'Unknown';

    if (existing) {
      const statusBadge = existing.querySelector('.game-status');
      if (statusBadge) {
        statusBadge.textContent = 'Waiting';
      }
    } else {
      const card = createGameCard(game, creatorName);
      gameCardMap.set(game.id, card);
      container.appendChild(card);
    }
  }
}

function createGameCard(game: GameState, creatorName: string): HTMLElement {
  const card = el('div', ['game-card'], {
    'data-game-id': game.id,
    style: 'background:#222228;border-radius:12px;border:1px solid rgba(255,255,255,0.06);box-shadow:0 2px 8px rgba(0,0,0,0.2);padding:16px 20px;display:flex;align-items:center;justify-content:space-between;transition:border-color 150ms ease',
  });

  const leftSection = el('div', [], {
    style: 'display:flex;align-items:center;gap:12px',
  });

  /* Live indicator dot */
  const dot = el('span', ['game-status'], {
    style: 'width:8px;height:8px;border-radius:50%;background:#4f8ef7;animation:pulse 2s ease-in-out infinite;flex-shrink:0',
  });
  leftSection.appendChild(dot);

  const info = el('div', [], {});
  const name = el('span', [], {
    style: 'font-size:15px;font-weight:500;color:#e0e0e0;letter-spacing:0.2px',
  }, creatorName);
  info.appendChild(name);
  const status = el('span', [], {
    style: 'font-size:12px;font-weight:300;color:#888;margin-left:8px;letter-spacing:0.2px',
  }, '· waiting');
  info.appendChild(status);
  leftSection.appendChild(info);
  card.appendChild(leftSection);

  const joinBtn = el('button', [], {
    style: 'padding:8px 18px;background:transparent;color:#4f8ef7;border:1px solid #4f8ef7;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer;transition:background 150ms ease,color 150ms ease;letter-spacing:0.3px',
  }, 'Join');

  joinBtn.addEventListener('mouseenter', () => { joinBtn.style.background = '#4f8ef7'; joinBtn.style.color = '#fff'; });
  joinBtn.addEventListener('mouseleave', () => { joinBtn.style.background = 'transparent'; joinBtn.style.color = '#4f8ef7'; });

  joinBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      const updatedGame = await api.joinGame(game.id);
      store.set('currentGame', updatedGame);
      navigate('game', updatedGame.id);
    } catch (err: any) {
      store.toast(err.message || 'Failed to join game');
    }
  });

  card.appendChild(joinBtn);
  return card;
}

/* If user re-navigates to lobby mid-game, redirect back to game view */
async function checkActiveGame(): Promise<void> {
  try {
    const game = store.get('currentGame');
    if (game && (game.status === 'active' || game.status === 'waiting')) {
      const fresh = await api.getGame(game.id);
      if (fresh.status === 'active' || fresh.status === 'waiting') {
        store.set('currentGame', fresh);
        navigate('game', fresh.id);
      }
    }
  } catch {
    /* Stale game reference — ignore, stay on lobby */
  }
}

/* Inject the pulse animation for the waiting indicator */
const pulseStyle = document.createElement('style');
pulseStyle.textContent = `@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`;
document.head.appendChild(pulseStyle);
