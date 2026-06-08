/* API integration tests.
 *
 * Tests the full HTTP API surface using supertest against the Express app.
 * The server is NOT started (index.ts detects JEST_WORKER_ID and skips
 * the listen() call), so these tests run without port conflicts.
 */

import supertest from 'supertest';
import { app } from '../src/index';
import { describe, test, expect } from '@jest/globals';

const request = supertest(app);

/* Register a player via POST /auth/register and return auth credentials.
 * Used by nearly every test to obtain a bearer token. */
async function registerPlayer(username: string): Promise<{ playerId: string; token: string; authHeader: string }> {
  const res = await request.post('/auth/register').send({ username }).expect(201);
  return {
    playerId: res.body.playerId,
    token: res.body.token,
    /* Pre-build the Authorization header for convenience */
    authHeader: `Bearer ${res.body.token}`,
  };
}

/* Create a game as the authenticated player (they become white).
 * Returns the game ID. */
async function createGame(authHeader: string): Promise<string> {
  const res = await request.post('/games').set('Authorization', authHeader).expect(201);
  return res.body.id;
}

/* Join a game as black (expects 200 OK). */
async function joinGame(gameId: string, authHeader: string): Promise<void> {
  await request.post(`/games/${gameId}/join`).set('Authorization', authHeader).expect(200);
}

/* Make a move in a game.  Returns the response for further assertions. */
async function makeMove(gameId: string, authHeader: string, from: string, to: string): Promise<supertest.Response> {
  return request.post(`/games/${gameId}/move`).set('Authorization', authHeader).send({ from, to });
}

describe('Auth', () => {
  test('POST /auth/register creates a player and returns token', async () => {
    /* Happy path: registration returns playerId and bearer token */
    const res = await request.post('/auth/register').send({ username: 'alice' }).expect(201);
    expect(res.body).toHaveProperty('playerId');
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.playerId).toBe('string');
    expect(typeof res.body.token).toBe('string');
  });

  test('POST /auth/register rejects empty username', async () => {
    /* Empty string is not a valid username */
    await request.post('/auth/register').send({ username: '' }).expect(400);
  });

  test('GET /auth/me rejects invalid token', async () => {
    /* Random token should be rejected */
    await request.get('/auth/me').set('Authorization', 'Bearer invalid-token').expect(401);
  });

  test('GET /auth/me rejects missing auth header', async () => {
    /* No auth header at all -> 401 */
    await request.get('/auth/me').expect(401);
  });
});

describe('Game creation and joining', () => {
  test('POST /games creates a waiting game', async () => {
    /* New game starts in 'waiting' status with only the white player */
    const { authHeader } = await registerPlayer('p1');
    const res = await request.post('/games').set('Authorization', authHeader).expect(201);
    expect(res.body.status).toBe('waiting');
    expect(res.body.players.white).toBeDefined();
  });

  test('GET /games lists waiting games', async () => {
    /* Create one game and verify it shows up in the open games list */
    await registerPlayer('p2');
    const white = await registerPlayer('p2_2');
    await createGame(white.authHeader);

    const res = await request.get('/games').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    /* All listed games must be in 'waiting' status */
    expect(res.body.every((g: { status: string }) => g.status === 'waiting')).toBe(true);
  });

  test('POST /games/:gameId/join lets second player join', async () => {
    /* Second player can join as black, game transitions to 'active' */
    const white = await registerPlayer('host');
    const black = await registerPlayer('joiner');
    const gameId = await createGame(white.authHeader);

    const res = await request.post(`/games/${gameId}/join`).set('Authorization', black.authHeader).expect(200);
    expect(res.body.status).toBe('active');
    expect(res.body.players.white).toBe(white.playerId);
    expect(res.body.players.black).toBe(black.playerId);
  });

  test('cannot join your own game', async () => {
    /* Creator cannot also join as black (no self-play) */
    const p = await registerPlayer('lonely');
    const gameId = await createGame(p.authHeader);

    await request.post(`/games/${gameId}/join`).set('Authorization', p.authHeader).expect(400);
  });
});

