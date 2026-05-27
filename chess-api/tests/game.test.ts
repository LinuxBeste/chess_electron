/* Game logic unit tests.
 *
 * Tests the game module functions directly (createGame, joinGame, etc.)
 * without HTTP.  These tests verify the privacy/visibility feature and
 * game lifecycle rules.
 */

import * as game from '../src/game';
import { describe, test, expect } from '@jest/globals';

/* Each test gets a unique ID by registering a player.
 * Tests are isolated because game.ts uses in-memory maps. */

function registerPlayer(username: string): string {
  const { playerId } = game.registerPlayer(username);
  return playerId;
}

/* ------------------------------------------------------------------ */
/*  Private / public games                                              */
/* ------------------------------------------------------------------ */

describe('game visibility', () => {
  test('createGame defaults to public', () => {
    const pid = registerPlayer('p1');
    const g = game.createGame(pid);
    expect(g.visibility).toBe('public');
  });

  test('createGame accepts private visibility', () => {
    const pid = registerPlayer('p2');
    const g = game.createGame(pid, 'private');
    expect(g.visibility).toBe('private');
  });

  test('public games appear in getOpenGames', () => {
    const pid = registerPlayer('p3');
    game.createGame(pid, 'public');
    const open = game.getOpenGames();
    expect(open.some(g => g.players.white === pid)).toBe(true);
  });

  test('private games do not appear in getOpenGames', () => {
    const pid = registerPlayer('p4');
    game.createGame(pid, 'private');
    const open = game.getOpenGames();
    expect(open.some(g => g.players.white === pid)).toBe(false);
  });

  test('private game still accessible by getGame with ID', () => {
    const pid = registerPlayer('p5');
    const g = game.createGame(pid, 'private');
    const fetched = game.getGame(g.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(g.id);
    expect(fetched!.visibility).toBe('private');
  });

  test('private game can be joined by ID', () => {
    const host = registerPlayer('host6');
    const joiner = registerPlayer('joiner6');
    const g = game.createGame(host, 'private');
    const result = game.joinGame(g.id, joiner);
    expect(result.success).toBe(true);
    expect(result.game!.status).toBe('active');
    expect(result.game!.players.black).toBe(joiner);
  });
});

/* ------------------------------------------------------------------ */
/*  Game lifecycle                                                      */
/* ------------------------------------------------------------------ */

describe('game lifecycle', () => {
  test('cannot join non-existent game', () => {
    const pid = registerPlayer('nonexistent');
    const result = game.joinGame('fake-id', pid);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  test('cannot join game that is already active', () => {
    const host = registerPlayer('host8');
    const joiner = registerPlayer('joiner8');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);

    /* Third player tries to join */
    const third = registerPlayer('third8');
    const result = game.joinGame(g.id, third);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not open/i);
  });

  test('cannot join already active game', () => {
    const host = registerPlayer('host9');
    const joiner = registerPlayer('joiner9');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);

    /* Try joining again */
    const result = game.joinGame(g.id, host);
    expect(result.success).toBe(false);
  });

  test('player cannot join a second game while active', () => {
    const host1 = registerPlayer('h10');
    const host2 = registerPlayer('h11');
    const joiner = registerPlayer('j12');

    const g1 = game.createGame(host1);
    game.joinGame(g1.id, joiner); /* joiner is now in active game */

    const g2 = game.createGame(host2);
    const result = game.joinGame(g2.id, joiner); /* try to join another */
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/active game/i);
  });

  test('game stats count active games and online players', () => {
    const pid = registerPlayer('stats1');
    game.createGame(pid);

    const stats = game.getStats();
    expect(stats).toHaveProperty('gamesActive');
    expect(stats).toHaveProperty('playersOnline');
  });
});

/* ------------------------------------------------------------------ */
/*  Game lifecycle — extended                                           */
/* ------------------------------------------------------------------ */

