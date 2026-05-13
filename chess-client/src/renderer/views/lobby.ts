import { store } from '../store';
import * as api from '../api';
import { navigate } from '../router';
import { el } from '../chess';
import type { GameState } from '../../types';

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

    /* Right column: panels */
    const rightCol = el('div', [], {
      style: 'width:280px;flex-shrink:0;display:flex;flex-direction:column;gap:16px',
    });

    /* ─── Create Game card ─── */
    const createCard = el('div', [], {
      style: 'background:#1a1a1f;border-radius:12px;border:1px solid rgba(255,255,255,0.06);box-shadow:0 4px 16px rgba(0,0,0,0.3);padding:24px',
    });
    const createTitle = el('h2', [], {
      style: 'font-size:20px;font-weight:700;color:#e0e0e0;letter-spacing:-0.3px;margin-bottom:20px',
    }, 'Create Game');
    createCard.appendChild(createTitle);

    /* Visibility toggle */
    const toggleRow = el('div', [], {
      style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px',
    });
    const toggleLabel = el('span', [], {
      style: 'font-size:13px;font-weight:400;color:#888;letter-spacing:0.2px',
    }, 'Private game');
    const toggle = el('div', [], {
      style: 'width:40px;height:22px;border-radius:11px;background:#333;cursor:pointer;position:relative;transition:background 150ms ease',
    });
    const toggleKnob = el('div', [], {
      style: 'width:18px;height:18px;border-radius:50%;background:#888;position:absolute;top:2px;left:2px;transition:all 150ms ease',
    });
    let isPrivate = false;
    toggle.appendChild(toggleKnob);
    toggle.addEventListener('click', () => {
      isPrivate = !isPrivate;
      toggle.style.background = isPrivate ? '#4f8ef7' : '#333';
      toggleKnob.style.left = isPrivate ? '20px' : '2px';
      toggleKnob.style.background = isPrivate ? '#fff' : '#888';
    });
    toggleRow.appendChild(toggleLabel);
    toggleRow.appendChild(toggle);
    createCard.appendChild(toggleRow);

    const createBtn = el('button', [], {
      style: 'width:100%;padding:14px;background:#4f8ef7;color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:500;cursor:pointer;transition:background 150ms ease,transform 150ms ease;letter-spacing:0.3px',
    }, 'New Game');

    createBtn.addEventListener('mouseenter', () => { createBtn.style.background = '#5d9af8'; });
    createBtn.addEventListener('mouseleave', () => { createBtn.style.background = '#4f8ef7'; });
    createBtn.addEventListener('mousedown', () => { createBtn.style.transform = 'scale(0.98)'; });
    createBtn.addEventListener('mouseup', () => { createBtn.style.transform = 'scale(1)'; });

    createBtn.addEventListener('click', async () => {
      try {
        const game = await api.createGame(isPrivate ? 'private' : 'public');
        store.set('currentGame', game);
        navigate('game', game.id);
      } catch (err: any) {
        store.toast(err.message || 'Failed to create game');
      }
    });
    createCard.appendChild(createBtn);

    const newWindowBtn = el('button', [], {
      style: 'margin-top:12px;width:100%;padding:10px;background:transparent;color:#888;border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:color 150ms ease,border-color 150ms ease;letter-spacing:0.3px',
    }, 'New Window');
    newWindowBtn.addEventListener('mouseenter', () => { newWindowBtn.style.color = '#e0e0e0'; newWindowBtn.style.borderColor = 'rgba(255,255,255,0.2)'; });
    newWindowBtn.addEventListener('mouseleave', () => { newWindowBtn.style.color = '#888'; newWindowBtn.style.borderColor = 'rgba(255,255,255,0.1)'; });
    newWindowBtn.addEventListener('click', () => {
      window.electronAPI?.openNewWindow();
    });
    createCard.appendChild(newWindowBtn);

    rightCol.appendChild(createCard);

    /* ─── Join by ID card ─── */
    const joinCard = el('div', [], {
      style: 'background:#1a1a1f;border-radius:12px;border:1px solid rgba(255,255,255,0.06);box-shadow:0 4px 16px rgba(0,0,0,0.3);padding:24px',
    });
    const joinTitle = el('h2', [], {
      style: 'font-size:20px;font-weight:700;color:#e0e0e0;letter-spacing:-0.3px;margin-bottom:16px',
    }, 'Join by ID');
    joinCard.appendChild(joinTitle);

    const joinInput = el('input', [], {
      type: 'text',
      placeholder: 'Paste game ID...',
      style: 'width:100%;padding:10px 12px;background:#222228;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e0e0e0;font-size:13px;outline:none;box-sizing:border-box;transition:border-color 150ms ease',
    });
    joinInput.addEventListener('focus', () => { joinInput.style.borderColor = '#4f8ef7'; });
    joinInput.addEventListener('blur', () => { joinInput.style.borderColor = 'rgba(255,255,255,0.1)'; });
    joinCard.appendChild(joinInput);

    const joinBtn = el('button', [], {
      style: 'margin-top:12px;width:100%;padding:10px;background:transparent;color:#4f8ef7;border:1px solid #4f8ef7;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:background 150ms ease,color 150ms ease;letter-spacing:0.3px',
    }, 'Join');
    joinBtn.addEventListener('mouseenter', () => { joinBtn.style.background = '#4f8ef7'; joinBtn.style.color = '#fff'; });
    joinBtn.addEventListener('mouseleave', () => { joinBtn.style.background = 'transparent'; joinBtn.style.color = '#4f8ef7'; });
    joinBtn.addEventListener('click', async () => {
      const gid = (joinInput as HTMLInputElement).value.trim();
      if (!gid) {
        store.toast('Please enter a game ID');
        return;
      }
      try {
        const game = await api.joinGame(gid);
        store.set('currentGame', game);
        navigate('game', game.id);
      } catch (err: any) {
        store.toast(err.message || 'Failed to join game');
      }
    });
    joinCard.appendChild(joinBtn);
    joinInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') joinBtn.click();
    });

    rightCol.appendChild(joinCard);
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

  const dot = el('span', ['game-status'], {
    style: 'width:8px;height:8px;border-radius:50%;background:#4f8ef7;animation:pulse 2s ease-in-out infinite;flex-shrink:0',
  });
  leftSection.appendChild(dot);

  const info = el('div', [], {});
  const nameRow = el('div', [], { style: 'display:flex;align-items:center;gap:6px' });
  const name = el('span', [], {
    style: 'font-size:15px;font-weight:500;color:#e0e0e0;letter-spacing:0.2px',
  }, creatorName);
  nameRow.appendChild(name);
  if (game.visibility === 'private') {
    const badge = el('span', [], {
      style: 'font-size:10px;font-weight:600;color:#888;background:rgba(255,255,255,0.06);padding:1px 6px;border-radius:4px;letter-spacing:0.3px;text-transform:uppercase',
    }, 'Private');
    nameRow.appendChild(badge);
  }
  info.appendChild(nameRow);
  const status = el('span', [], {
    style: 'font-size:12px;font-weight:300;color:#888;letter-spacing:0.2px',
  }, 'Waiting');
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

const pulseStyle = document.createElement('style');
pulseStyle.textContent = `@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`;
document.head.appendChild(pulseStyle);