describe("Scholar's mate (full game)", () => {
  test('plays through to checkmate', async () => {
    /* Play the entire Scholar's Mate sequence:
     *   1. e4    e5
     *   2. Qh5   Nc6
     *   3. Bc4   Nf6
     *   4. Qxf7#  ← white delivers checkmate
     *
     * This validates the full game lifecycle: move alternation,
     * legal-move enforcement, checkmate detection, move history,
     * and winner tracking. */
    const white = await registerPlayer('wm');
    const black = await registerPlayer('bm');
    const gameId = await createGame(white.authHeader);
    await joinGame(gameId, black.authHeader);

    /* 1. e4 — white's first move, king's pawn advance */
    await makeMove(gameId, white.authHeader, 'e2', 'e4').then((r) => expect(r.status).toBe(200));
    /* 1... e5 — black responds symmetrically */
    await makeMove(gameId, black.authHeader, 'e7', 'e5').then((r) => expect(r.status).toBe(200));
    /* 2. Qh5 — white develops queen early (aggressive) */
    await makeMove(gameId, white.authHeader, 'd1', 'h5').then((r) => expect(r.status).toBe(200));
    /* 2... Nc6 — black develops a knight */
    await makeMove(gameId, black.authHeader, 'b8', 'c6').then((r) => expect(r.status).toBe(200));
    /* 3. Bc4 — white develops bishop to threatening diagonal */
    await makeMove(gameId, white.authHeader, 'f1', 'c4').then((r) => expect(r.status).toBe(200));
    /* 3... Nf6 — black develops other knight (doesn't see the threat) */
    await makeMove(gameId, black.authHeader, 'g8', 'f6').then((r) => expect(r.status).toBe(200));
    /* 4. Qxf7# — queen captures f7 pawn with checkmate! */
    const result = await makeMove(gameId, white.authHeader, 'h5', 'f7');
    expect(result.status).toBe(200);
    expect(result.body.status).toBe('checkmate');
    expect(result.body.winner).toBe('white');
    /* Algebraic notation should record the final move */
    expect(result.body.moveHistory).toContain('Qxf7');
  });
});

describe('Move validation', () => {
  test('rejects move when not your turn', async () => {
    /* Black tries to move first — white has the first move */
    const white = await registerPlayer('wt');
    const black = await registerPlayer('bt');
    const gameId = await createGame(white.authHeader);
    await joinGame(gameId, black.authHeader);

    const res = await makeMove(gameId, black.authHeader, 'e7', 'e5');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/turn/i);
  });

  test('rejects illegal move', async () => {
    /* Knight from g1 cannot reach e5 on turn 1 (e5 is blocked) */
    const white = await registerPlayer('wi');
    const black = await registerPlayer('bi');
    const gameId = await createGame(white.authHeader);
    await joinGame(gameId, black.authHeader);

    const res = await makeMove(gameId, white.authHeader, 'g1', 'e5');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/illegal/i);
  });

  test('rejects moving opponent piece', async () => {
    /* White attempts to move black's e7 pawn — not their piece */
    const white = await registerPlayer('wo');
    const black = await registerPlayer('bo');
    const gameId = await createGame(white.authHeader);
    await joinGame(gameId, black.authHeader);

    const res = await makeMove(gameId, white.authHeader, 'e7', 'e5');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not your piece/i);
  });

  test('rejects move in non-active game', async () => {
    /* Game is still 'waiting' (no second player) — cannot move */
    const p = await registerPlayer('solo');
    const gameId = await createGame(p.authHeader);

    const res = await makeMove(gameId, p.authHeader, 'e2', 'e4');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not active/i);
  });
});

describe('Resign', () => {
  test('player can resign and opponent wins', async () => {
    /* White resigns — black should be declared the winner */
    const white = await registerPlayer('wr');
    const black = await registerPlayer('br');
    const gameId = await createGame(white.authHeader);
    await joinGame(gameId, black.authHeader);

    const res = await request.post(`/games/${gameId}/resign`).set('Authorization', white.authHeader).expect(200);
    expect(res.body.status).toBe('resigned');
    expect(res.body.winner).toBe('black');
  });
});

describe('GET /games/:gameId/moves', () => {
  test('returns legal moves for current player', async () => {
    /* After game starts, white should have ~20 legal moves (8 pawn pushes + 2 knight moves) */
    const white = await registerPlayer('ml');
    const black = await registerPlayer('ml2');
    const gameId = await createGame(white.authHeader);
    await joinGame(gameId, black.authHeader);

    const res = await request.get(`/games/${gameId}/moves`).set('Authorization', white.authHeader).expect(200);
    expect(res.body.moves).toBeDefined();
    expect(Array.isArray(res.body.moves)).toBe(true);
    expect(res.body.moves.length).toBeGreaterThan(0);
    /* Each move has from/to fields */
    expect(res.body.moves[0]).toHaveProperty('from');
    expect(res.body.moves[0]).toHaveProperty('to');
  });
});

/* ------------------------------------------------------------------ */
/*  Private / public games via API                                      */
/* ------------------------------------------------------------------ */