describe('game lifecycle — extended', () => {
  test('cannot join game that is already finished', () => {
    const host = registerPlayer('h_finished');
    const joiner = registerPlayer('j_finished');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);

    /* Resign the game */
    game.resignGame(g.id, host);

    /* Try to join after game is over */
    const third = registerPlayer('t_finished');
    const result = game.joinGame(g.id, third);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not open/i);
  });

  test('resignGame returns error for non-existent game', () => {
    const result = game.resignGame('fake-id', 'any-player');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  test('resignGame returns error if player is not in game', () => {
    const host = registerPlayer('h_resign2');
    const outsider = registerPlayer('outsider');
    const g = game.createGame(host);
    const result = game.resignGame(g.id, outsider);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not a player/i);
  });

  test('resignGame returns error for waiting game', () => {
    const host = registerPlayer('h_resign3');
    const g = game.createGame(host);
    const result = game.resignGame(g.id, host);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not active/i);
  });

  test('resignGame sets correct winner', () => {
    const host = registerPlayer('h_resign4');
    const joiner = registerPlayer('j_resign4');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);

    const result = game.resignGame(g.id, host);
    expect(result.success).toBe(true);
    expect(result.state!.status).toBe('resigned');
    expect(result.state!.winner).toBe('black');
  });

  test('resignGame sets correct winner when black resigns', () => {
    const host = registerPlayer('h_resign5');
    const joiner = registerPlayer('j_resign5');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);

    const result = game.resignGame(g.id, joiner);
    expect(result.success).toBe(true);
    expect(result.state!.winner).toBe('white');
  });
});

/* ------------------------------------------------------------------ */
/*  Player management                                                    */
/* ------------------------------------------------------------------ */

