import { useNavigate, useParams } from 'react-router-dom';
import { store } from '../store';

export default function ResultPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const game = store.get('currentGame');
  const myId = store.get('playerId');

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
        } else if (myId && (game.players.white === myId || game.players.black === myId)) {
          outcomeText = 'You Lost';
          lost = true;
        }
      }
    } else if (game.status === 'stalemate' || game.status === 'draw') {
      outcomeText = 'Draw';
    }

    switch (game.status) {
      case 'checkmate': reasonText = 'by checkmate'; break;
      case 'resigned': reasonText = won ? 'by resignation' : 'opponent resigned'; break;
      case 'stalemate': reasonText = 'by stalemate'; break;
      case 'draw': reasonText = 'by 50-move rule'; break;
    }
  }

  const outcomeColor = won ? '#4f8ef7' : lost ? 'rgba(220,80,80,0.9)' : '#888';

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ padding: '48px 40px' }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: outcomeColor, letterSpacing: '-0.5px', marginBottom: 8 }}>
          {outcomeText}
        </h1>
        {reasonText && (
          <p style={{ fontSize: 16, fontWeight: 300, color: '#888', marginBottom: 32, letterSpacing: '0.3px' }}>
            {reasonText}
          </p>
        )}
        <div className="game-btn-row" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-primary" style={{ padding: '12px 24px', fontSize: 15 }} onClick={() => navigate('/lobby')}>
            Back to Lobby
          </button>
          {game && game.boardHistory && game.boardHistory.length > 0 && (
            <button className="btn btn-secondary" style={{ padding: '12px 24px', fontSize: 15 }} onClick={() => navigate(`/game/${game.id}`)}>
              Review Game
            </button>
          )}
          <button className="btn btn-ghost" style={{ padding: '12px 24px', fontSize: 15 }} onClick={() => {
            const id = game?.id || gameId;
            if (id) {
              navigator.clipboard.writeText(id).then(() => {
                const btn = document.activeElement as HTMLElement;
                btn.textContent = 'Copied ✓';
                setTimeout(() => { btn.textContent = 'Copy Game ID'; }, 2000);
              }).catch(() => store.toast('Failed to copy'));
            }
          }}>
            Copy Game ID
          </button>
        </div>
      </div>
    </div>
  );
}