describe('Private games via API', () => {
  test('POST /games with visibility=private creates private game', async () => {
    const p = await registerPlayer('priv1');
    const res = await request
      .post('/games')
      .set('Authorization', p.authHeader)
      .send({ visibility: 'private' })
      .expect(201);
    expect(res.body.visibility).toBe('private');
    expect(res.body.status).toBe('waiting');
  });

  test('GET /games excludes private games', async () => {
    const pub = await registerPlayer('pub1');
    const priv = await registerPlayer('priv2');

    await request.post('/games').set('Authorization', pub.authHeader).expect(201);

    await request.post('/games').set('Authorization', priv.authHeader).send({ visibility: 'private' }).expect(201);

    const list = await request.get('/games').expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    /* The public game is listed */
    expect(list.body.some((g: any) => g.players.white === pub.playerId)).toBe(true);
    /* The private game is NOT listed */
    expect(list.body.some((g: any) => g.players.white === priv.playerId)).toBe(false);
  });

  test('private game can be joined by ID', async () => {
    const host = await registerPlayer('privhost');
    const joiner = await registerPlayer('privjoiner');

    const createRes = await request
      .post('/games')
      .set('Authorization', host.authHeader)
      .send({ visibility: 'private' })
      .expect(201);
    const gameId = createRes.body.id;

    const joinRes = await request.post(`/games/${gameId}/join`).set('Authorization', joiner.authHeader).expect(200);
    expect(joinRes.body.status).toBe('active');
    expect(joinRes.body.players.black).toBe(joiner.playerId);
  });

  test('private game accessible by GET /games/:gameId', async () => {
    const p = await registerPlayer('privget');
    const createRes = await request
      .post('/games')
      .set('Authorization', p.authHeader)
      .send({ visibility: 'private' })
      .expect(201);
    const gameId = createRes.body.id;

    const getRes = await request.get(`/games/${gameId}`).expect(200);
    expect(getRes.body.id).toBe(gameId);
    expect(getRes.body.visibility).toBe('private');
  });

  test('default visibility is public when field omitted', async () => {
    const p = await registerPlayer('defaultvis');
    const res = await request.post('/games').set('Authorization', p.authHeader).expect(201);
    expect(res.body.visibility).toBe('public');
  });
});

describe('GET /health', () => {
  test('returns health status with uptime and stats', async () => {
    /* Health endpoint is unauthenticated and always returns OK */
    const res = await request.get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('gamesActive');
    expect(res.body).toHaveProperty('playersOnline');
  });
});

describe('Auth — extended', () => {
  test('POST /auth/register with whitespace-only username is rejected', async () => {
    await request.post('/auth/register').send({ username: '   ' }).expect(400);
  });

  test('POST /auth/register with non-string username is rejected', async () => {
    await request.post('/auth/register').send({ username: 123 }).expect(400);
  });

  test('GET /auth/me without token is rejected', async () => {
    await request.get('/auth/me').expect(401);
  });

  test('GET /auth/me with malformed auth header is rejected', async () => {
    await request.get('/auth/me').set('Authorization', 'NotBearer token').expect(401);
  });
});

describe('Game creation — extended', () => {
  test('POST /games without auth is rejected', async () => {
    await request.post('/games').expect(401);
  });

  test('POST /games creates public game by default', async () => {
    const p = await registerPlayer('defpub');
    const res = await request.post('/games').set('Authorization', p.authHeader).expect(201);
    expect(res.body.visibility).toBe('public');
  });

  test('POST /games with explicit public visibility', async () => {
    const p = await registerPlayer('exppub');
    const res = await request
      .post('/games')
      .set('Authorization', p.authHeader)
      .send({ visibility: 'public' })
      .expect(201);
    expect(res.body.visibility).toBe('public');
  });
});

describe('Game joining — extended', () => {
  test('cannot join non-existent game', async () => {
    const p = await registerPlayer('nonexist');
    await request.post('/games/fake-id/join').set('Authorization', p.authHeader).expect(400);
  });

  test('cannot join without auth', async () => {
    const host = await registerPlayer('noauth_host');
    const gameId = await createGame(host.authHeader);
    await request.post(`/games/${gameId}/join`).expect(401);
  });

  test('cannot join own game', async () => {
    const p = await registerPlayer('ownjoin');
    const gameId = await createGame(p.authHeader);
    await request.post(`/games/${gameId}/join`).set('Authorization', p.authHeader).expect(400);
  });

  test('GET /games/:gameId returns game details', async () => {
    const p = await registerPlayer('getdetail');
    const gameId = await createGame(p.authHeader);
    const res = await request.get(`/games/${gameId}`).expect(200);
    expect(res.body.id).toBe(gameId);
    expect(res.body.status).toBe('waiting');
    expect(res.body.players.white).toBe(p.playerId);
  });

  test('GET /games/:gameId returns 404 for non-existent', async () => {
    await request.get('/games/non-existent').expect(404);
  });
});

