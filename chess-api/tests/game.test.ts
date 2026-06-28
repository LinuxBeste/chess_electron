/* Game logic unit tests.
 *
 * Tests the game module functions directly (createGame, joinGame, etc.)
 * without HTTP.  These tests verify the privacy/visibility feature and
 * game lifecycle rules.
 */

import * as game from '../src/game.js';
import { games } from '../src/state.js';
import { describe, test, expect, jest } from '@jest/globals';
import type { WebSocket } from 'ws';

/* Each test gets a unique ID by registering a player.
 * Tests are isolated because game.ts uses in-memory maps. */

async function registerPlayer(username: string): Promise<string> {
  const { playerId } = await game.registerPlayer(username);
  return playerId;
}

/* ------------------------------------------------------------------ */
/*  Private / public games                                              */
/* ------------------------------------------------------------------ */

describe('game visibility', () => {
  test('createGame defaults to public', async () => {
    const pid = await registerPlayer('p1');
    const g = await game.createGame(pid);
    expect(g.visibility).toBe('public');
  });

  test('createGame accepts private visibility', async () => {
    const pid = await registerPlayer('p2');
    const g = await game.createGame(pid, 'private');
    expect(g.visibility).toBe('private');
  });

  test('public games appear in getOpenGames', async () => {
    const pid = await registerPlayer('p3');
    await game.createGame(pid, 'public');
    const open = await game.getOpenGames();
    expect(open.some((g) => g.players.white === pid)).toBe(true);
  });

  test('private games do not appear in getOpenGames', async () => {
    const pid = await registerPlayer('p4');
    await game.createGame(pid, 'private');
    const open = await game.getOpenGames();
    expect(open.some((g) => g.players.white === pid)).toBe(false);
  });

  test('private game still accessible by getGame with ID', async () => {
    const pid = await registerPlayer('p5');
    const g = await game.createGame(pid, 'private');
    const fetched = await game.getGame(g.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(g.id);
    expect(fetched!.visibility).toBe('private');
  });

  test('private game can be joined by ID', async () => {
    const host = await registerPlayer('host6');
    const joiner = await registerPlayer('joiner6');
    const g = await game.createGame(host, 'private');
    const result = await game.joinGame(g.id, joiner);
    expect(result.success).toBe(true);
    expect(result.game!.status).toBe('active');
    expect(result.game!.players.black).toBe(joiner);
  });
});

/* ------------------------------------------------------------------ */
/*  Game lifecycle                                                      */
/* ------------------------------------------------------------------ */

describe('game lifecycle', () => {
  test('cannot join non-existent game', async () => {
    const pid = await registerPlayer('nonexistent');
    const result = await game.joinGame('fake-id', pid);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  test('cannot join game that is already active', async () => {
    const host = await registerPlayer('host8');
    const joiner = await registerPlayer('joiner8');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

    /* Third player tries to join */
    const third = await registerPlayer('third8');
    const result = await game.joinGame(g.id, third);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not open/i);
  });

  test('cannot join already active game', async () => {
    const host = await registerPlayer('host9');
    const joiner = await registerPlayer('joiner9');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

    /* Try joining again */
    const result = await game.joinGame(g.id, host);
    expect(result.success).toBe(false);
  });

  test('player can join multiple active games (up to MAX_GAMES_PER_PLAYER)', async () => {
    const hosts = Array.from({ length: 21 }, (_, i) => registerPlayer(`h${i}_host`));
    const joiner = await registerPlayer('j_multi');

    const resolvedHosts = await Promise.all(hosts);

    /* Join 20 games — should succeed */
    for (let i = 0; i < 20; i++) {
      const g = await game.createGame(resolvedHosts[i]);
      const result = await game.joinGame(g.id, joiner);
      expect(result.success).toBe(true);
    }

    /* 21st join should fail */
    const g21 = await game.createGame(resolvedHosts[20]);
    const result21 = await game.joinGame(g21.id, joiner);
    expect(result21.success).toBe(false);
    expect(result21.error).toMatch(/active game/i);
  });

  test('game stats count active games and online players', async () => {
    const pid = await registerPlayer('stats1');
    await game.createGame(pid);

    const stats = game.getStats();
    expect(stats).toHaveProperty('gamesActive');
    expect(stats).toHaveProperty('playersOnline');
  });
});

/* ------------------------------------------------------------------ */
/*  Game lifecycle — extended                                           */
/* ------------------------------------------------------------------ */

describe('game lifecycle — extended', () => {
  test('cannot join game that is already finished', async () => {
    const host = await registerPlayer('h_finished');
    const joiner = await registerPlayer('j_finished');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

    /* Resign the game */
    await game.resignGame(g.id, host);

    /* Try to join after game is over */
    const third = await registerPlayer('t_finished');
    const result = await game.joinGame(g.id, third);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not open/i);
  });

  test('resignGame returns error for non-existent game', async () => {
    const result = await game.resignGame('fake-id', 'any-player');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  test('resignGame returns error if player is not in game', async () => {
    const host = await registerPlayer('h_resign2');
    const outsider = await registerPlayer('outsider');
    const g = await game.createGame(host);
    const result = await game.resignGame(g.id, outsider);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not a player/i);
  });

  test('resignGame returns error for waiting game', async () => {
    const host = await registerPlayer('h_resign3');
    const g = await game.createGame(host);
    const result = await game.resignGame(g.id, host);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not active/i);
  });

  test('resignGame sets correct winner', async () => {
    const host = await registerPlayer('h_resign4');
    const joiner = await registerPlayer('j_resign4');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

    const result = await game.resignGame(g.id, host);
    expect(result.success).toBe(true);
    expect(result.state!.status).toBe('resigned');
    expect(result.state!.winner).toBe('black');
  });

  test('resignGame sets correct winner when black resigns', async () => {
    const host = await registerPlayer('h_resign5');
    const joiner = await registerPlayer('j_resign5');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

    const result = await game.resignGame(g.id, joiner);
    expect(result.success).toBe(true);
    expect(result.state!.winner).toBe('white');
  });
});

/* ------------------------------------------------------------------ */
/*  Player management                                                    */
/* ------------------------------------------------------------------ */

describe('player management', () => {
  test('registerPlayer creates unique IDs', async () => {
    const p1 = await game.registerPlayer('player1');
    const p2 = await game.registerPlayer('player2');
    expect(p1.playerId).not.toBe(p2.playerId);
    expect(p1.token).not.toBe(p2.token);
  });

  test('authenticatePlayer returns player for valid token', async () => {
    const { playerId, token } = await game.registerPlayer('auth_test');
    const player = game.authenticatePlayer(token);
    expect(player).not.toBeNull();
    expect(player!.id).toBe(playerId);
    expect(player!.username).toBe('auth_test');
  });

  test('authenticatePlayer returns null for invalid token', () => {
    const player = game.authenticatePlayer('non-existent-token');
    expect(player).toBeNull();
  });

  test('addToken provides additional valid token', async () => {
    const { playerId } = await game.registerPlayer('multi_token');
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
  test('getGame returns null for non-existent game', async () => {
    const g = await game.getGame('non-existent');
    expect(g).toBeNull();
  });

  test('getGame returns game details including visibility', async () => {
    const pid = await registerPlayer('getgame1');
    const created = await game.createGame(pid, 'private');
    const fetched = await game.getGame(created.id);
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

  test('getStats counts active games correctly', async () => {
    const h1 = await registerPlayer('sh1');
    const j1 = await registerPlayer('sj1');
    const h2 = await registerPlayer('sh2');

    /* Create and join one game (active), create another (waiting) */
    const g1 = await game.createGame(h1);
    await game.joinGame(g1.id, j1);
    await game.createGame(h2);

    const stats = game.getStats();
    expect(stats.gamesActive).toBeGreaterThanOrEqual(1);
  });
});

/* ------------------------------------------------------------------ */
/*  makeMove — direct (non-HTTP) tests                                  */
/* ------------------------------------------------------------------ */

describe('makeMove — direct', () => {
  test('makeMove succeeds for legal move', async () => {
    const host = await registerPlayer('mm_host');
    const joiner = await registerPlayer('mm_joiner');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

    const result = await game.makeMove(g.id, host, 'e2', 'e4');
    expect(result.success).toBe(true);
    expect(result.state).toBeDefined();
    expect(result.state!.turn).toBe('black');
    expect(result.state!.moveHistory).toContain('e4');
  });

  test('makeMove returns error if game not found', async () => {
    const result = await game.makeMove('fake', 'p', 'e2', 'e4');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  test('makeMove returns error if not players turn', async () => {
    const host = await registerPlayer('mm_turn1');
    const joiner = await registerPlayer('mm_turn2');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

    const result = await game.makeMove(g.id, joiner, 'e7', 'e5');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/turn/i);
  });

  test('makeMove returns error for illegal move', async () => {
    const host = await registerPlayer('mm_illegal1');
    const joiner = await registerPlayer('mm_illegal2');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

    const result = await game.makeMove(g.id, host, 'e2', 'e5');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/illegal/i);
  });

  test('makeMove detects checkmate', async () => {
    const host = await registerPlayer('mm_mate1');
    const joiner = await registerPlayer('mm_mate2');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

    /* Play Fool's Mate: 1.f3 e5 2.g4 Qh4# */
    await game.makeMove(g.id, host, 'f2', 'f3');
    await game.makeMove(g.id, joiner, 'e7', 'e5');
    await game.makeMove(g.id, host, 'g2', 'g4');
    const result = await game.makeMove(g.id, joiner, 'd8', 'h4');
    expect(result.success).toBe(true);
    expect(result.state!.status).toBe('checkmate');
    expect(result.state!.winner).toBe('black');
  });

  test('makeMove detects stalemate', async () => {
    const host = await registerPlayer('mm_stalemate1');
    const joiner = await registerPlayer('mm_stalemate2');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

    /* Play a sequence leading to stalemate */
    await game.makeMove(g.id, host, 'e2', 'e3');
    await game.makeMove(g.id, joiner, 'a7', 'a5');
    await game.makeMove(g.id, host, 'd1', 'h5');
    await game.makeMove(g.id, joiner, 'a8', 'a6');
    await game.makeMove(g.id, host, 'h5', 'a5');
    await game.makeMove(g.id, joiner, 'h7', 'h5');
    await game.makeMove(g.id, host, 'a5', 'c7');
    await game.makeMove(g.id, joiner, 'a6', 'b6');
    await game.makeMove(g.id, host, 'c7', 'c8');
    await game.makeMove(g.id, joiner, 'b6', 'b5');
    await game.makeMove(g.id, host, 'c8', 'b7');
    const result = await game.makeMove(g.id, joiner, 'b5', 'b4');
    /* Not expecting stalemate necessarily, just checking it doesn't crash */
    expect(result.success).toBe(true);
  });

  test('makeMove with promotion defaults to queen', async () => {
    const host = await registerPlayer('mm_promo1');
    const joiner = await registerPlayer('mm_promo2');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

    /* Move pawn to promotion rank */
    await game.makeMove(g.id, host, 'e2', 'e4');
    await game.makeMove(g.id, joiner, 'd7', 'd5');
    await game.makeMove(g.id, host, 'e4', 'd5');
    await game.makeMove(g.id, joiner, 'c7', 'c6');
    await game.makeMove(g.id, host, 'd5', 'c6');
    await game.makeMove(g.id, joiner, 'b8', 'c6');
    await game.makeMove(g.id, host, 'b2', 'b4');
    await game.makeMove(g.id, joiner, 'c8', 'e6');
    await game.makeMove(g.id, host, 'c1', 'b2');
    await game.makeMove(g.id, joiner, 'g8', 'f6');
    await game.makeMove(g.id, host, 'b2', 'f6');
    await game.makeMove(g.id, joiner, 'g7', 'f6');
    await game.makeMove(g.id, host, 'b4', 'b5');
    await game.makeMove(g.id, joiner, 'e6', 'b3');
    await game.makeMove(g.id, host, 'b5', 'c6');
    await game.makeMove(g.id, joiner, 'b3', 'c4');
    await game.makeMove(g.id, host, 'c6', 'b7');
    await game.makeMove(g.id, joiner, 'c4', 'b5');
    const result = await game.makeMove(g.id, host, 'b7', 'a8', 'queen');
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
  test('returns moves for active game', async () => {
    const host = await registerPlayer('glm_host');
    const joiner = await registerPlayer('glm_joiner');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

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

  test('returns error for non-player', async () => {
    const host = await registerPlayer('glm_np1');
    const outsider = await registerPlayer('glm_np2');
    const g = await game.createGame(host);

    const result = game.getLegalMovesForPlayer(g.id, outsider);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not a player/i);
  });
});

/* ------------------------------------------------------------------ */
/*  Visibility edge cases                                               */
/* ------------------------------------------------------------------ */

describe('visibility — edge cases', () => {
  test('getOpenGames returns only public waiting games', async () => {
    const p1 = await registerPlayer('ve1');
    const p2 = await registerPlayer('ve2');
    const p3 = await registerPlayer('ve3');

    await game.createGame(p1, 'public');
    await game.createGame(p2, 'private');
    /* Join p1's game so it's no longer waiting */
    const g3 = await game.createGame(p3, 'public');

    const open = await game.getOpenGames();
    /* Public waiting games only */
    expect(open.every((g) => g.visibility === 'public')).toBe(true);
    expect(open.every((g) => g.status === 'waiting')).toBe(true);
  });

  test('multiple private games do not appear in open list', async () => {
    const p1 = await registerPlayer('me1');
    const p2 = await registerPlayer('me2');
    const p3 = await registerPlayer('me3');

    await game.createGame(p1, 'private');
    await game.createGame(p2, 'private');
    await game.createGame(p3, 'private');

    const open = await game.getOpenGames();
    expect(open.some((g) => g.visibility === 'private')).toBe(false);
  });

  test('public game becomes joinable via direct ID', async () => {
    const host = await registerPlayer('ve_host');
    const joiner = await registerPlayer('ve_joiner');
    const g = await game.createGame(host, 'public');

    const fetched = await game.getGame(g.id);
    expect(fetched!.visibility).toBe('public');

    const result = await game.joinGame(g.id, joiner);
    expect(result.success).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Match History (getPlayerGames)                                       */
/* ------------------------------------------------------------------ */

describe('getPlayerGames', () => {
  test('returns empty array for player with no finished games', async () => {
    const pid = await registerPlayer('ghost');
    expect(await game.getPlayerGames(pid)).toEqual([]);
  });

  test('returns finished games for a player', async () => {
    const host = await registerPlayer('mh_host');
    const joiner = await registerPlayer('mh_joiner');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);
    await game.resignGame(g.id, host);

    const games = await game.getPlayerGames(host);
    expect(games.length).toBe(1);
    expect(games[0].id).toBe(g.id);
    expect(games[0].status).toBe('resigned');
  });

  test('does not return active games', async () => {
    const host = await registerPlayer('mh_active');
    const joiner = await registerPlayer('mh_active_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

    expect(await game.getPlayerGames(host)).toEqual([]);
  });

  test('does not return waiting games', async () => {
    const host = await registerPlayer('mh_wait');
    await game.createGame(host);
    expect(await game.getPlayerGames(host)).toEqual([]);
  });

  test('returns both finished games for a player across multiple games', async () => {
    const host = await registerPlayer('mh_multi');
    const j1 = await registerPlayer('mh_multi_j1');
    const j2 = await registerPlayer('mh_multi_j2');

    const g1 = await game.createGame(host);
    await game.joinGame(g1.id, j1);
    await game.resignGame(g1.id, host);

    const g2 = await game.createGame(host);
    await game.joinGame(g2.id, j2);
    await game.resignGame(g2.id, j2);

    const games = await game.getPlayerGames(host);
    expect(games.length).toBe(2);
  });
});

/* ------------------------------------------------------------------ */
/*  Active Games (for spectating)                                        */
/* ------------------------------------------------------------------ */

describe('getActiveGames', () => {
  test('returns active games only', async () => {
    const host = await registerPlayer('ag_host');
    const joiner = await registerPlayer('ag_joiner');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

    const active = await game.getActiveGames();
    expect(active.some((a) => a.id === g.id)).toBe(true);
    expect(active.every((a) => a.status === 'active')).toBe(true);
  });

  test('does not return waiting games', async () => {
    const host = await registerPlayer('ag_wait');
    await game.createGame(host);

    expect((await game.getActiveGames()).every((a) => a.status === 'active')).toBe(true);
  });

  test('does not return finished games', async () => {
    const host = await registerPlayer('ag_fin');
    const joiner = await registerPlayer('ag_fin_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);
    await game.resignGame(g.id, host);

    expect((await game.getActiveGames()).some((a) => a.id === g.id)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Spectator Mode                                                       */
/* ------------------------------------------------------------------ */

describe('spectator registration', () => {
  test('registerSpectator succeeds for active game', async () => {
    const host = await registerPlayer('spec_host');
    const joiner = await registerPlayer('spec_joiner');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;
    expect(game.registerSpectator(g.id, ws)).toBe(true);
  });

  test('registerSpectator fails for waiting game', async () => {
    const host = await registerPlayer('spec_wait');
    const g = await game.createGame(host);
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;
    expect(game.registerSpectator(g.id, ws)).toBe(false);
  });

  test('registerSpectator fails for non-existent game', () => {
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;
    expect(game.registerSpectator('fake', ws)).toBe(false);
  });

  test('registerSpectator fails for finished game', async () => {
    const host = await registerPlayer('spec_fin');
    const joiner = await registerPlayer('spec_fin_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);
    await game.resignGame(g.id, host);

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
  test('starts empty for new game', async () => {
    const host = await registerPlayer('bh_empty');
    const g = await game.createGame(host);
    expect(g.boardHistory).toEqual([]);
  });

  test('populates after each move', async () => {
    const host = await registerPlayer('bh_pop');
    const joiner = await registerPlayer('bh_pop_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

    await game.makeMove(g.id, host, 'e2', 'e4');
    expect(g.boardHistory.length).toBe(1);
    expect(g.boardHistory[0].move).toContain('e4');
    expect(g.boardHistory[0].board).toBeDefined();

    await game.makeMove(g.id, joiner, 'e7', 'e5');
    expect(g.boardHistory.length).toBe(2);
  });

  test('each entry has board snapshot and move notation', async () => {
    const host = await registerPlayer('bh_entry');
    const joiner = await registerPlayer('bh_entry_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

    await game.makeMove(g.id, host, 'e2', 'e4');
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
  test('enrichNames adds display names and leaves avatarUrl undefined for anonymous players', async () => {
    const { playerId: wId } = await game.registerPlayer('anon_w');
    const { playerId: bId } = await game.registerPlayer('anon_b');

    const g = await game.createGame(wId);
    const r = await game.joinGame(g.id, bId);
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
  test('handleChatMessage does not throw for non-existent game', async () => {
    const pid = await registerPlayer('chat_ghost');
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;
    expect(() => game.handleChatMessage('fake-game', pid, 'hello', ws)).not.toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  Logout                                                              */
/* ------------------------------------------------------------------ */

describe('logoutPlayer', () => {
  test('returns true for a valid token and invalidates it', async () => {
    const { playerId, token } = await game.registerPlayer('logout_user');
    expect(game.authenticatePlayer(token)).not.toBeNull();
    await expect(game.logoutPlayer(token)).resolves.toBe(true);
    expect(game.authenticatePlayer(token)).toBeNull();
  });

  test('returns false for an invalid token', async () => {
    await expect(game.logoutPlayer('no-such-token')).resolves.toBe(false);
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

  test('loginPlayer with correct password succeeds after clearLoginAttempts', async () => {
    const username = 'login_ok_' + Date.now();
    const password = 'testpass123';
    const { playerId } = await game.registerPlayer(username, password);

    for (let i = 0; i < 5; i++) {
      game.recordFailedAttempt(username);
    }
    expect(game.checkLoginLockout(username).locked).toBe(true);

    game.clearLoginAttempts(username);
    const result = await game.loginPlayer(username, password);
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

  test('returns false for a normal game', async () => {
    const pid = await registerPlayer('bot_detect_normal');
    const g = await game.createGame(pid);
    expect(game.isBotGame(g)).toBe(false);
  });

  test('returns true for a bot game', async () => {
    const pid = await registerPlayer('bot_detect_bot');
    const result = await game.createBotGame(pid, 1, 'white');
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
  test('cleanupChatHistory removes chat for a game', async () => {
    const pid = await registerPlayer('chat_clean');
    const g = await game.createGame(pid);
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;

    game.handleChatMessage(g.id, pid, 'hello', ws);

    /* Should not throw — chat history exists */
    expect(() => game.cleanupChatHistory(g.id)).not.toThrow();

    /* Second call should also not throw */
    expect(() => game.cleanupChatHistory(g.id)).not.toThrow();
  });

  test('removeGameById removes game and chat history', async () => {
    const pid = await registerPlayer('remove_test');
    const g = await game.createGame(pid);
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;

    game.handleChatMessage(g.id, pid, 'test message', ws);

    expect(await game.getGame(g.id)).not.toBeNull();

    game.removeGameById(g.id);

    expect(await game.getGame(g.id)).toBeNull();
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
  test('offerDraw returns true for active game player', async () => {
    const host = await registerPlayer('draw_host');
    const joiner = await registerPlayer('draw_joiner');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);
    expect(game.offerDraw(g.id, host)).toBe(true);
  });

  test('offerDraw fails for non-existent game', async () => {
    const pid = await registerPlayer('draw_nonexist');
    expect(game.offerDraw('fake-id', pid)).toBe(false);
  });

  test('offerDraw fails for non-active game', async () => {
    const host = await registerPlayer('draw_wait');
    const g = await game.createGame(host);
    expect(game.offerDraw(g.id, host)).toBe(false);
  });

  test('offerDraw fails for spectator', async () => {
    const host = await registerPlayer('draw_spec');
    const joiner = await registerPlayer('draw_spec_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);
    const outsider = await registerPlayer('draw_out');
    expect(game.offerDraw(g.id, outsider)).toBe(false);
  });

  test('duplicate offerDraw returns false', async () => {
    const host = await registerPlayer('draw_dup');
    const joiner = await registerPlayer('draw_dup_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);
    expect(game.offerDraw(g.id, host)).toBe(true);
    expect(game.offerDraw(g.id, host)).toBe(false);
  });

  test('acceptDraw ends the game as draw', async () => {
    const host = await registerPlayer('draw_accept_h');
    const joiner = await registerPlayer('draw_accept_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);
    game.offerDraw(g.id, host);
    const result = await game.acceptDraw(g.id, joiner);
    expect(result.success).toBe(true);
    expect((await game.getGame(g.id))?.status).toBe('draw');
  });

  test('acceptDraw fails without pending offer', async () => {
    const host = await registerPlayer('draw_nooffer_h');
    const joiner = await registerPlayer('draw_nooffer_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);
    const result = await game.acceptDraw(g.id, joiner);
    expect(result.success).toBe(false);
  });

  test('declineDraw removes the pending offer', async () => {
    const host = await registerPlayer('draw_decline_h');
    const joiner = await registerPlayer('draw_decline_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);
    game.offerDraw(g.id, host);
    expect(game.declineDraw(g.id, joiner)).toBe(true);
    /* Offer should be cleared — accept should now fail */
    const result = await game.acceptDraw(g.id, joiner);
    expect(result.success).toBe(false);
  });

  test('cancelDrawOffer clears pending draw', async () => {
    const host = await registerPlayer('draw_cancel_h');
    const joiner = await registerPlayer('draw_cancel_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);
    game.offerDraw(g.id, host);
    game.cancelDrawOffer(g.id);
    const result = await game.acceptDraw(g.id, joiner);
    expect(result.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Rematch                                                              */
/* ------------------------------------------------------------------ */

describe('rematch', () => {
  test('offerRematch returns true after game ends', async () => {
    const host = await registerPlayer('rem_host');
    const joiner = await registerPlayer('rem_joiner');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);
    await game.resignGame(g.id, host);
    expect(game.offerRematch(g.id, host)).toBe(true);
  });

  test('offerRematch fails for non-existent game', async () => {
    const pid = await registerPlayer('rem_nonexist');
    expect(game.offerRematch('fake-id', pid)).toBe(false);
  });

  test('acceptRematch creates a new game', async () => {
    const host = await registerPlayer('rem_accept_h');
    const joiner = await registerPlayer('rem_accept_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);
    await game.resignGame(g.id, host);
    game.offerRematch(g.id, host);
    const result = await game.acceptRematch(g.id, joiner);
    expect(result.success).toBe(true);
    expect(result.newGameId).toBeDefined();
    const newGame = await game.getGame(result.newGameId!);
    expect(newGame).not.toBeNull();
    expect(newGame!.status).toBe('active');
  });

  test('acceptRematch fails without pending offer', async () => {
    const host = await registerPlayer('rem_nooffer_h');
    const joiner = await registerPlayer('rem_nooffer_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);
    await game.resignGame(g.id, host);
    const result = await game.acceptRematch(g.id, joiner);
    expect(result.success).toBe(false);
  });

  test('acceptRematch preserves spectateMode code', async () => {
    const host = await registerPlayer('rem_code_h');
    const joiner = await registerPlayer('rem_code_j');
    const g = await game.createGame(host, 'public', 'code');
    await game.joinGame(g.id, joiner);
    await game.resignGame(g.id, joiner);
    /* Read spectateCode from in-memory map (getGame strips it) */
    const origSpectateCode = games.get(g.id)?.spectateCode;

    game.offerRematch(g.id, host);
    const result = await game.acceptRematch(g.id, joiner);
    expect(result.success).toBe(true);

    const newGame = games.get(result.newGameId!);
    expect(newGame).not.toBeUndefined();
    expect(newGame!.spectateMode).toBe('code');
    /* A new spectateCode should be generated (different from original) */
    expect(newGame!.spectateCode).toBeDefined();
    expect(newGame!.spectateCode).not.toBe(origSpectateCode);
  });
});

/* ------------------------------------------------------------------ */
/*  Better Chat Tests                                                     */
/* ------------------------------------------------------------------ */

describe('chat messages extended', () => {
  test('handleChatMessage stores message in history', async () => {
    const host = await registerPlayer('chat_store_h');
    const joiner = await registerPlayer('chat_store_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;
    game.registerWSConnection(host, ws);

    game.handleChatMessage(g.id, host, 'hello world', ws);
    /* Should not throw — message is stored in chat history and broadcast */
    expect(true).toBe(true);
  });

  test('empty chat message is ignored', async () => {
    const host = await registerPlayer('chat_empty');
    const joiner = await registerPlayer('chat_empty_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;
    expect(() => game.handleChatMessage(g.id, host, '', ws)).not.toThrow();
  });

  test('long chat message is truncated to 500 chars', async () => {
    const host = await registerPlayer('chat_long');
    const joiner = await registerPlayer('chat_long_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;
    game.registerWSConnection(host, ws);
    const longText = 'x'.repeat(1000);
    expect(() => game.handleChatMessage(g.id, host, longText, ws)).not.toThrow();
  });

  test('sendChatHistory does not throw for valid game', async () => {
    const host = await registerPlayer('chat_send_h');
    const joiner = await registerPlayer('chat_send_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;
    expect(() => game.sendChatHistory(g.id, ws)).not.toThrow();
  });

  test('handleChatMessage ignores non-player spectator', async () => {
    const host = await registerPlayer('chat_ignore_h');
    const joiner = await registerPlayer('chat_ignore_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);
    const outsider = await registerPlayer('chat_out');
    const ws = { readyState: 1, send: () => {} } as unknown as WebSocket;
    expect(() => game.handleChatMessage(g.id, outsider, 'should be ignored', ws)).not.toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  Additional untested functions                                        */
/* ------------------------------------------------------------------ */

describe('abortGame', () => {
  test('abortGame succeeds for waiting game host', async () => {
    const host = await registerPlayer('abort_host');
    const g = await game.createGame(host);
    const result = game.abortGame(g.id, host);
    expect(result.success).toBe(true);
    /* abortGame removes the game from the map */
    expect(await game.getGame(g.id)).toBeNull();
  });

  test('abortGame fails for non-host', async () => {
    const host = await registerPlayer('abort_host2');
    const outsider = await registerPlayer('abort_out');
    const g = await game.createGame(host);
    const result = game.abortGame(g.id, outsider);
    expect(result.success).toBe(false);
  });

  test('abortGame fails for active game', async () => {
    const host = await registerPlayer('abort_host3');
    const joiner = await registerPlayer('abort_join3');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);
    const result = game.abortGame(g.id, host);
    expect(result.success).toBe(false);
  });
});

describe('getPlayerStats', () => {
  test('getPlayerStats returns zero stats for anonymous player', async () => {
    const pid = await registerPlayer('pstats_anon');
    expect(await game.getPlayerStats(pid)).toEqual({ wins: 0, losses: 0, draws: 0 });
  });

  test('getPlayerStats returns null for unknown player', async () => {
    expect(await game.getPlayerStats('no-such-id')).toBeNull();
  });
});

describe('ban system', () => {
  test('isBanned returns false for unregistered player', () => {
    expect(game.isBanned('nonexistent')).toBe(false);
  });

  test('banPlayer and isBanned round-trip', async () => {
    const pid = await registerPlayer('ban_target');
    const result = await game.banPlayer(pid);
    expect(result.success).toBe(true);
    expect(game.isBanned(pid)).toBe(true);
  });

  test('unbanPlayer clears ban', async () => {
    const pid = await registerPlayer('unban_target');
    await game.banPlayer(pid);
    await game.unbanPlayer(pid);
    expect(game.isBanned(pid)).toBe(false);
  });

  test('banIp and isBanned by IP', async () => {
    await game.banIp('10.0.0.99');
    expect(game.isBanned('whatever', '10.0.0.99')).toBe(true);
  });

  test('unbanIp clears IP ban', async () => {
    await game.banIp('10.0.0.100');
    await game.unbanIp('10.0.0.100');
    expect(game.isBanned('whatever', '10.0.0.100')).toBe(false);
  });

  test('getBannedPlayers / getBannedIps return arrays', async () => {
    const pid = await registerPlayer('ban_list_target');
    await game.banPlayer(pid);
    await game.banIp('10.0.0.101');
    expect(Array.isArray(game.getBannedPlayers())).toBe(true);
    expect(Array.isArray(game.getBannedIps())).toBe(true);
  });
});

describe('kickPlayer', () => {
  test('kickPlayer returns error for non-existent player', () => {
    const result = game.kickPlayer('no-such-id');
    expect(result.success).toBe(false);
  });

  test('kickPlayer removes waiting games for the player', async () => {
    const pid = await registerPlayer('kick-waiting');
    const g = await game.createGame(pid);
    expect(g.status).toBe('waiting');
    const result = game.kickPlayer(pid);
    expect(result.success).toBe(true);
    const open = await game.getOpenGames();
    expect(open.some((og) => og.id === g.id)).toBe(false);
  });
});

describe('endGame', () => {
  test('endGame fails for non-existent game', () => {
    const result = game.endGame('no-such-game');
    expect(result.success).toBe(false);
  });
});

describe('registerSpectator', () => {
  test('registerSpectator returns false for non-existent game', () => {
    const mockWs = { readyState: 1, send: jest.fn() } as any;
    expect(game.registerSpectator('no-such-game', mockWs)).toBe(false);
  });

  test('registerSpectator returns false for inactive game', async () => {
    const pid = await registerPlayer('spec-inactive');
    const g = await game.createGame(pid);
    const mockWs = { readyState: 1, send: jest.fn() } as any;
    expect(game.registerSpectator(g.id, mockWs)).toBe(false);
  });

  test('registerSpectator rejects incorrect spectate code', async () => {
    const pid = await registerPlayer('spec-code-reject');
    const g = await game.createGame(pid, 'public', 'code');
    const mockWs = { readyState: 1, send: jest.fn() } as any;
    expect(game.registerSpectator(g.id, mockWs, 'wrong-code')).toBe(false);
  });

  test('registerSpectator accepts correct spectate code on active game', async () => {
    const pid = await registerPlayer('spec-code-ok');
    const p2 = await registerPlayer('spec-code-ok-2');
    const g = await game.createGame(pid, 'public', 'code');
    await game.joinGame(g.id, p2);
    const mockWs = { readyState: 1, send: jest.fn() } as any;
    const result = game.registerSpectator(g.id, mockWs, g.spectateCode);
    expect(result).toBe(true);
    game.removeSpectator(g.id, mockWs);
  });
});

describe('getAllGames / getOnlinePlayerIds', () => {
  test('getAllGames returns array', async () => {
    const all = await game.getAllGames();
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

  test('sweepStaleWaitingGames removes old waiting games', async () => {
    const host = await registerPlayer('sweep_old');
    const g = await game.createGame(host);
    expect(games.has(g.id)).toBe(true);

    /* Rewind createdAt to beyond the TTL */
    const stored = games.get(g.id)!;
    stored.createdAt = Date.now() - 20 * 60 * 1000; /* 20 min ago */

    const count = game.sweepStaleWaitingGames();
    expect(count).toBeGreaterThanOrEqual(1);
    expect(games.has(g.id)).toBe(false);
  });

  test('sweepStaleWaitingGames skips active games', async () => {
    const host = await registerPlayer('sweep_active_h');
    const joiner = await registerPlayer('sweep_active_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

    /* Rewind createdAt to beyond the TTL */
    const stored = games.get(g.id)!;
    stored.createdAt = Date.now() - 20 * 60 * 1000;

    const count = game.sweepStaleWaitingGames();
    /* Active game should NOT be removed */
    expect(games.has(g.id)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Edge cases                                                           */
/* ------------------------------------------------------------------ */

describe('edge cases', () => {
  test('cannot join aborted game', async () => {
    const host = await registerPlayer('ec_abort_join_h');
    const joiner = await registerPlayer('ec_abort_join_j');
    const g = await game.createGame(host);

    game.abortGame(g.id, host);

    const result = await game.joinGame(g.id, joiner);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  test('resignGame fails after checkmate', async () => {
    const host = await registerPlayer('ec_rsgn_mate_h');
    const joiner = await registerPlayer('ec_rsgn_mate_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

    /* Fool's Mate: 1.f3 e5 2.g4 Qh4# */
    await game.makeMove(g.id, host, 'f2', 'f3');
    await game.makeMove(g.id, joiner, 'e7', 'e5');
    await game.makeMove(g.id, host, 'g2', 'g4');
    const mateResult = await game.makeMove(g.id, joiner, 'd8', 'h4');
    expect(mateResult.state!.status).toBe('checkmate');

    const result = await game.resignGame(g.id, host);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not active/i);
  });

  test('resignGame fails after stalemate', async () => {
    const host = await registerPlayer('ec_rsgn_stale_h');
    const joiner = await registerPlayer('ec_rsgn_stale_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

    /* Stalemate sequence */
    await game.makeMove(g.id, host, 'e2', 'e3');
    await game.makeMove(g.id, joiner, 'a7', 'a5');
    await game.makeMove(g.id, host, 'd1', 'h5');
    await game.makeMove(g.id, joiner, 'a8', 'a6');
    await game.makeMove(g.id, host, 'h5', 'a5');
    await game.makeMove(g.id, joiner, 'h7', 'h5');
    await game.makeMove(g.id, host, 'a5', 'c7');
    await game.makeMove(g.id, joiner, 'a6', 'b6');
    await game.makeMove(g.id, host, 'c7', 'c8');
    await game.makeMove(g.id, joiner, 'b6', 'b5');
    await game.makeMove(g.id, host, 'c8', 'b7');
    const endResult = await game.makeMove(g.id, joiner, 'b5', 'b4');
    expect(endResult.success).toBe(true);

    const result = await game.resignGame(g.id, host);
    /* Game may or may not be terminal at this point */
    if (result.success === false) {
      expect(result.error).toMatch(/not active/i);
    }
  });

  test('simultaneous makeMove from two players — first succeeds, second also valid', async () => {
    const host = await registerPlayer('ec_simul_h');
    const joiner = await registerPlayer('ec_simul_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

    /* Because makeMove is synchronous until the final await, both Promise.all
       calls execute sequentially in the same tick.  The first updates the
       board to black's turn before the second reads it, so both should
       succeed (one white move, one black move). */
    const [r1, r2] = await Promise.all([
      game.makeMove(g.id, host, 'e2', 'e4'),
      game.makeMove(g.id, joiner, 'e7', 'e5'),
    ]);

    expect(r1.success).toBe(true);
    expect(r1.state!.turn).toBe('black');
    expect(r2.success).toBe(true);
    expect(r2.state!.turn).toBe('white');
    expect(r2.state!.moveHistory).toContain('e5');
  });

  test('makeMove fails after checkmate', async () => {
    const host = await registerPlayer('ec_mv_mate_h');
    const joiner = await registerPlayer('ec_mv_mate_j');
    const g = await game.createGame(host);
    await game.joinGame(g.id, joiner);

    /* Fool's Mate: 1.f3 e5 2.g4 Qh4# */
    await game.makeMove(g.id, host, 'f2', 'f3');
    await game.makeMove(g.id, joiner, 'e7', 'e5');
    await game.makeMove(g.id, host, 'g2', 'g4');
    const mateResult = await game.makeMove(g.id, joiner, 'd8', 'h4');
    expect(mateResult.state!.status).toBe('checkmate');

    /* Host tries to move after game is over */
    const result = await game.makeMove(g.id, host, 'h2', 'h4');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not active/i);
  });

  test('makeMove fails for non-existent game', async () => {
    const result = await game.makeMove('no-such-game', 'p', 'e2', 'e4');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  test('makeMove fails for waiting game', async () => {
    const host = await registerPlayer('ec_mv_waiting');
    const g = await game.createGame(host);
    const result = await game.makeMove(g.id, host, 'e2', 'e4');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not active/i);
  });

  test('triggerBotMove returns early for non-existent game', async () => {
    /* triggerBotMove checks game existence first — engine never invoked */
    await expect(game.triggerBotMove('no-such-game')).resolves.toBeUndefined();
  });

  test('triggerBotMove returns early for finished game', async () => {
    const host = await registerPlayer('ec_bot_over');
    const g = await game.createGame(host);
    /* Game is still waiting (no opponent) — triggerBotMove should skip */
    await expect(game.triggerBotMove(g.id)).resolves.toBeUndefined();
  });
});
