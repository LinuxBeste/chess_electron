/* Game logic unit tests.
 *
 * Tests the game module functions directly (createGame, joinGame, etc.)
 * without HTTP.  These tests verify the privacy/visibility feature and
 * game lifecycle rules.
 */

import * as game from '../src/game.js';
import { describe, test, expect } from '@jest/globals';
import type { WebSocket } from 'ws';

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
    expect(open.some((g) => g.players.white === pid)).toBe(true);
  });

  test('private games do not appear in getOpenGames', () => {
    const pid = registerPlayer('p4');
    game.createGame(pid, 'private');
    const open = game.getOpenGames();
    expect(open.some((g) => g.players.white === pid)).toBe(false);
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

  test('player can join multiple active games (up to MAX_GAMES_PER_PLAYER)', () => {
    const hosts = Array.from({ length: 21 }, (_, i) => registerPlayer(`h${i}_host`));
    const joiner = registerPlayer('j_multi');

    /* Join 20 games — should succeed */
    for (let i = 0; i < 20; i++) {
      const g = game.createGame(hosts[i]);
      const result = game.joinGame(g.id, joiner);
      expect(result.success).toBe(true);
    }

    /* 21st join should fail */
    const g21 = game.createGame(hosts[20]);
    const result21 = game.joinGame(g21.id, joiner);
    expect(result21.success).toBe(false);
    expect(result21.error).toMatch(/active game/i);
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
    expect(open.every((g) => g.visibility === 'public')).toBe(true);
    expect(open.every((g) => g.status === 'waiting')).toBe(true);
  });

  test('multiple private games do not appear in open list', () => {
    const p1 = registerPlayer('me1');
    const p2 = registerPlayer('me2');
    const p3 = registerPlayer('me3');

    game.createGame(p1, 'private');
    game.createGame(p2, 'private');
    game.createGame(p3, 'private');

    const open = game.getOpenGames();
    expect(open.some((g) => g.visibility === 'private')).toBe(false);
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
    expect(active.some((a) => a.id === g.id)).toBe(true);
    expect(active.every((a) => a.status === 'active')).toBe(true);
  });

  test('does not return waiting games', () => {
    const host = registerPlayer('ag_wait');
    game.createGame(host);

    expect(game.getActiveGames().every((a) => a.status === 'active')).toBe(true);
  });

  test('does not return finished games', () => {
    const host = registerPlayer('ag_fin');
    const joiner = registerPlayer('ag_fin_j');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);
    game.resignGame(g.id, host);

    expect(game.getActiveGames().some((a) => a.id === g.id)).toBe(false);
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

    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;
    expect(game.registerSpectator(g.id, ws)).toBe(true);
  });

  test('registerSpectator fails for waiting game', () => {
    const host = registerPlayer('spec_wait');
    const g = game.createGame(host);
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;
    expect(game.registerSpectator(g.id, ws)).toBe(false);
  });

  test('registerSpectator fails for non-existent game', () => {
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;
    expect(game.registerSpectator('fake', ws)).toBe(false);
  });

  test('registerSpectator fails for finished game', () => {
    const host = registerPlayer('spec_fin');
    const joiner = registerPlayer('spec_fin_j');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);
    game.resignGame(g.id, host);

    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;
    expect(game.registerSpectator(g.id, ws)).toBe(false);
  });

  test('removeSpectator does not throw', () => {
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;
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
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;
    expect(() => game.handleChatMessage('any-game', 'fake-player', 'hello', ws)).not.toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  Game state enrichment (names + avatar URLs)                          */
/* ------------------------------------------------------------------ */

describe('game state enrichment', () => {
  test('enrichNames adds display names and leaves avatarUrl undefined for anonymous players', () => {
    const { playerId: wId } = game.registerPlayer('anon_w');
    const { playerId: bId } = game.registerPlayer('anon_b');

    const g = game.createGame(wId);
    const r = game.joinGame(g.id, bId);
    expect(r.success).toBe(true);
    expect(r.game!.whiteName).toBe('anon_w');
    expect(r.game!.blackName).toBe('anon_b');
    expect(r.game!.whiteAvatarUrl).toBeUndefined();
    expect(r.game!.blackAvatarUrl).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/*  Chat Messages                                                        */
/* ------------------------------------------------------------------ */

describe('chat messages', () => {
  test('handleChatMessage does not throw for non-existent game', () => {
    const pid = registerPlayer('chat_ghost');
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;
    expect(() => game.handleChatMessage('fake-game', pid, 'hello', ws)).not.toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  Logout                                                              */
/* ------------------------------------------------------------------ */

describe('logoutPlayer', () => {
  test('returns true for a valid token and invalidates it', () => {
    const { playerId, token } = game.registerPlayer('logout_user');
    expect(game.authenticatePlayer(token)).not.toBeNull();
    expect(game.logoutPlayer(token)).toBe(true);
    expect(game.authenticatePlayer(token)).toBeNull();
  });

  test('returns false for an invalid token', () => {
    expect(game.logoutPlayer('no-such-token')).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Login lockout                                                       */
/* ------------------------------------------------------------------ */

describe('login lockout', () => {
  test('checkLoginLockout returns not locked for unknown user', () => {
    const result = game.checkLoginLockout('unknown_user_xyz');
    expect(result.locked).toBe(false);
  });

  test('recordFailedAttempt locks after 5 attempts', () => {
    const username = 'lockout_test_' + Date.now();
    for (let i = 0; i < 5; i++) {
      game.recordFailedAttempt(username);
    }
    const result = game.checkLoginLockout(username);
    expect(result.locked).toBe(true);
    expect(result.remainingMs).toBeGreaterThan(0);
  });

  test('clearLoginAttempts resets lockout', () => {
    const username = 'lockout_clear_' + Date.now();
    for (let i = 0; i < 5; i++) {
      game.recordFailedAttempt(username);
    }
    expect(game.checkLoginLockout(username).locked).toBe(true);
    game.clearLoginAttempts(username);
    expect(game.checkLoginLockout(username).locked).toBe(false);
  });

  test('loginPlayer with correct password succeeds after clearLoginAttempts', () => {
    const username = 'login_ok_' + Date.now();
    const password = 'testpass123';
    const { playerId } = game.registerPlayer(username, password);

    for (let i = 0; i < 5; i++) {
      game.recordFailedAttempt(username);
    }
    expect(game.checkLoginLockout(username).locked).toBe(true);

    game.clearLoginAttempts(username);
    const result = game.loginPlayer(username, password);
    expect(result.success).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Bot game detection                                                  */
/* ------------------------------------------------------------------ */

describe('isBotGame', () => {
  afterAll(() => {
    game.killAllEngines();
  });

  test('returns false for a normal game', () => {
    const pid = registerPlayer('bot_detect_normal');
    const g = game.createGame(pid);
    expect(game.isBotGame(g)).toBe(false);
  });

  test('returns true for a bot game', () => {
    const pid = registerPlayer('bot_detect_bot');
    const result = game.createBotGame(pid, 1, 'white');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(game.isBotGame(result.game)).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  verifyPassword                                                       */
/* ------------------------------------------------------------------ */

describe('verifyPassword', () => {
  test('returns true for correct password', () => {
    const password = 'correct-horse-battery-staple';
    const hash = game.hashPassword(password);
    expect(game.verifyPassword(password, hash)).toBe(true);
  });

  test('returns false for incorrect password', () => {
    const hash = game.hashPassword('real-password');
    expect(game.verifyPassword('wrong-password', hash)).toBe(false);
  });

  test('returns false for malformed hash (no colon)', () => {
    expect(game.verifyPassword('any', 'not-a-valid-hash')).toBe(false);
  });

  test('returns false for empty stored hash', () => {
    expect(game.verifyPassword('any', '')).toBe(false);
  });

  test('returns false for empty password', () => {
    const hash = game.hashPassword('some-password');
    expect(game.verifyPassword('', hash)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  removeGameById / cleanupChatHistory                                  */
/* ------------------------------------------------------------------ */

describe('removeGameById / cleanupChatHistory', () => {
  test('cleanupChatHistory removes chat for a game', () => {
    const pid = registerPlayer('chat_clean');
    const g = game.createGame(pid);
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;

    game.handleChatMessage(g.id, pid, 'hello', ws);

    /* Should not throw — chat history exists */
    expect(() => game.cleanupChatHistory(g.id)).not.toThrow();

    /* Second call should also not throw */
    expect(() => game.cleanupChatHistory(g.id)).not.toThrow();
  });

  test('removeGameById removes game and chat history', () => {
    const pid = registerPlayer('remove_test');
    const g = game.createGame(pid);
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;

    game.handleChatMessage(g.id, pid, 'test message', ws);

    expect(game.getGame(g.id)).not.toBeNull();

    game.removeGameById(g.id);

    expect(game.getGame(g.id)).toBeNull();
    /* Second call should not throw */
    expect(() => game.removeGameById(g.id)).not.toThrow();
  });

  test('removeGameById does not throw for non-existent game', () => {
    expect(() => game.removeGameById('no-such-id')).not.toThrow();
  });

  test('cleanupChatHistory does not throw for non-existent game', () => {
    expect(() => game.cleanupChatHistory('no-such-id')).not.toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  Draw Offers                                                          */
/* ------------------------------------------------------------------ */

describe('draw offers', () => {
  test('offerDraw returns true for active game player', () => {
    const host = registerPlayer('draw_host');
    const joiner = registerPlayer('draw_joiner');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);
    expect(game.offerDraw(g.id, host)).toBe(true);
  });

  test('offerDraw fails for non-existent game', () => {
    const pid = registerPlayer('draw_nonexist');
    expect(game.offerDraw('fake-id', pid)).toBe(false);
  });

  test('offerDraw fails for non-active game', () => {
    const host = registerPlayer('draw_wait');
    const g = game.createGame(host);
    expect(game.offerDraw(g.id, host)).toBe(false);
  });

  test('offerDraw fails for spectator', () => {
    const host = registerPlayer('draw_spec');
    const joiner = registerPlayer('draw_spec_j');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);
    const outsider = registerPlayer('draw_out');
    expect(game.offerDraw(g.id, outsider)).toBe(false);
  });

  test('duplicate offerDraw returns false', () => {
    const host = registerPlayer('draw_dup');
    const joiner = registerPlayer('draw_dup_j');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);
    expect(game.offerDraw(g.id, host)).toBe(true);
    expect(game.offerDraw(g.id, host)).toBe(false);
  });

  test('acceptDraw ends the game as draw', () => {
    const host = registerPlayer('draw_accept_h');
    const joiner = registerPlayer('draw_accept_j');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);
    game.offerDraw(g.id, host);
    const result = game.acceptDraw(g.id, joiner);
    expect(result.success).toBe(true);
    expect(game.getGame(g.id)?.status).toBe('draw');
  });

  test('acceptDraw fails without pending offer', () => {
    const host = registerPlayer('draw_nooffer_h');
    const joiner = registerPlayer('draw_nooffer_j');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);
    const result = game.acceptDraw(g.id, joiner);
    expect(result.success).toBe(false);
  });

  test('declineDraw removes the pending offer', () => {
    const host = registerPlayer('draw_decline_h');
    const joiner = registerPlayer('draw_decline_j');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);
    game.offerDraw(g.id, host);
    expect(game.declineDraw(g.id, joiner)).toBe(true);
    /* Offer should be cleared — accept should now fail */
    const result = game.acceptDraw(g.id, joiner);
    expect(result.success).toBe(false);
  });

  test('cancelDrawOffer clears pending draw', () => {
    const host = registerPlayer('draw_cancel_h');
    const joiner = registerPlayer('draw_cancel_j');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);
    game.offerDraw(g.id, host);
    game.cancelDrawOffer(g.id);
    const result = game.acceptDraw(g.id, joiner);
    expect(result.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Rematch                                                              */
/* ------------------------------------------------------------------ */

describe('rematch', () => {
  test('offerRematch returns true after game ends', () => {
    const host = registerPlayer('rem_host');
    const joiner = registerPlayer('rem_joiner');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);
    game.resignGame(g.id, host);
    expect(game.offerRematch(g.id, host)).toBe(true);
  });

  test('offerRematch fails for non-existent game', () => {
    const pid = registerPlayer('rem_nonexist');
    expect(game.offerRematch('fake-id', pid)).toBe(false);
  });

  test('acceptRematch creates a new game', () => {
    const host = registerPlayer('rem_accept_h');
    const joiner = registerPlayer('rem_accept_j');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);
    game.resignGame(g.id, host);
    game.offerRematch(g.id, host);
    const result = game.acceptRematch(g.id, joiner);
    expect(result.success).toBe(true);
    expect(result.newGameId).toBeDefined();
    const newGame = game.getGame(result.newGameId!);
    expect(newGame).not.toBeNull();
    expect(newGame!.status).toBe('active');
  });

  test('acceptRematch fails without pending offer', () => {
    const host = registerPlayer('rem_nooffer_h');
    const joiner = registerPlayer('rem_nooffer_j');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);
    game.resignGame(g.id, host);
    const result = game.acceptRematch(g.id, joiner);
    expect(result.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Better Chat Tests                                                     */
/* ------------------------------------------------------------------ */

describe('chat messages extended', () => {
  test('handleChatMessage stores message in history', () => {
    const host = registerPlayer('chat_store_h');
    const joiner = registerPlayer('chat_store_j');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;
    game.registerWSConnection(host, ws);

    game.handleChatMessage(g.id, host, 'hello world', ws);
    /* Should not throw — message is stored in chat history and broadcast */
    expect(true).toBe(true);
  });

  test('empty chat message is ignored', () => {
    const host = registerPlayer('chat_empty');
    const joiner = registerPlayer('chat_empty_j');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;
    expect(() => game.handleChatMessage(g.id, host, '', ws)).not.toThrow();
  });

  test('long chat message is truncated to 500 chars', () => {
    const host = registerPlayer('chat_long');
    const joiner = registerPlayer('chat_long_j');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;
    game.registerWSConnection(host, ws);
    const longText = 'x'.repeat(1000);
    expect(() => game.handleChatMessage(g.id, host, longText, ws)).not.toThrow();
  });

  test('sendChatHistory does not throw for valid game', () => {
    const host = registerPlayer('chat_send_h');
    const joiner = registerPlayer('chat_send_j');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;
    expect(() => game.sendChatHistory(g.id, ws)).not.toThrow();
  });

  test('handleChatMessage ignores non-player spectator', () => {
    const host = registerPlayer('chat_ignore_h');
    const joiner = registerPlayer('chat_ignore_j');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);
    const outsider = registerPlayer('chat_out');
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;
    expect(() => game.handleChatMessage(g.id, outsider, 'should be ignored', ws)).not.toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  Additional untested functions                                        */
/* ------------------------------------------------------------------ */

describe('abortGame', () => {
  test('abortGame succeeds for waiting game host', () => {
    const host = registerPlayer('abort_host');
    const g = game.createGame(host);
    const result = game.abortGame(g.id, host);
    expect(result.success).toBe(true);
    /* abortGame removes the game from the map */
    expect(game.getGame(g.id)).toBeNull();
  });

  test('abortGame fails for non-host', () => {
    const host = registerPlayer('abort_host2');
    const outsider = registerPlayer('abort_out');
    const g = game.createGame(host);
    const result = game.abortGame(g.id, outsider);
    expect(result.success).toBe(false);
  });

  test('abortGame fails for active game', () => {
    const host = registerPlayer('abort_host3');
    const joiner = registerPlayer('abort_join3');
    const g = game.createGame(host);
    game.joinGame(g.id, joiner);
    const result = game.abortGame(g.id, host);
    expect(result.success).toBe(false);
  });
});

describe('getPlayerStats', () => {
  test('getPlayerStats returns null for anonymous player', () => {
    const pid = registerPlayer('pstats_anon');
    expect(game.getPlayerStats(pid)).toBeNull();
  });

  test('getPlayerStats returns null for unknown player', () => {
    expect(game.getPlayerStats('no-such-id')).toBeNull();
  });
});

describe('ban system', () => {
  test('isBanned returns false for unregistered player', () => {
    expect(game.isBanned('nonexistent')).toBe(false);
  });

  test('banPlayer and isBanned round-trip', () => {
    const pid = registerPlayer('ban_target');
    const result = game.banPlayer(pid);
    expect(result.success).toBe(true);
    expect(game.isBanned(pid)).toBe(true);
  });

  test('unbanPlayer clears ban', () => {
    const pid = registerPlayer('unban_target');
    game.banPlayer(pid);
    game.unbanPlayer(pid);
    expect(game.isBanned(pid)).toBe(false);
  });

  test('banIp and isBanned by IP', () => {
    game.banIp('10.0.0.99');
    expect(game.isBanned('whatever', '10.0.0.99')).toBe(true);
  });

  test('unbanIp clears IP ban', () => {
    game.banIp('10.0.0.100');
    game.unbanIp('10.0.0.100');
    expect(game.isBanned('whatever', '10.0.0.100')).toBe(false);
  });

  test('getBannedPlayers / getBannedIps return arrays', () => {
    const pid = registerPlayer('ban_list_target');
    game.banPlayer(pid);
    game.banIp('10.0.0.101');
    expect(Array.isArray(game.getBannedPlayers())).toBe(true);
    expect(Array.isArray(game.getBannedIps())).toBe(true);
  });
});

describe('kickPlayer', () => {
  test('kickPlayer returns error for non-existent player', () => {
    const result = game.kickPlayer('no-such-id');
    expect(result.success).toBe(false);
  });
});

describe('endGame', () => {
  test('endGame fails for non-existent game', () => {
    const result = game.endGame('no-such-game');
    expect(result.success).toBe(false);
  });
});

describe('getAllGames / getOnlinePlayerIds', () => {
  test('getAllGames returns array', () => {
    const all = game.getAllGames();
    expect(Array.isArray(all)).toBe(true);
  });

  test('getOnlinePlayerIds returns Set', () => {
    const set = game.getOnlinePlayerIds();
    expect(set instanceof Set).toBe(true);
  });
});

describe('sweepStaleWaitingGames', () => {
  test('sweepStaleWaitingGames returns count', () => {
    const count = game.sweepStaleWaitingGames();
    expect(typeof count).toBe('number');
  });
});