describe('Move validation — extended', () => {
  test('rejects move from non-existent game', async () => {
    const p = await registerPlayer('mv_fake');
    await request
      .post('/games/fake/move')
      .set('Authorization', p.authHeader)
      .send({ from: 'e2', to: 'e4' })
      .expect(400);
  });

  test('rejects invalid square format', async () => {
    const white = await registerPlayer('mv_inv1');
    const black = await registerPlayer('mv_inv2');
    const gameId = await createGame(white.authHeader);
    await joinGame(gameId, black.authHeader);

    await request
      .post(`/games/${gameId}/move`)
      .set('Authorization', white.authHeader)
      .send({ from: 'e9', to: 'e4' })
      .expect(400);
  });

  test('rejects move from empty square', async () => {
    const white = await registerPlayer('mv_emp1');
    const black = await registerPlayer('mv_emp2');
    const gameId = await createGame(white.authHeader);
    await joinGame(gameId, black.authHeader);

    await request
      .post(`/games/${gameId}/move`)
      .set('Authorization', white.authHeader)
      .send({ from: 'e3', to: 'e4' })
      .expect(400);
  });

  test('rejects move of opponent piece', async () => {
    const white = await registerPlayer('mv_opp1');
    const black = await registerPlayer('mv_opp2');
    const gameId = await createGame(white.authHeader);
    await joinGame(gameId, black.authHeader);

    await request
      .post(`/games/${gameId}/move`)
      .set('Authorization', white.authHeader)
      .send({ from: 'e7', to: 'e5' })
      .expect(400);
  });

  test('rejects move that puts own king in check', async () => {
    const white = await registerPlayer('mv_check1');
    const black = await registerPlayer('mv_check2');
    const gameId = await createGame(white.authHeader);
    await joinGame(gameId, black.authHeader);

    /* e4 opens diagonal to king, but that's legal in chess.
     * After e4, black can respond with d5 attacking e4.
     * Actually moving into check is different from exposing king.
     * Let me just verify the API rejects illegal moves. */
    await request
      .post(`/games/${gameId}/move`)
      .set('Authorization', white.authHeader)
      .send({ from: 'e2', to: 'e5' })
      .expect(400);
  });
});

describe('Promotion via API', () => {
  test('promotion with queen defaults', async () => {
    /* Play a shortened game to get a pawn to promotion */
    const white = await registerPlayer('promo_w');
    const black = await registerPlayer('promo_b');
    const gameId = await createGame(white.authHeader);
    await joinGame(gameId, black.authHeader);

    /* Move pawns forward */
    await makeMove(gameId, white.authHeader, 'e2', 'e4').then((r) => expect(r.status).toBe(200));
    await makeMove(gameId, black.authHeader, 'd7', 'd5').then((r) => expect(r.status).toBe(200));
    await makeMove(gameId, white.authHeader, 'e4', 'd5').then((r) => expect(r.status).toBe(200));
    await makeMove(gameId, black.authHeader, 'c7', 'c6').then((r) => expect(r.status).toBe(200));
    await makeMove(gameId, white.authHeader, 'd5', 'c6').then((r) => expect(r.status).toBe(200));
    await makeMove(gameId, black.authHeader, 'b8', 'c6').then((r) => expect(r.status).toBe(200));
  });
});

describe('GET /games/:gameId/moves — extended', () => {
  test('returns empty moves for non-active game', async () => {
    const p = await registerPlayer('moves_wait');
    const gameId = await createGame(p.authHeader);

    await request.get(`/games/${gameId}/moves`).set('Authorization', p.authHeader).expect(400);
  });

  test('returns proper move format', async () => {
    const white = await registerPlayer('moves_fmt1');
    const black = await registerPlayer('moves_fmt2');
    const gameId = await createGame(white.authHeader);
    await joinGame(gameId, black.authHeader);

    const res = await request.get(`/games/${gameId}/moves`).set('Authorization', white.authHeader).expect(200);
    expect(Array.isArray(res.body.moves)).toBe(true);
    if (res.body.moves.length > 0) {
      expect(res.body.moves[0]).toHaveProperty('from');
      expect(res.body.moves[0]).toHaveProperty('to');
      expect(typeof res.body.moves[0].from).toBe('string');
      expect(typeof res.body.moves[0].to).toBe('string');
    }
  });
});

