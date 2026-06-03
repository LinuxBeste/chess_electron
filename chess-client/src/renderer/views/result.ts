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
    const overlay = el('div', ['modal-overlay']);

    const card = el('div', ['modal-card'], { style: 'padding:48px 40px' });

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

    const btnRow = el('div', ['game-btn-row'], { style: 'flex-wrap:wrap' });

    const lobbyBtn = el('button', ['btn', 'btn-primary'], {
      style: 'padding:12px 24px;font-size:15px',
    }, 'Back to Lobby');
    lobbyBtn.addEventListener('click', () => navigate('lobby'));
    btnRow.appendChild(lobbyBtn);

    if (game && game.boardHistory && game.boardHistory.length > 0) {
      const reviewBtn = el('button', ['btn', 'btn-secondary'], {
        style: 'padding:12px 24px;font-size:15px',
      }, 'Review Game');
      reviewBtn.addEventListener('click', () => {
        navigate('game', game.id);
      });
      btnRow.appendChild(reviewBtn);
    }

    const copyBtn = el('button', ['btn', 'btn-ghost'], {
      style: 'padding:12px 24px;font-size:15px',
    }, 'Copy Game ID');
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
