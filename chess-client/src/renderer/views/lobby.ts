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
      style: 'display:flex;gap:24px;padding:24px;flex:1;max-width:960px;margin:0 auto;overflow:hidden',
    });

    /* Left column: open games list */
    const leftCol = el('div', [], {
      style: 'flex:1;display:flex;flex-direction:column;overflow:hidden',
    });

    const leftHeader = el('h2', ['card-title'], {}, 'Open Games');
    leftCol.appendChild(leftHeader);

    const statusEl = el('div', [], {
      style: 'font-size:13px;font-weight:300;color:var(--muted);text-align:center;padding:16px;display:none',
    });
    leftCol.appendChild(statusEl);

    const gameList = el('div', [], {
      style: 'flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:4px',
    });
    leftCol.appendChild(gameList);

    /* Live Games */
    const liveHeader = el('h2', ['card-title'], {
      style: 'margin-top:16px',
    }, 'Live Games');
    leftCol.appendChild(liveHeader);

    const liveList = el('div', [], {
      style: 'overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:4px;min-height:80px',
    });
    const liveStatus = el('div', [], {
      style: 'font-size:13px;font-weight:300;color:var(--muted);text-align:center;padding:16px;display:none',
    });
    leftCol.appendChild(liveStatus);
    leftCol.appendChild(liveList);

    wrapper.appendChild(leftCol);

    /* Right column: panels */
    const rightCol = el('div', [], {
      style: 'width:280px;flex-shrink:0;display:flex;flex-direction:column;gap:16px;overflow-y:auto',
    });

    /* Create Game card */
    const createCard = el('div', ['card'], { style: 'padding:24px' });
    const createTitle = el('h2', ['card-title'], {}, 'Create Game');
    createCard.appendChild(createTitle);

    const toggleRow = el('div', [], {
      style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px',
    });
    const toggleLabel = el('span', [], {
      style: 'font-size:13px;font-weight:400;color:var(--muted);letter-spacing:0.2px',
    }, 'Private game');
    const toggle = el('div', ['toggle']);
    const toggleKnob = el('div', ['toggle-knob']);
    let isPrivate = false;
    toggle.appendChild(toggleKnob);
    toggle.addEventListener('click', () => {
      isPrivate = !isPrivate;
      toggle.classList.toggle('active', isPrivate);
    });
    toggleRow.appendChild(toggleLabel);
    toggleRow.appendChild(toggle);
    createCard.appendChild(toggleRow);

    const createBtn = el('button', ['btn', 'btn-primary'], {
      style: 'width:100%;padding:14px;font-size:16px',
    }, 'New Game');
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

    if (window.electronAPI) {
      const newWindowBtn = el('button', ['btn', 'btn-ghost'], {
        style: 'margin-top:12px;width:100%;font-size:13px',
      }, 'New Window');
      newWindowBtn.addEventListener('click', () => {
        window.electronAPI?.openNewWindow();
      });
      createCard.appendChild(newWindowBtn);
    }

    rightCol.appendChild(createCard);

    /* Join by ID card */
    const joinCard = el('div', ['card'], { style: 'padding:24px' });
    const joinTitle = el('h2', ['card-title'], {}, 'Join by ID');
    joinCard.appendChild(joinTitle);

    const joinInput = el('input', ['input'], {
      type: 'text',
      placeholder: 'Paste game ID...',
    });
    joinCard.appendChild(joinInput);

    const joinBtn = el('button', ['btn', 'btn-secondary'], {
      style: 'margin-top:12px;width:100%',
    }, 'Join');
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

    /* Match History card */
    const historyCard = el('div', ['card'], { style: 'padding:24px' });
    const historyTitle = el('h2', ['card-title'], {}, 'Match History');
    historyCard.appendChild(historyTitle);

    const historyList = el('div', [], {
      style: 'display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto',
    });

    async function loadMatchHistory(): Promise<void> {
      const pid = store.get('playerId');
      if (!pid) return;
      try {
        const { getPlayerGames } = await import('../api');
        const games = await getPlayerGames(pid);
        historyList.innerHTML = '';
        if (games.length === 0) {
          historyList.appendChild(el('div', [], {
            style: 'font-size:13px;font-weight:300;color:#555;text-align:center;padding:12px',
          }, 'No completed games yet'));
          return;
        }
        for (const g of games.slice(-10).reverse()) {
          const myId = store.get('playerId');
          const isWhite = g.players.white === myId;
          const won = g.winner === (isWhite ? 'white' : 'black');
          const resultText = g.status === 'draw' ? 'Draw' : (won ? 'Won' : 'Lost');
          const resultColor = g.status === 'draw' ? 'var(--muted)' : (won ? 'var(--accent)' : 'var(--danger)');
          const opponent = isWhite ? (g.players.black || '?') : (g.players.white || '?');

          const row = el('div', [], {
            style: 'display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,0.02);font-size:13px',
          });
          const oppEl = el('span', [], {
            style: 'color:var(--text);font-weight:500;letter-spacing:0.2px',
          }, `vs ${opponent.slice(0, 8)}`);
          const resultEl = el('span', [], {
            style: `color:${resultColor};font-weight:600;letter-spacing:0.3px`,
          }, resultText);
          row.appendChild(oppEl);
          row.appendChild(resultEl);
          historyList.appendChild(row);
        }
      } catch {}
    }

    historyCard.appendChild(historyList);

    const refreshBtn = el('button', ['btn', 'btn-ghost'], {
      style: 'margin-top:10px;width:100%;font-size:12px',
    }, 'Refresh');
    refreshBtn.addEventListener('click', loadMatchHistory);
    historyCard.appendChild(refreshBtn);

    rightCol.appendChild(historyCard);
    wrapper.appendChild(rightCol);
    container.appendChild(wrapper);

    let polling = true;

    async function poll(): Promise<void> {
      if (!polling) return;
      try {
        const games = await api.getOpenGames();
        const hasGames = games.length > 0;
        updateGameList(gameList, games);
        statusEl.style.display = hasGames ? 'none' : 'block';
        statusEl.textContent = hasGames ? '' : 'No open games yet';

        const activeGames = await api.getActiveGames();
        updateLiveGamesList(liveList, liveStatus, activeGames);
      } catch {
        statusEl.style.display = 'block';
        statusEl.style.color = 'var(--danger)';
        statusEl.textContent = 'Cannot connect to server';
      }
      if (polling) setTimeout(poll, 3000);
    }

    poll();
    checkActiveGame();
    loadMatchHistory();

    return () => {
      polling = false;
      gameCardMap.clear();
      wrapper.remove();
    };
  },
};

