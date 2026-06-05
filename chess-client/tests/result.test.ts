import { describe, test, expect } from '@jest/globals';

interface GameState {
  status: string;
  winner?: string | null;
  players: { white: string; black: string };
  id?: string;
}

interface Outcome {
  outcomeText: string;
  reasonText: string;
  won: boolean;
  lost: boolean;
}

function deriveOutcome(game: GameState, myId: string): Outcome {
  let outcomeText = 'Draw';
  let reasonText = '';
  let won = false;
  let lost = false;

  if (game) {
    if (game.status === 'checkmate' || game.status === 'resigned') {
      if (game.winner) {
        const winnerIsMe =
          (game.winner === 'white' && game.players.white === myId) ||
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

  return { outcomeText, reasonText, won, lost };
}

const makeGame = (overrides: Partial<GameState> = {}): GameState => ({
  status: 'active',
  winner: null,
  players: { white: 'p1', black: 'p2' },
  ...overrides,
});

describe('result outcome derivation', () => {
  test('white player wins by checkmate', () => {
    const game = makeGame({ status: 'checkmate', winner: 'white' });
    const outcome = deriveOutcome(game, 'p1');
    expect(outcome.outcomeText).toBe('You Won');
    expect(outcome.won).toBe(true);
    expect(outcome.lost).toBe(false);
    expect(outcome.reasonText).toBe('by checkmate');
  });

  test('black player wins by checkmate', () => {
    const game = makeGame({ status: 'checkmate', winner: 'black' });
    const outcome = deriveOutcome(game, 'p2');
    expect(outcome.outcomeText).toBe('You Won');
    expect(outcome.won).toBe(true);
    expect(outcome.lost).toBe(false);
  });

  test('white player loses by checkmate', () => {
    const game = makeGame({ status: 'checkmate', winner: 'black' });
    const outcome = deriveOutcome(game, 'p1');
    expect(outcome.outcomeText).toBe('You Lost');
    expect(outcome.won).toBe(false);
    expect(outcome.lost).toBe(true);
  });

  test('black player loses by checkmate', () => {
    const game = makeGame({ status: 'checkmate', winner: 'white' });
    const outcome = deriveOutcome(game, 'p2');
    expect(outcome.outcomeText).toBe('You Lost');
    expect(outcome.lost).toBe(true);
  });

  test('player wins by resignation', () => {
    const game = makeGame({ status: 'resigned', winner: 'white' });
    const outcome = deriveOutcome(game, 'p1');
    expect(outcome.outcomeText).toBe('You Won');
    expect(outcome.reasonText).toBe('by resignation');
  });

  test('player loses by resignation', () => {
    const game = makeGame({ status: 'resigned', winner: 'black' });
    const outcome = deriveOutcome(game, 'p1');
    expect(outcome.outcomeText).toBe('You Lost');
    expect(outcome.reasonText).toBe('opponent resigned');
  });

  test('stalemate results in draw', () => {
    const game = makeGame({ status: 'stalemate' });
    const outcome = deriveOutcome(game, 'p1');
    expect(outcome.outcomeText).toBe('Draw');
    expect(outcome.won).toBe(false);
    expect(outcome.lost).toBe(false);
    expect(outcome.reasonText).toBe('by stalemate');
  });

  test('50-move rule draw', () => {
    const game = makeGame({ status: 'draw' });
    const outcome = deriveOutcome(game, 'p1');
    expect(outcome.outcomeText).toBe('Draw');
    expect(outcome.reasonText).toBe('by 50-move rule');
  });

  test('active game with no winner defaults to draw', () => {
    const game = makeGame({ status: 'active' });
    const outcome = deriveOutcome(game, 'p1');
    expect(outcome.outcomeText).toBe('Draw');
    expect(outcome.reasonText).toBe('');
  });

  test('checkmate with null winner draws', () => {
    const game = makeGame({ status: 'checkmate', winner: null });
    const outcome = deriveOutcome(game, 'p1');
    expect(outcome.outcomeText).toBe('Draw');
  });

  test('resigned with null winner draws', () => {
    const game = makeGame({ status: 'resigned', winner: null });
    const outcome = deriveOutcome(game, 'p1');
    expect(outcome.outcomeText).toBe('Draw');
  });

  test('unknown status defaults to draw', () => {
    const game = makeGame({ status: 'timeout' });
    const outcome = deriveOutcome(game, 'p1');
    expect(outcome.outcomeText).toBe('Draw');
    expect(outcome.reasonText).toBe('');
  });

  test('playerId not in game results in draw', () => {
    const game = makeGame({ status: 'checkmate', winner: 'white', players: { white: 'p3', black: 'p4' } });
    const outcome = deriveOutcome(game, 'p1');
    expect(outcome.outcomeText).toBe('Draw');
  });
});