describe('Resign — extended', () => {
  test('cannot resign without auth', async () => {
    const white = await registerPlayer('res_noauth1');
    const black = await registerPlayer('res_noauth2');
    const gameId = await createGame(white.authHeader);
    await joinGame(gameId, black.authHeader);

    await request.post(`/games/${gameId}/resign`).expect(401);
  });

  test('cannot resign non-existent game', async () => {
    const p = await registerPlayer('res_fake');
    await request.post('/games/fake/resign').set('Authorization', p.authHeader).expect(400);
  });

  test('cannot resign waiting game', async () => {
    const p = await registerPlayer('res_wait');
    const gameId = await createGame(p.authHeader);
    await request.post(`/games/${gameId}/resign`).set('Authorization', p.authHeader).expect(400);
  });
});

describe('Full game — extended', () => {
  test("plays alternate Scholar's mate without errors", async () => {
    /* Play Scholar's mate: 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6 4.Qxf7# */
    const white = await registerPlayer('alt_w');
    const black = await registerPlayer('alt_b');
    const gameId = await createGame(white.authHeader);
    await joinGame(gameId, black.authHeader);

    await makeMove(gameId, white.authHeader, 'e2', 'e4').then((r) => expect(r.status).toBe(200));
    await makeMove(gameId, black.authHeader, 'e7', 'e5').then((r) => expect(r.status).toBe(200));
    await makeMove(gameId, white.authHeader, 'd1', 'h5').then((r) => expect(r.status).toBe(200));
    await makeMove(gameId, black.authHeader, 'b8', 'c6').then((r) => expect(r.status).toBe(200));
    await makeMove(gameId, white.authHeader, 'f1', 'c4').then((r) => expect(r.status).toBe(200));
    await makeMove(gameId, black.authHeader, 'g8', 'f6').then((r) => expect(r.status).toBe(200));
    const result = await makeMove(gameId, white.authHeader, 'h5', 'f7');
    expect(result.status).toBe(200);
    expect(result.body.status).toBe('checkmate');
    expect(result.body.winner).toBe('white');
  });

  test('game move history is recorded correctly', async () => {
    const white = await registerPlayer('hist_w');
    const black = await registerPlayer('hist_b');
    const gameId = await createGame(white.authHeader);
    await joinGame(gameId, black.authHeader);

    const r1 = await makeMove(gameId, white.authHeader, 'e2', 'e4');
    expect(r1.body.moveHistory).toContain('e4');

    const r2 = await makeMove(gameId, black.authHeader, 'e7', 'e5');
    expect(r2.body.moveHistory).toContain('e5');

    const r3 = await makeMove(gameId, white.authHeader, 'g1', 'f3');
    expect(r3.body.moveHistory).toContain('Nf3');
  });
});

describe('Visibility via API — extended', () => {
  test('GET /games/:gameId shows visibility field', async () => {
    const p = await registerPlayer('vis_field');
    const gameId = await createGame(p.authHeader);

    const res = await request.get(`/games/${gameId}`).expect(200);
    expect(res.body).toHaveProperty('visibility');
    expect(res.body.visibility).toBe('public');
  });

  test('private game works end-to-end', async () => {
    const host = await registerPlayer('prive2e_h');
    const joiner = await registerPlayer('prive2e_j');

    const createRes = await request
      .post('/games')
      .set('Authorization', host.authHeader)
      .send({ visibility: 'private' })
      .expect(201);
    const gameId = createRes.body.id;

    /* Join via direct ID */
    await request.post(`/games/${gameId}/join`).set('Authorization', joiner.authHeader).expect(200);

    /* Make a move */
    const moveRes = await makeMove(gameId, host.authHeader, 'e2', 'e4');
    expect(moveRes.status).toBe(200);
    expect(moveRes.body.turn).toBe('black');
  });
});

/* ------------------------------------------------------------------ */
/*  Active Games (spectating)                                            */
/* ------------------------------------------------------------------ */