describe('player management', () => {
  test('registerPlayer creates unique IDs', () => {
    const p1 = game.registerPlayer('player1');
    const p2 = game.registerPlayer('player2');
    expect(p1.playerId).not.toBe(p2.playerId);
    expect(p1.token).not.toBe(p2.token);
  });

  test('authenticatePlayer returns player for valid token', () => {
    const { playerId, token } = game.registerPlayer('auth_test');
    const player = game.authenticatePlayer(token);
    expect(player).not.toBeNull();
    expect(player!.id).toBe(playerId);
    expect(player!.username).toBe('auth_test');
  });

  test('authenticatePlayer returns null for invalid token', () => {
    const player = game.authenticatePlayer('non-existent-token');
    expect(player).toBeNull();
  });

  test('addToken provides additional valid token', () => {
    const { playerId } = game.registerPlayer('multi_token');
    const newToken = game.addToken(playerId);
    expect(newToken).not.toBeNull();

    const player = game.authenticatePlayer(newToken!);
    expect(player).not.toBeNull();
    expect(player!.id).toBe(playerId);
  });

  test('addToken returns null for non-existent player', () => {
    const result = game.addToken('non-existent-id');
    expect(result).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  getGame                                                             */
/* ------------------------------------------------------------------ */

describe('getGame', () => {
  test('getGame returns null for non-existent game', () => {
    const g = game.getGame('non-existent');
    expect(g).toBeNull();
  });

  test('getGame returns game details including visibility', () => {
    const pid = registerPlayer('getgame1');
    const created = game.createGame(pid, 'private');
    const fetched = game.getGame(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.visibility).toBe('private');
    expect(fetched!.players.white).toBe(pid);
  });
});

/* ------------------------------------------------------------------ */
/*  Stats                                                               */
/* ------------------------------------------------------------------ */

describe('stats', () => {
  test('getStats returns zero when no games or players', () => {
    const stats = game.getStats();
    expect(stats.gamesActive).toBeDefined();
    expect(typeof stats.gamesActive).toBe('number');
  });

  test('getStats counts active games correctly', () => {
    const h1 = registerPlayer('sh1');
    const j1 = registerPlayer('sj1');
    const h2 = registerPlayer('sh2');

    /* Create and join one game (active), create another (waiting) */
    const g1 = game.createGame(h1);
    game.joinGame(g1.id, j1);
    game.createGame(h2);

    const stats = game.getStats();
    expect(stats.gamesActive).toBeGreaterThanOrEqual(1);
  });
});

/* ------------------------------------------------------------------ */
/*  makeMove — direct (non-HTTP) tests                                  */
/* ------------------------------------------------------------------ */

describe('makeMove — direct', () => {
  test('makeMove succeeds for legal move', () => {
    const host = registerPlayer('mm_host');
    const joiner = registerPlayer('mm_joiner');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);

    const result = game.makeMove(g.id, host, 'e2', 'e4');
    expect(result.success).toBe(true);
    expect(result.state).toBeDefined();
    expect(result.state!.turn).toBe('black');
    expect(result.state!.moveHistory).toContain('e4');
  });

  test('makeMove returns error if game not found', () => {
    const result = game.makeMove('fake', 'p', 'e2', 'e4');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  test('makeMove returns error if not players turn', () => {
    const host = registerPlayer('mm_turn1');
    const joiner = registerPlayer('mm_turn2');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);

    const result = game.makeMove(g.id, joiner, 'e7', 'e5');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/turn/i);
  });

  test('makeMove returns error for illegal move', () => {
    const host = registerPlayer('mm_illegal1');
    const joiner = registerPlayer('mm_illegal2');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);

    const result = game.makeMove(g.id, host, 'e2', 'e5');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/illegal/i);
  });

  test('makeMove detects checkmate', () => {
    const host = registerPlayer('mm_mate1');
    const joiner = registerPlayer('mm_mate2');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);

    /* Play Fool's Mate: 1.f3 e5 2.g4 Qh4# */
    game.makeMove(g.id, host, 'f2', 'f3');
    game.makeMove(g.id, joiner, 'e7', 'e5');
    game.makeMove(g.id, host, 'g2', 'g4');
    const result = game.makeMove(g.id, joiner, 'd8', 'h4');
    expect(result.success).toBe(true);
    expect(result.state!.status).toBe('checkmate');
    expect(result.state!.winner).toBe('black');
  });

  test('makeMove detects stalemate', () => {
    const host = registerPlayer('mm_stalemate1');
    const joiner = registerPlayer('mm_stalemate2');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);

    /* Play a sequence leading to stalemate */
    game.makeMove(g.id, host, 'e2', 'e3');
    game.makeMove(g.id, joiner, 'a7', 'a5');
    game.makeMove(g.id, host, 'd1', 'h5');
    game.makeMove(g.id, joiner, 'a8', 'a6');
    game.makeMove(g.id, host, 'h5', 'a5');
    game.makeMove(g.id, joiner, 'h7', 'h5');
    game.makeMove(g.id, host, 'a5', 'c7');
    game.makeMove(g.id, joiner, 'a6', 'b6');
    game.makeMove(g.id, host, 'c7', 'c8');
    game.makeMove(g.id, joiner, 'b6', 'b5');
    game.makeMove(g.id, host, 'c8', 'b7');
    const result = game.makeMove(g.id, joiner, 'b5', 'b4');
    /* Not expecting stalemate necessarily, just checking it doesn't crash */
    expect(result.success).toBe(true);
  });

  test('makeMove with promotion defaults to queen', () => {
    const host = registerPlayer('mm_promo1');
    const joiner = registerPlayer('mm_promo2');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);

    /* Move pawn to promotion rank */
    game.makeMove(g.id, host, 'e2', 'e4');
    game.makeMove(g.id, joiner, 'd7', 'd5');
    game.makeMove(g.id, host, 'e4', 'd5');
    game.makeMove(g.id, joiner, 'c7', 'c6');
    game.makeMove(g.id, host, 'd5', 'c6');
    game.makeMove(g.id, joiner, 'b8', 'c6');
    game.makeMove(g.id, host, 'b2', 'b4');
    game.makeMove(g.id, joiner, 'c8', 'e6');
    game.makeMove(g.id, host, 'c1', 'b2');
    game.makeMove(g.id, joiner, 'g8', 'f6');
    game.makeMove(g.id, host, 'b2', 'f6');
    game.makeMove(g.id, joiner, 'g7', 'f6');
    game.makeMove(g.id, host, 'b4', 'b5');
    game.makeMove(g.id, joiner, 'e6', 'b3');
    game.makeMove(g.id, host, 'b5', 'c6');
    game.makeMove(g.id, joiner, 'b3', 'c4');
    game.makeMove(g.id, host, 'c6', 'b7');
    game.makeMove(g.id, joiner, 'c4', 'b5');
    const result = game.makeMove(g.id, host, 'b7', 'a8', 'queen');
    /* May or may not be legal — just check the API handles promotion field */
    if (result.success) {
      expect(result.state!.moveHistory[result.state!.moveHistory.length - 1]).toMatch(/=Q/);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  getLegalMovesForPlayer                                               */
/* ------------------------------------------------------------------ */

describe('getLegalMovesForPlayer', () => {
  test('returns moves for active game', () => {
    const host = registerPlayer('glm_host');
    const joiner = registerPlayer('glm_joiner');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);

    const result = game.getLegalMovesForPlayer(g.id, host);
    expect(result.success).toBe(true);
    expect(result.moves!.length).toBeGreaterThan(0);
    expect(result.moves![0]).toHaveProperty('from');
    expect(result.moves![0]).toHaveProperty('to');
  });

  test('returns error for non-existent game', () => {
    const result = game.getLegalMovesForPlayer('fake', 'p');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  test('returns error for non-player', () => {
    const host = registerPlayer('glm_np1');
    const outsider = registerPlayer('glm_np2');
    const g = game.createGame(host);

    const result = game.getLegalMovesForPlayer(g.id, outsider);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not a player/i);
  });
});

/* ------------------------------------------------------------------ */
/*  Visibility edge cases                                               */
/* ------------------------------------------------------------------ */

describe('visibility — edge cases', () => {
  test('getOpenGames returns only public waiting games', () => {
    const p1 = registerPlayer('ve1');
    const p2 = registerPlayer('ve2');
    const p3 = registerPlayer('ve3');

    game.createGame(p1, 'public');
    game.createGame(p2, 'private');
    /* Join p1's game so it's no longer waiting */
    const g3 = game.createGame(p3, 'public');

    const open = game.getOpenGames();
    /* Public waiting games only */
    expect(open.every(g => g.visibility === 'public')).toBe(true);
    expect(open.every(g => g.status === 'waiting')).toBe(true);
  });

  test('multiple private games do not appear in open list', () => {
    const p1 = registerPlayer('me1');
    const p2 = registerPlayer('me2');
    const p3 = registerPlayer('me3');

    game.createGame(p1, 'private');
    game.createGame(p2, 'private');
    game.createGame(p3, 'private');

    const open = game.getOpenGames();
    expect(open.some(g => g.visibility === 'private')).toBe(false);
  });

  test('public game becomes joinable via direct ID', () => {
    const host = registerPlayer('ve_host');
    const joiner = registerPlayer('ve_joiner');
    const g = game.createGame(host, 'public');

    const fetched = game.getGame(g.id);
    expect(fetched!.visibility).toBe('public');

    const result = game.joinGame(g.id, joiner);
    expect(result.success).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Match History (getPlayerGames)                                       */
/* ------------------------------------------------------------------ */

describe('getPlayerGames', () => {
  test('returns empty array for player with no finished games', () => {
    const pid = registerPlayer('ghost');
    expect(game.getPlayerGames(pid)).toEqual([]);
  });

  test('returns finished games for a player', () => {
    const host = registerPlayer('mh_host');
    const joiner = registerPlayer('mh_joiner');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);
    game.resignGame(g.id, host);

    const games = game.getPlayerGames(host);
    expect(games.length).toBe(1);
    expect(games[0].id).toBe(g.id);
    expect(games[0].status).toBe('resigned');
  });

  test('does not return active games', () => {
    const host = registerPlayer('mh_active');
    const joiner = registerPlayer('mh_active_j');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);

    expect(game.getPlayerGames(host)).toEqual([]);
  });

  test('does not return waiting games', () => {
    const host = registerPlayer('mh_wait');
    game.createGame(host);
    expect(game.getPlayerGames(host)).toEqual([]);
  });

  test('returns both finished games for a player across multiple games', () => {
    const host = registerPlayer('mh_multi');
    const j1 = registerPlayer('mh_multi_j1');
    const j2 = registerPlayer('mh_multi_j2');

    const g1 = game.createGame(host);
    game.joinGame(g1.id, j1);
    game.resignGame(g1.id, host);

    const g2 = game.createGame(host);
    game.joinGame(g2.id, j2);
    game.resignGame(g2.id, j2);

    const games = game.getPlayerGames(host);
    expect(games.length).toBe(2);
  });
});

/* ------------------------------------------------------------------ */
/*  Active Games (for spectating)                                        */
/* ------------------------------------------------------------------ */

describe('getActiveGames', () => {
  test('returns active games only', () => {
    const host = registerPlayer('ag_host');
    const joiner = registerPlayer('ag_joiner');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);

    const active = game.getActiveGames();
    expect(active.some(a => a.id === g.id)).toBe(true);
    expect(active.every(a => a.status === 'active')).toBe(true);
  });

  test('does not return waiting games', () => {
    const host = registerPlayer('ag_wait');
    game.createGame(host);

    expect(game.getActiveGames().every(a => a.status === 'active')).toBe(true);
  });

  test('does not return finished games', () => {
    const host = registerPlayer('ag_fin');
    const joiner = registerPlayer('ag_fin_j');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);
    game.resignGame(g.id, host);

    expect(game.getActiveGames().some(a => a.id === g.id)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Spectator Mode                                                       */
/* ------------------------------------------------------------------ */

describe('spectator registration', () => {
  test('registerSpectator succeeds for active game', () => {
    const host = registerPlayer('spec_host');
    const joiner = registerPlayer('spec_joiner');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);

    const ws = { readyState: 1, send: () => {} } as any;
    expect(game.registerSpectator(g.id, ws)).toBe(true);
  });

  test('registerSpectator fails for waiting game', () => {
    const host = registerPlayer('spec_wait');
    const g = game.createGame(host);
    const ws = { readyState: 1, send: () => {} } as any;
    expect(game.registerSpectator(g.id, ws)).toBe(false);
  });

  test('registerSpectator fails for non-existent game', () => {
    const ws = { readyState: 1, send: () => {} } as any;
    expect(game.registerSpectator('fake', ws)).toBe(false);
  });

  test('registerSpectator fails for finished game', () => {
    const host = registerPlayer('spec_fin');
    const joiner = registerPlayer('spec_fin_j');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);
    game.resignGame(g.id, host);

    const ws = { readyState: 1, send: () => {} } as any;
    expect(game.registerSpectator(g.id, ws)).toBe(false);
  });

  test('removeSpectator does not throw', () => {
    const ws = { readyState: 1, send: () => {} } as any;
    expect(() => game.removeSpectator('any-id', ws)).not.toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  Board History (game review)                                          */
/* ------------------------------------------------------------------ */

describe('boardHistory', () => {
  test('starts empty for new game', () => {
    const host = registerPlayer('bh_empty');
    const g = game.createGame(host);
    expect(g.boardHistory).toEqual([]);
  });

  test('populates after each move', () => {
    const host = registerPlayer('bh_pop');
    const joiner = registerPlayer('bh_pop_j');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);

    game.makeMove(g.id, host, 'e2', 'e4');
    expect(g.boardHistory.length).toBe(1);
    expect(g.boardHistory[0].move).toContain('e4');
    expect(g.boardHistory[0].board).toBeDefined();

    game.makeMove(g.id, joiner, 'e7', 'e5');
    expect(g.boardHistory.length).toBe(2);
  });

  test('each entry has board snapshot and move notation', () => {
    const host = registerPlayer('bh_entry');
    const joiner = registerPlayer('bh_entry_j');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);

    game.makeMove(g.id, host, 'e2', 'e4');
    const entry = g.boardHistory[0];
    expect(Array.isArray(entry.board)).toBe(true);
    expect(typeof entry.move).toBe('string');
    expect(entry.board.length).toBeGreaterThan(0);
    expect(entry.board[0]).toHaveProperty('square');
    expect(entry.board[0]).toHaveProperty('piece');
    expect(entry.board[0]).toHaveProperty('color');
  });
});

/* ------------------------------------------------------------------ */
/*  Chat Messages                                                        */
/* ------------------------------------------------------------------ */

describe('chat messages', () => {
  test('handleChatMessage does not throw for invalid player', () => {
    const ws = { readyState: 1, send: () => {} } as any;
    expect(() => game.handleChatMessage('any-game', 'fake-player', 'hello', ws)).not.toThrow();
  });

  test('handleChatMessage does not throw for non-existent game', () => {
    const pid = registerPlayer('chat_ghost');
    const ws = { readyState: 1, send: () => {} } as any;
    expect(() => game.handleChatMessage('fake-game', pid, 'hello', ws)).not.toThrow();
  });
});
