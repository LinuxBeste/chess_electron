import { store } from '../store';
import { navigate } from '../router';
import { el } from '../chess';
import type { GameState } from '../../types';

export const resultView = {
  mount(container: HTMLElement): () => void {
    const hash = window.location.hash;
    const gameId = hash.startsWith('#result/') ? hash.slice(8) : '';

    const game = store.get('currentGame');
    const myId = store.get('playerId');

    /* Derive outcome from game state: check winner against logged-in player */
    let outcomeText = 'Draw';
    let reasonText = '';
    let won = false;
    let lost = false;

    if (game) {
      if (game.status === 'checkmate' || game.status === 'resigned') {
        if (game.winner) {
          const winnerIsMe = (game.winner === 'white' && game.players.white === myId) ||
                            (game.winner === 'black' && game.players.black === myId);
          if (winnerIsMe) {
            outcomeText = 'You Won';
            won = true;
          } else {
            outcomeText = 'You Lost';
            lost = true;
          }
        }
      } else if (game.status === 'stalemate' || game.status === 'draw') {
        outcomeText = 'Draw';
      }

      switch (game.status) {
        case 'checkmate':
          reasonText = 'by checkmate';
          break;
        case 'resigned':
          reasonText = won ? 'by resignation' : 'opponent resigned';
          break;
        case 'stalemate':
          reasonText = 'by stalemate';
          break;
        case 'draw':
          reasonText = 'by 50-move rule';
          break;
      }
    }

    /* Full-page overlay */
    const overlay = el('div', [], {
      style: 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:1000;animation:fadeIn 200ms ease',
    });

    const card = el('div', [], {
      style: 'background:#1a1a1f;border-radius:12px;border:1px solid rgba(255,255,255,0.06);box-shadow:0 16px 48px rgba(0,0,0,0.5);padding:48px 40px;text-align:center;max-width:400px;width:90%;animation:scaleIn 300ms cubic-bezier(0.34,1.56,0.64,1)',
    });

    /* Win=blue, loss=red, draw=muted */
    const outcomeColor = won ? '#4f8ef7' : lost ? 'rgba(220,80,80,0.9)' : '#888';
    const outcome = el('h1', [], {
      style: `font-size:36px;font-weight:700;color:${outcomeColor};letter-spacing:-0.5px;margin-bottom:8px`,
    }, outcomeText);
    card.appendChild(outcome);

    if (reasonText) {
      const reason = el('p', [], {
        style: 'font-size:16px;font-weight:300;color:#888;margin-bottom:32px;letter-spacing:0.3px',
      }, reasonText);
      card.appendChild(reason);
    }

    const btnRow = el('div', [], {
      style: 'display:flex;gap:12px;justify-content:center;flex-wrap:wrap',
    });

    const lobbyBtn = el('button', [], {
      style: 'padding:12px 24px;background:#4f8ef7;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:500;cursor:pointer;transition:background 150ms ease,transform 150ms ease;letter-spacing:0.3px',
    }, 'Back to Lobby');
    lobbyBtn.addEventListener('mouseenter', () => { lobbyBtn.style.background = '#5d9af8'; });
    lobbyBtn.addEventListener('mouseleave', () => { lobbyBtn.style.background = '#4f8ef7'; });
    lobbyBtn.addEventListener('mousedown', () => { lobbyBtn.style.transform = 'scale(0.97)'; });
    lobbyBtn.addEventListener('mouseup', () => { lobbyBtn.style.transform = 'scale(1)'; });
    lobbyBtn.addEventListener('click', () => navigate('lobby'));
    btnRow.appendChild(lobbyBtn);

    if (game && game.boardHistory && game.boardHistory.length > 0) {
      const reviewBtn = el('button', [], {
        style: 'padding:12px 24px;background:transparent;color:#4f8ef7;border:1px solid #4f8ef7;border-radius:8px;font-size:15px;font-weight:500;cursor:pointer;transition:background 150ms ease,color 150ms ease;letter-spacing:0.3px',
      }, 'Review Game');
      reviewBtn.addEventListener('mouseenter', () => { reviewBtn.style.background = '#4f8ef7'; reviewBtn.style.color = '#fff'; });
      reviewBtn.addEventListener('mouseleave', () => { reviewBtn.style.background = 'transparent'; reviewBtn.style.color = '#4f8ef7'; });
      reviewBtn.addEventListener('click', () => {
        navigate('game', game.id);
      });
      btnRow.appendChild(reviewBtn);
    }

    const copyBtn = el('button', [], {
      style: 'padding:12px 24px;background:transparent;color:#888;border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-size:15px;font-weight:500;cursor:pointer;transition:background 150ms ease,color 150ms ease;letter-spacing:0.3px',
    }, 'Copy Game ID');
    copyBtn.addEventListener('mouseenter', () => { copyBtn.style.background = 'rgba(255,255,255,0.05)'; copyBtn.style.color = '#e0e0e0'; });
    copyBtn.addEventListener('mouseleave', () => { copyBtn.style.background = 'transparent'; copyBtn.style.color = '#888'; });
    copyBtn.addEventListener('click', () => {
      const id = game?.id || gameId;
      if (id) {
        navigator.clipboard.writeText(id).then(() => {
          copyBtn.textContent = 'Copied \u2713';
          setTimeout(() => { copyBtn.textContent = 'Copy Game ID'; }, 2000);
        }).catch(() => {
          store.toast('Failed to copy');
        });
      }
    });
    btnRow.appendChild(copyBtn);

    card.appendChild(btnRow);
    overlay.appendChild(card);
    container.appendChild(overlay);

    return () => {
      overlay.remove();
    };
  },
};

/* Inject animations */
const resultStyle = document.createElement('style');
resultStyle.textContent = `@keyframes fadeIn { from { opacity:0 } to { opacity:1 } } @keyframes scaleIn { from { opacity:0;transform:scale(0.8) } to { opacity:1;transform:scale(1) } }`;
document.head.appendChild(resultStyle);