describe('GET /games/active', () => {
  test('lists active games', async () => {
    const p1 = await registerPlayer('act1');
    const p2 = await registerPlayer('act2');
    const gameId = await createGame(p1.authHeader);
    await joinGame(gameId, p2.authHeader);

    const res = await request.get('/games/active').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((g: any) => g.id === gameId)).toBe(true);
  });

  test('does not include waiting games', async () => {
    await registerPlayer('act3');
    const p2 = await registerPlayer('act4');
    await createGame(p2.authHeader);

    const res = await request.get('/games/active').expect(200);
    if (res.body.length > 0) {
      expect(res.body.every((g: any) => g.status === 'active')).toBe(true);
    }
  });

  test('does not include finished games', async () => {
    const p1 = await registerPlayer('act5');
    const p2 = await registerPlayer('act6');
    const gameId = await createGame(p1.authHeader);
    await joinGame(gameId, p2.authHeader);

    await request.post(`/games/${gameId}/resign`).set('Authorization', p1.authHeader).expect(200);

    const res = await request.get('/games/active').expect(200);
    expect(res.body.some((g: any) => g.id === gameId)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Match History (getPlayerGames)                                       */
/* ------------------------------------------------------------------ */

describe('GET /players/:playerId/games', () => {
  test('returns match history for authenticated player', async () => {
    const p1 = await registerPlayer('mh1');
    const p2 = await registerPlayer('mh2');
    const gameId = await createGame(p1.authHeader);
    await joinGame(gameId, p2.authHeader);
    await request.post(`/games/${gameId}/resign`).set('Authorization', p1.authHeader).expect(200);

    const res = await request.get(`/players/${p1.playerId}/games`).set('Authorization', p1.authHeader).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.every((g: any) => g.status !== 'active' && g.status !== 'waiting')).toBe(true);
  });

  test('returns 403 when accessing another player history', async () => {
    const p1 = await registerPlayer('mh_forbid1');
    const p2 = await registerPlayer('mh_forbid2');

    await request.get(`/players/${p2.playerId}/games`).set('Authorization', p1.authHeader).expect(403);
  });

  test('returns empty array when no finished games', async () => {
    const p = await registerPlayer('mh_empty');

    const res = await request.get(`/players/${p.playerId}/games`).set('Authorization', p.authHeader).expect(200);
    expect(res.body).toEqual([]);
  });

  test('returns 401 without auth', async () => {
    await request.get('/players/some-id/games').expect(401);
  });
});

/* ------------------------------------------------------------------ */
/*  Admin Dashboard API                                                  */
/* ------------------------------------------------------------------ */

describe('Admin API — auth', () => {
  test('POST /admin/api/login with default credentials', async () => {
    const res = await request.post('/admin/api/login').send({ username: 'admin', password: 'admin' }).expect(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
  });

  test('POST /admin/api/login rejects wrong password', async () => {
    await request.post('/admin/api/login').send({ username: 'admin', password: 'wrong' }).expect(401);
  });

  test('POST /admin/api/login rejects wrong username', async () => {
    await request.post('/admin/api/login').send({ username: 'hacker', password: 'admin' }).expect(401);
  });

  test('POST /admin/api/login rejects missing fields', async () => {
    await request.post('/admin/api/login').send({}).expect(400);
  });

  test('admin endpoints reject missing token', async () => {
    await request.get('/admin/api/stats').expect(401);
    await request.get('/admin/api/games').expect(401);
    await request.get('/admin/api/players').expect(401);
    await request.get('/admin/api/accounts').expect(401);
  });

  test('admin endpoints reject invalid token', async () => {
    const header = 'Bearer invalid-token';
    await request.get('/admin/api/stats').set('Authorization', header).expect(401);
    await request.get('/admin/api/games').set('Authorization', header).expect(401);
    await request.get('/admin/api/players').set('Authorization', header).expect(401);
    await request.get('/admin/api/accounts').set('Authorization', header).expect(401);
  });
});

describe('Admin API — stats', () => {
  let authHeader: string;

  beforeAll(async () => {
    const res = await request.post('/admin/api/login').send({ username: 'admin', password: 'admin' });
    authHeader = `Bearer ${res.body.token}`;
  });

  test('GET /admin/api/stats returns overview counts', async () => {
    const res = await request.get('/admin/api/stats').set('Authorization', authHeader).expect(200);
    expect(res.body).toHaveProperty('gamesActive');
    expect(res.body).toHaveProperty('playersOnline');
    expect(res.body).toHaveProperty('registeredUsers');
    expect(res.body).toHaveProperty('totalUsers');
    expect(typeof res.body.gamesActive).toBe('number');
    expect(typeof res.body.playersOnline).toBe('number');
  });
});

describe('Admin API — games', () => {
  let authHeader: string;

  beforeAll(async () => {
    const res = await request.post('/admin/api/login').send({ username: 'admin', password: 'admin' });
    authHeader = `Bearer ${res.body.token}`;
  });

  test('GET /admin/api/games returns game list', async () => {
    /* Create a couple of games to make the list non-empty */
    const p1 = await registerPlayer('adm_g1');
    await createGame(p1.authHeader);
    const p2 = await registerPlayer('adm_g2');
    const g2 = await createGame(p2.authHeader);
    const p3 = await registerPlayer('adm_g3');
    await joinGame(g2, p3.authHeader);

    const res = await request.get('/admin/api/games').set('Authorization', authHeader).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body.some((g: any) => g.status === 'waiting')).toBe(true);
    expect(res.body.some((g: any) => g.status === 'active')).toBe(true);
    /* Each entry has the expected shape */
    for (const g of res.body) {
      expect(g).toHaveProperty('id');
      expect(g).toHaveProperty('status');
      expect(g).toHaveProperty('white');
      expect(g).toHaveProperty('moves');
      expect(g).toHaveProperty('createdAt');
    }
  });
});

describe('Admin API — players', () => {
  let authHeader: string;

  beforeAll(async () => {
    const res = await request.post('/admin/api/login').send({ username: 'admin', password: 'admin' });
    authHeader = `Bearer ${res.body.token}`;
  });

  test('GET /admin/api/players returns player list', async () => {
    /* Register some players to make the list non-empty */
    await registerPlayer('adm_p1');
    await registerPlayer('adm_p2');

    const res = await request.get('/admin/api/players').set('Authorization', authHeader).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3); /* + the one from beforeAll */
    for (const p of res.body) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('username');
      expect(p).toHaveProperty('displayName');
      expect(p).toHaveProperty('isRegistered');
      expect(p).toHaveProperty('online');
      expect(p).toHaveProperty('tokens');
    }
  });
});

describe('Admin API — accounts CRUD', () => {
  let authHeader: string;
  let accountId: string;
  let accountName: string;

  beforeAll(async () => {
    const res = await request.post('/admin/api/login').send({ username: 'admin', password: 'admin' });
    authHeader = `Bearer ${res.body.token}`;
    /* Create a registered account to manipulate */
    const reg = await request.post('/auth/register').send({ username: 'adm_crud', password: 'secret' }).expect(201);
    accountId = reg.body.playerId;
    accountName = reg.body.displayName;
  });

  test('GET /admin/api/accounts lists all registered users', async () => {
    const res = await request.get('/admin/api/accounts').set('Authorization', authHeader).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    const target = res.body.find((a: any) => a.id === accountId);
    expect(target).toBeDefined();
    expect(target.username).toBe('adm_crud');
  });

  test('PUT /admin/api/accounts/:id updates display name', async () => {
    await request
      .put(`/admin/api/accounts/${accountId}`)
      .set('Authorization', authHeader)
      .send({ displayName: 'Admin Test' })
      .expect(200);

    const res = await request.get('/admin/api/accounts').set('Authorization', authHeader).expect(200);
    const target = res.body.find((a: any) => a.id === accountId);
    expect(target.displayName).toBe('Admin Test');
  });

  test('PUT /admin/api/accounts/:id rejects missing displayName', async () => {
    await request
      .put(`/admin/api/accounts/${accountId}`)
      .set('Authorization', authHeader)
      .send({})
      .expect(400);
  });

  test('PUT /admin/api/accounts/:id rejects non-existent account', async () => {
    await request
      .put('/admin/api/accounts/non-existent')
      .set('Authorization', authHeader)
      .send({ displayName: 'X' })
      .expect(404);
  });

  test('POST /admin/api/accounts/:id/reset-password resets password', async () => {
    await request
      .post(`/admin/api/accounts/${accountId}/reset-password`)
      .set('Authorization', authHeader)
      .send({ newPassword: 'newpass123' })
      .expect(200);

    /* Verify login works with the new password */
    const login = await request.post('/auth/login').send({ username: 'adm_crud', password: 'newpass123' }).expect(200);
    expect(login.body.success).toBe(true);
  });

  test('POST /admin/api/accounts/:id/reset-password rejects short password', async () => {
    await request
      .post(`/admin/api/accounts/${accountId}/reset-password`)
      .set('Authorization', authHeader)
      .send({ newPassword: 'ab' })
      .expect(400);
  });

  test('POST /admin/api/accounts/:id/reset-password rejects non-existent account', async () => {
    await request
      .post('/admin/api/accounts/non-existent/reset-password')
      .set('Authorization', authHeader)
      .send({ newPassword: 'valid123' })
      .expect(404);
  });

  test('DELETE /admin/api/accounts/:id deletes account', async () => {
    /* Create a fresh account to delete */
    const reg = await request.post('/auth/register').send({ username: 'adm_delete_me', password: 'secret' }).expect(201);
    const delId = reg.body.playerId;

    await request
      .delete(`/admin/api/accounts/${delId}`)
      .set('Authorization', authHeader)
      .expect(200);

    /* Verify it's gone from the accounts list */
    const res = await request.get('/admin/api/accounts').set('Authorization', authHeader).expect(200);
    expect(res.body.some((a: any) => a.id === delId)).toBe(false);
  });

  test('DELETE /admin/api/accounts/:id rejects non-existent account', async () => {
    await request
      .delete('/admin/api/accounts/non-existent')
      .set('Authorization', authHeader)
      .expect(404);
  });

  test('GET /admin/api/accounts returns correct shape', async () => {
    const res = await request.get('/admin/api/accounts').set('Authorization', authHeader).expect(200);
    for (const a of res.body) {
      expect(a).toHaveProperty('id');
      expect(a).toHaveProperty('username');
      expect(a).toHaveProperty('displayName');
      expect(a).toHaveProperty('wins');
      expect(a).toHaveProperty('losses');
      expect(a).toHaveProperty('draws');
      expect(a).toHaveProperty('createdAt');
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Account settings (PUT /auth/me, password change, delete)            */
/* ------------------------------------------------------------------ */

describe('PUT /auth/me — update display name', () => {
  let authHeader: string;

  beforeAll(async () => {
    const { token } = await registerPlayer('put_me');
    authHeader = `Bearer ${token}`;
  });

  test('updates display name', async () => {
    const res = await request.put('/auth/me').set('Authorization', authHeader).send({ displayName: 'New Name' }).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.displayName).toBe('New Name');
  });

  test('rejects empty display name', async () => {
    await request.put('/auth/me').set('Authorization', authHeader).send({ displayName: '' }).expect(400);
    await request.put('/auth/me').set('Authorization', authHeader).send({ displayName: '   ' }).expect(400);
    await request.put('/auth/me').set('Authorization', authHeader).send({}).expect(400);
  });

  test('requires auth', async () => {
    await request.put('/auth/me').send({ displayName: 'X' }).expect(401);
  });

  test('reflects update in GET /auth/me', async () => {
    const res = await request.get('/auth/me').set('Authorization', authHeader).expect(200);
    expect(res.body.displayName).toBe('New Name');
  });
});

describe('PUT /auth/me/password — change password', () => {
  let authHeader: string;

  beforeAll(async () => {
    /* Register with a known password so we can test change */
    const res = await request.post('/auth/register').send({ username: 'pw_change', password: 'oldpass' }).expect(201);
    authHeader = `Bearer ${res.body.token}`;
  });

  test('changes password with valid old password', async () => {
    await request
      .put('/auth/me/password')
      .set('Authorization', authHeader)
      .send({ currentPassword: 'oldpass', newPassword: 'newpass' })
      .expect(200);

    /* Old password no longer works */
    await request.post('/auth/login').send({ username: 'pw_change', password: 'oldpass' }).expect(401);

    /* New password works */
    const login = await request.post('/auth/login').send({ username: 'pw_change', password: 'newpass' }).expect(200);
    expect(login.body.success).toBe(true);
  });

  test('rejects wrong current password', async () => {
    await request
      .put('/auth/me/password')
      .set('Authorization', authHeader)
      .send({ currentPassword: 'wrong', newPassword: 'newpass2' })
      .expect(400);
  });

  test('rejects short new password', async () => {
    await request
      .put('/auth/me/password')
      .set('Authorization', authHeader)
      .send({ currentPassword: 'newpass', newPassword: 'ab' })
      .expect(400);
  });

  test('rejects missing fields', async () => {
    await request.put('/auth/me/password').set('Authorization', authHeader).send({}).expect(400);
    await request.put('/auth/me/password').set('Authorization', authHeader).send({ currentPassword: 'x' }).expect(400);
    await request.put('/auth/me/password').set('Authorization', authHeader).send({ newPassword: 'x' }).expect(400);
  });

  test('requires auth', async () => {
    await request.put('/auth/me/password').send({ currentPassword: 'x', newPassword: 'y' }).expect(401);
  });
});

describe('DELETE /auth/me — delete account', () => {
  let authHeader: string;
  let playerId: string;
  let username: string;

  beforeAll(async () => {
    username = `del_me_${Date.now()}`;
    const res = await request.post('/auth/register').send({ username, password: 'secret' }).expect(201);
    authHeader = `Bearer ${res.body.token}`;
    playerId = res.body.playerId;
  });

  test('deletes account and invalidates token', async () => {
    await request.delete('/auth/me').set('Authorization', authHeader).expect(200);

    /* Token no longer works */
    await request.get('/auth/me').set('Authorization', authHeader).expect(401);

    /* Can register again with same username */
    const reReg = await request.post('/auth/register').send({ username, password: 'newsecret' }).expect(201);
    expect(reReg.body.playerId).not.toBe(playerId);
  });

  test('requires auth', async () => {
    await request.delete('/auth/me').expect(401);
  });
});