// --- helper functions ---

function updateGameList(container: HTMLElement, games: GameState[]): void {
  const newIds = new Set(games.map(g => g.id));
  for (const id of gameCardMap.keys()) {
    if (!newIds.has(id)) {
      gameCardMap.get(id)?.remove();
      gameCardMap.delete(id);
    }
  }
  for (const game of games) {
    if (game.visibility === 'private') continue;
    if (gameCardMap.has(game.id)) continue;
    const creatorId = game.players.white;
    const creatorName = creatorId === store.get('playerId') ? 'You' : creatorId?.slice(0, 8) ?? 'Unknown';
    const card = createGameCard(game, creatorName);
    gameCardMap.set(game.id, card);
    container.appendChild(card);
  }
}

function updateLiveGamesList(container: HTMLElement, statusEl: HTMLElement, games: GameState[]): void {
  container.querySelectorAll('.live-game-card').forEach(c => c.remove());
  if (games.length === 0) {
    statusEl.style.display = 'block';
    statusEl.textContent = 'No active games';
    return;
  }
  statusEl.style.display = 'none';
  for (const game of games) {
    container.appendChild(createLiveGameCard(game));
  }
}

function createLiveGameCard(game: GameState): HTMLElement {
  const card = el('div', ['live-game-card', 'card-elevated'], {
    style: 'padding:14px 18px;display:flex;align-items:center;justify-content:space-between',
  });

  const info = el('div', [], { style: 'display:flex;align-items:center;gap:10px' });
  const liveDot = el('span', [], {
    style: 'width:8px;height:8px;border-radius:50%;background:var(--success);animation:pulse 2s ease-in-out infinite;flex-shrink:0',
  });
  info.appendChild(liveDot);
  info.appendChild(el('span', [], {
    style: 'font-size:14px;font-weight:500;color:var(--text);letter-spacing:0.2px',
  }, 'Game in progress'));
  card.appendChild(info);

  const spectateBtn = el('button', ['btn', 'btn-sm'], {
    style: 'color:var(--success);border-color:var(--success);background:transparent',
  }, 'Spectate');
  spectateBtn.addEventListener('mouseenter', () => { spectateBtn.style.background = 'var(--success)'; spectateBtn.style.color = '#fff'; });
  spectateBtn.addEventListener('mouseleave', () => { spectateBtn.style.background = 'transparent'; spectateBtn.style.color = 'var(--success)'; });
  spectateBtn.addEventListener('click', async () => {
    try {
      const fresh = await api.getGame(game.id);
      store.set('currentGame', fresh);
      navigate('game', `${game.id}?spectate=1`);
    } catch (err: any) {
      store.toast(err.message || 'Failed to load game');
    }
  });
  card.appendChild(spectateBtn);
  return card;
}

function createGameCard(game: GameState, creatorName: string): HTMLElement {
  const card = el('div', ['game-card', 'card-elevated'], {
    'data-game-id': game.id,
    style: 'padding:14px 18px;display:flex;align-items:center;justify-content:space-between',
  });

  const leftSection = el('div', [], { style: 'display:flex;align-items:center;gap:12px' });
  const dot = el('span', ['game-status'], {
    style: 'width:8px;height:8px;border-radius:50%;background:var(--accent);animation:pulse 2s ease-in-out infinite;flex-shrink:0',
  });
  leftSection.appendChild(dot);

  const info = el('div', []);
  const nameRow = el('div', [], { style: 'display:flex;align-items:center;gap:6px' });
  nameRow.appendChild(el('span', [], {
    style: 'font-size:15px;font-weight:500;color:var(--text);letter-spacing:0.2px',
  }, creatorName));
  if (game.visibility === 'private') {
    nameRow.appendChild(el('span', ['badge', 'badge-private'], {}, 'Private'));
  }
  info.appendChild(nameRow);
  info.appendChild(el('span', [], {
    style: 'font-size:12px;font-weight:300;color:var(--muted);letter-spacing:0.2px',
  }, 'Waiting'));
  leftSection.appendChild(info);
  card.appendChild(leftSection);

  const joinBtn = el('button', ['btn', 'btn-sm', 'btn-secondary'], {}, 'Join');
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
  } catch {}
}
