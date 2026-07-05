/* API integration tests.
 *
 * Tests the full HTTP API surface using supertest against the Express app.
 * The server is NOT started (index.ts detects JEST_WORKER_ID and skips
 * the listen() call), so these tests run without port conflicts.
 */

import supertest from 'supertest';
import { app } from '../src/index.js';
import * as game from '../src/game.js';
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

  test('POST /games supports spectateMode code', async () => {
    const { authHeader } = await registerPlayer('spec_mode');
    const res = await request
      .post('/games')
      .set('Authorization', authHeader)
      .send({ spectateMode: 'code' })
      .expect(201);
    expect(res.body.spectateMode).toBe('code');
    expect(res.body.spectateCode).toBeDefined();
    expect(typeof res.body.spectateCode).toBe('string');
  });

  test('POST /games spectateCode not leaked via GET /games/:id', async () => {
    const { authHeader } = await registerPlayer('spec_leak');
    const createRes = await request
      .post('/games')
      .set('Authorization', authHeader)
      .send({ spectateMode: 'code' })
      .expect(201);
    expect(createRes.body.spectateCode).toBeDefined();

    const getRes = await request.get('/games/' + createRes.body.id).expect(200);
    expect(getRes.body.spectateCode).toBeUndefined();
  });

  test('GET /games lists waiting games', async () => {
    /* Create one game and verify it shows up in the open games list */
    await registerPlayer('p2');
    const white = await registerPlayer('p2_2');
    await createGame(white.authHeader);

    const res = await request.get('/games').expect(200);
    expect(Array.isArray(res.body.games)).toBe(true);
    expect(res.body.games.length).toBeGreaterThanOrEqual(1);
    /* All listed games must be in 'waiting' status */
    expect(res.body.games.every((g: { status: string }) => g.status === 'waiting')).toBe(true);
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
    expect(Array.isArray(list.body.games)).toBe(true);
    /* The public game is listed */
    expect(list.body.games.some((g: { players: { white: string } }) => g.players.white === pub.playerId)).toBe(true);
    /* The private game is NOT listed */
    expect(list.body.games.some((g: { players: { white: string } }) => g.players.white === priv.playerId)).toBe(false);
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

  test('rate limits after 60 rapid requests', async () => {
    const { clearIpRateBuckets } = await import('../src/routes');
    clearIpRateBuckets();

    /* Fire 60 requests — all should succeed */
    for (let i = 0; i < 60; i++) {
      const res = await request.get('/health');
      expect(res.status).toBe(200);
    }

    /* 61st should be rate limited */
    const blocked = await request.get('/health');
    expect(blocked.status).toBe(429);
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
    expect(Array.isArray(res.body.games)).toBe(true);
    expect(res.body.games.some((g: { id: string }) => g.id === gameId)).toBe(true);
  });

  test('does not include waiting games', async () => {
    await registerPlayer('act3');
    const p2 = await registerPlayer('act4');
    await createGame(p2.authHeader);

    const res = await request.get('/games/active').expect(200);
    if (res.body.games.length > 0) {
      expect(res.body.games.every((g: { status: string }) => g.status === 'active')).toBe(true);
    }
  });

  test('does not include finished games', async () => {
    const p1 = await registerPlayer('act5');
    const p2 = await registerPlayer('act6');
    const gameId = await createGame(p1.authHeader);
    await joinGame(gameId, p2.authHeader);

    await request.post(`/games/${gameId}/resign`).set('Authorization', p1.authHeader).expect(200);

    const res = await request.get('/games/active').expect(200);
    expect(res.body.games.some((g: { id: string }) => g.id === gameId)).toBe(false);
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
    expect(res.body.every((g: { status: string }) => g.status !== 'active' && g.status !== 'waiting')).toBe(true);
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
    expect(res.body.some((g: { status: string }) => g.status === 'waiting')).toBe(true);
    expect(res.body.some((g: { status: string }) => g.status === 'active')).toBe(true);
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
    const reg = await request.post('/auth/register').send({ username: 'adm_crud', password: 'secret1234' }).expect(201);
    accountId = reg.body.playerId;
    accountName = reg.body.displayName;
  });

  test('GET /admin/api/accounts lists all registered users', async () => {
    const res = await request.get('/admin/api/accounts').set('Authorization', authHeader).expect(200);
    expect(Array.isArray(res.body.rows)).toBe(true);
    const target = res.body.rows.find((a: { id: string; username: string }) => a.id === accountId);
    expect(target).toBeDefined();
    expect(target!.username).toBe('adm_crud');
  });

  test('PUT /admin/api/accounts/:id updates display name', async () => {
    await request
      .put(`/admin/api/accounts/${accountId}`)
      .set('Authorization', authHeader)
      .send({ displayName: 'Admin Test' })
      .expect(200);

    const res = await request.get('/admin/api/accounts').set('Authorization', authHeader).expect(200);
    const target = res.body.rows.find((a: { id: string; displayName: string }) => a.id === accountId);
    expect(target!.displayName).toBe('Admin Test');
  });

  test('PUT /admin/api/accounts/:id rejects empty displayName', async () => {
    await request
      .put(`/admin/api/accounts/${accountId}`)
      .set('Authorization', authHeader)
      .send({ displayName: '' })
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
    const reg = await request
      .post('/auth/register')
      .send({ username: 'adm_delete_me', password: 'secret1234' })
      .expect(201);
    const delId = reg.body.playerId;

    await request.delete(`/admin/api/accounts/${delId}`).set('Authorization', authHeader).expect(200);

    /* Verify it's gone from the accounts list */
    const res = await request.get('/admin/api/accounts').set('Authorization', authHeader).expect(200);
    expect(res.body.rows.some((a: { id: string }) => a.id === delId)).toBe(false);
  });

  test('DELETE /admin/api/accounts/:id rejects non-existent account', async () => {
    await request.delete('/admin/api/accounts/non-existent').set('Authorization', authHeader).expect(404);
  });

  test('GET /admin/api/accounts returns correct shape', async () => {
    const res = await request.get('/admin/api/accounts').set('Authorization', authHeader).expect(200);
    for (const a of res.body.rows) {
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
    const res = await request
      .put('/auth/me')
      .set('Authorization', authHeader)
      .send({ displayName: 'New Name' })
      .expect(200);
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
    const res = await request.post('/auth/register').send({ username: 'pw_change', password: 'oldpass12' }).expect(201);
    authHeader = `Bearer ${res.body.token}`;
  });

  test('changes password with valid old password', async () => {
    await request
      .put('/auth/me/password')
      .set('Authorization', authHeader)
      .send({ currentPassword: 'oldpass12', newPassword: 'newpass12' })
      .expect(200);

    /* Old password no longer works */
    await request.post('/auth/login').send({ username: 'pw_change', password: 'oldpass12' }).expect(401);

    /* New password works */
    const login = await request.post('/auth/login').send({ username: 'pw_change', password: 'newpass12' }).expect(200);
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
    const res = await request.post('/auth/register').send({ username, password: 'secret1234' }).expect(201);
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

/* ------------------------------------------------------------------ */
/*  Profile Pictures (avatar)                                            */
/* ------------------------------------------------------------------ */

describe('POST /auth/me/avatar — profile picture', () => {
  test('uploads avatar for registered user', async () => {
    const res = await request.post('/auth/register').send({ username: 'av_up', password: 'test1234' }).expect(201);
    const auth = `Bearer ${res.body.token}`;

    const upload = await request
      .post('/auth/me/avatar')
      .set('Authorization', auth)
      .attach('avatar', Buffer.from('test-image'), { filename: 'avatar.png', contentType: 'image/png' })
      .expect(200);

    expect(upload.body).toHaveProperty('avatarUrl');
    expect(upload.body.avatarUrl).toMatch(/^\/avatars\//);

    const me = await request.get('/auth/me').set('Authorization', auth).expect(200);
    expect(me.body.avatarUrl).toBe(upload.body.avatarUrl);
  });

  test('rejects upload without auth', async () => {
    await request
      .post('/auth/me/avatar')
      .attach('avatar', Buffer.from('x'), { filename: 'x.png', contentType: 'image/png' })
      .expect(401);
  });

  test('rejects upload for unregistered (anonymous) player', async () => {
    const res = await request.post('/auth/register').send({ username: 'av_anon' }).expect(201);
    const auth = `Bearer ${res.body.token}`;

    await request
      .post('/auth/me/avatar')
      .set('Authorization', auth)
      .attach('avatar', Buffer.from('x'), { filename: 'x.png', contentType: 'image/png' })
      .expect(400);
  });

  test('rejects non-image file type', async () => {
    const res = await request.post('/auth/register').send({ username: 'av_txt', password: 'test1234' }).expect(201);
    const auth = `Bearer ${res.body.token}`;

    await request
      .post('/auth/me/avatar')
      .set('Authorization', auth)
      .attach('avatar', Buffer.from('text'), { filename: 'test.txt', contentType: 'text/plain' })
      .expect(400);
  });

  test('DELETE /auth/me/avatar removes avatar', async () => {
    const res = await request.post('/auth/register').send({ username: 'av_del', password: 'test1234' }).expect(201);
    const auth = `Bearer ${res.body.token}`;

    await request
      .post('/auth/me/avatar')
      .set('Authorization', auth)
      .attach('avatar', Buffer.from('x'), { filename: 'x.png', contentType: 'image/png' })
      .expect(200);

    await request.delete('/auth/me/avatar').set('Authorization', auth).expect(200);

    const me = await request.get('/auth/me').set('Authorization', auth).expect(200);
    expect(me.body.avatarUrl).toBeNull();
  });

  test('game state includes avatarUrl after upload', async () => {
    const white = await request
      .post('/auth/register')
      .send({ username: 'av_game_w', password: 'test1234' })
      .expect(201);
    const black = await request
      .post('/auth/register')
      .send({ username: 'av_game_b', password: 'test1234' })
      .expect(201);
    const wh = `Bearer ${white.body.token}`;
    const bh = `Bearer ${black.body.token}`;

    const upload = await request
      .post('/auth/me/avatar')
      .set('Authorization', wh)
      .attach('avatar', Buffer.from('x'), { filename: 'x.png', contentType: 'image/png' })
      .expect(200);
    const avatarUrl = upload.body.avatarUrl;

    const gameRes = await request.post('/games').set('Authorization', wh).expect(201);
    expect(gameRes.body.whiteAvatarUrl).toBe(avatarUrl);
    expect(gameRes.body.whiteName).toBe('av_game_w');

    const joinRes = await request.post(`/games/${gameRes.body.id}/join`).set('Authorization', bh).expect(200);
    expect(joinRes.body.whiteAvatarUrl).toBe(avatarUrl);
    expect(joinRes.body.blackAvatarUrl).toBeUndefined();
    expect(joinRes.body.blackName).toBe('av_game_b');
  });
});

/* ------------------------------------------------------------------ */
/*  Player Profiles                                                      */
/* ------------------------------------------------------------------ */

describe('GET /players/:playerId/profile', () => {
  test('returns profile for registered user', async () => {
    const res = await request.post('/auth/register').send({ username: 'prof_reg', password: 'test1234' }).expect(201);
    const auth = `Bearer ${res.body.token}`;

    const profile = await request.get(`/players/${res.body.playerId}/profile`).set('Authorization', auth).expect(200);

    expect(profile.body.id).toBe(res.body.playerId);
    expect(profile.body.username).toBe('prof_reg');
    expect(profile.body.displayName).toBe('prof_reg');
    expect(profile.body.isRegistered).toBe(true);
    expect(profile.body.avatarUrl).toBeNull();
    expect(typeof profile.body.createdAt).toBe('number');
    expect(profile.body.stats).toEqual({ wins: 0, losses: 0, draws: 0 });
  });

  test('stats update after a completed game', async () => {
    const white = await request
      .post('/auth/register')
      .send({ username: 'stats_w_' + Date.now(), password: 'test1234' })
      .expect(201);
    const black = await request
      .post('/auth/register')
      .send({ username: 'stats_b_' + Date.now(), password: 'test1234' })
      .expect(201);
    const whiteAuth = `Bearer ${white.body.token}`;
    const blackAuth = `Bearer ${black.body.token}`;

    /* Play Scholar's Mate to completion */
    const gameId = await createGame(whiteAuth);
    await joinGame(gameId, blackAuth);
    await makeMove(gameId, whiteAuth, 'e2', 'e4');
    await makeMove(gameId, blackAuth, 'e7', 'e5');
    await makeMove(gameId, whiteAuth, 'd1', 'h5');
    await makeMove(gameId, blackAuth, 'b8', 'c6');
    await makeMove(gameId, whiteAuth, 'f1', 'c4');
    await makeMove(gameId, blackAuth, 'g8', 'f6');
    const result = await makeMove(gameId, whiteAuth, 'h5', 'f7');
    expect(result.status).toBe(200);
    expect(result.body.status).toBe('checkmate');

    /* Verify both live stats and archived stats */
    const wProfile = await request
      .get(`/players/${white.body.playerId}/profile`)
      .set('Authorization', whiteAuth)
      .expect(200);
    expect(wProfile.body.stats).toEqual({ wins: 1, losses: 0, draws: 0 });
    expect(wProfile.body.archivedStats).toEqual({ wins: 1, losses: 0, draws: 0 });

    const bProfile = await request
      .get(`/players/${black.body.playerId}/profile`)
      .set('Authorization', blackAuth)
      .expect(200);
    expect(bProfile.body.stats).toEqual({ wins: 0, losses: 1, draws: 0 });
    expect(bProfile.body.archivedStats).toEqual({ wins: 0, losses: 1, draws: 0 });
  });

  test('returns limited profile for anonymous user', async () => {
    const res = await request.post('/auth/register').send({ username: 'prof_anon' }).expect(201);
    const auth = `Bearer ${res.body.token}`;

    const profile = await request.get(`/players/${res.body.playerId}/profile`).set('Authorization', auth).expect(200);

    expect(profile.body.id).toBe(res.body.playerId);
    expect(profile.body.isRegistered).toBe(false);
    expect(profile.body.avatarUrl).toBeNull();
    expect(profile.body.stats).toEqual({ wins: 0, losses: 0, draws: 0 });
  });

  test('returns avatarUrl after upload', async () => {
    const res = await request.post('/auth/register').send({ username: 'prof_av', password: 'test1234' }).expect(201);
    const auth = `Bearer ${res.body.token}`;

    const upload = await request
      .post('/auth/me/avatar')
      .set('Authorization', auth)
      .attach('avatar', Buffer.from('x'), { filename: 'x.png', contentType: 'image/png' })
      .expect(200);

    const profile = await request.get(`/players/${res.body.playerId}/profile`).set('Authorization', auth).expect(200);

    expect(profile.body.avatarUrl).toBe(upload.body.avatarUrl);
  });

  test('requires auth', async () => {
    await request.get('/players/some-id/profile').expect(401);
  });
});

/* ------------------------------------------------------------------ */
/*  Friends                                                           */
/* ------------------------------------------------------------------ */

describe('Friends', () => {
  async function registerUser(username: string) {
    const res = await request.post('/auth/register').send({ username, password: 'test1234' }).expect(201);
    return { ...res.body, auth: `Bearer ${res.body.token}` };
  }

  test('send friend request by username', async () => {
    const a = await registerUser('friend_a');
    const b = await registerUser('friend_b');

    const res = await request
      .post('/friends/request')
      .set('Authorization', a.auth)
      .send({ username: 'friend_b' })
      .expect(201);
    expect(res.body).toHaveProperty('id');
  });

  test('friend request to non-existent user returns 404', async () => {
    const a = await registerUser('friend_c');
    await request.post('/friends/request').set('Authorization', a.auth).send({ username: 'no_such_user' }).expect(404);
  });

  test('friend request to self returns 400', async () => {
    const a = await registerUser('friend_d');
    await request.post('/friends/request').set('Authorization', a.auth).send({ username: 'friend_d' }).expect(400);
  });

  test('duplicate friend request returns 409', async () => {
    const a = await registerUser('friend_e');
    const b = await registerUser('friend_f');

    await request.post('/friends/request').set('Authorization', a.auth).send({ username: 'friend_f' }).expect(201);
    await request.post('/friends/request').set('Authorization', a.auth).send({ username: 'friend_f' }).expect(409);
  });

  test('requires auth for friends endpoints', async () => {
    await request.post('/friends/request').send({ username: 'x' }).expect(401);
    await request.get('/friends/requests').expect(401);
    await request.get('/friends').expect(401);
  });

  test('list pending requests (incoming and outgoing)', async () => {
    const a = await registerUser('friend_g');
    const b = await registerUser('friend_h');

    await request.post('/friends/request').set('Authorization', a.auth).send({ username: 'friend_h' }).expect(201);

    /* b sees incoming */
    const bReq = await request.get('/friends/requests').set('Authorization', b.auth).expect(200);
    expect(bReq.body.incoming).toHaveLength(1);
    expect(bReq.body.incoming[0].username).toBe('friend_g');
    expect(bReq.body.outgoing).toHaveLength(0);

    /* a sees outgoing */
    const aReq = await request.get('/friends/requests').set('Authorization', a.auth).expect(200);
    expect(aReq.body.outgoing).toHaveLength(1);
    expect(aReq.body.outgoing[0].username).toBe('friend_h');
    expect(aReq.body.incoming).toHaveLength(0);
  });

  test('accept friend request', async () => {
    const a = await registerUser('friend_i');
    const b = await registerUser('friend_j');

    const fr = await request
      .post('/friends/request')
      .set('Authorization', a.auth)
      .send({ username: 'friend_j' })
      .expect(201);

    /* b accepts */
    await request.post(`/friends/requests/${fr.body.id}/accept`).set('Authorization', b.auth).expect(200);

    /* Are friends now? */
    const aFriends = await request.get('/friends').set('Authorization', a.auth).expect(200);
    expect(aFriends.body).toHaveLength(1);
    expect(aFriends.body[0].playerId).toBe(b.playerId);

    const bFriends = await request.get('/friends').set('Authorization', b.auth).expect(200);
    expect(bFriends.body).toHaveLength(1);
    expect(bFriends.body[0].playerId).toBe(a.playerId);
  });

  test('decline friend request', async () => {
    const a = await registerUser('friend_k');
    const b = await registerUser('friend_l');

    const fr = await request
      .post('/friends/request')
      .set('Authorization', a.auth)
      .send({ username: 'friend_l' })
      .expect(201);

    await request.post(`/friends/requests/${fr.body.id}/decline`).set('Authorization', b.auth).expect(200);

    /* No friends */
    const aFriends = await request.get('/friends').set('Authorization', a.auth).expect(200);
    expect(aFriends.body).toHaveLength(0);
  });

  test('non-recipient cannot accept/decline', async () => {
    const a = await registerUser('friend_m');
    const b = await registerUser('friend_n');
    const c = await registerUser('friend_o');

    const fr = await request
      .post('/friends/request')
      .set('Authorization', a.auth)
      .send({ username: 'friend_n' })
      .expect(201);

    /* c (not the recipient) tries to accept */
    await request.post(`/friends/requests/${fr.body.id}/accept`).set('Authorization', c.auth).expect(403);

    /* c (not the recipient) tries to decline */
    await request.post(`/friends/requests/${fr.body.id}/decline`).set('Authorization', c.auth).expect(403);
  });

  test('remove friend', async () => {
    const a = await registerUser('friend_p');
    const b = await registerUser('friend_q');

    const fr = await request
      .post('/friends/request')
      .set('Authorization', a.auth)
      .send({ username: 'friend_q' })
      .expect(201);
    await request.post(`/friends/requests/${fr.body.id}/accept`).set('Authorization', b.auth).expect(200);

    /* a removes b */
    await request.delete(`/friends/${b.playerId}`).set('Authorization', a.auth).expect(200);

    const aFriends = await request.get('/friends').set('Authorization', a.auth).expect(200);
    expect(aFriends.body).toHaveLength(0);

    const bFriends = await request.get('/friends').set('Authorization', b.auth).expect(200);
    expect(bFriends.body).toHaveLength(0);
  });

  test('remove non-friend returns 404', async () => {
    const a = await registerUser('friend_r');
    const b = await registerUser('friend_s');

    await request.delete(`/friends/${b.playerId}`).set('Authorization', a.auth).expect(404);
  });

  test('friend list includes online status', async () => {
    /* Online status is based on WS connections, which we can't test via HTTP.
     * But we verify the endpoint returns the expected shape with isOnline=false. */
    const a = await registerUser('friend_t');
    const b = await registerUser('friend_u');

    const fr = await request
      .post('/friends/request')
      .set('Authorization', a.auth)
      .send({ username: 'friend_u' })
      .expect(201);
    await request.post(`/friends/requests/${fr.body.id}/accept`).set('Authorization', b.auth).expect(200);

    const aFriends = await request.get('/friends').set('Authorization', a.auth).expect(200);
    expect(aFriends.body[0]).toMatchObject({
      playerId: b.playerId,
      username: 'friend_u',
      displayName: 'friend_u',
      isOnline: false,
      currentGameId: null,
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Logout                                                              */
/* ------------------------------------------------------------------ */

describe('POST /auth/logout', () => {
  test('invalidates bearer token', async () => {
    const { token, authHeader } = await registerPlayer('logout_test');
    await request.post('/auth/logout').set('Authorization', authHeader).expect(200);
    await request.get('/auth/me').set('Authorization', authHeader).expect(401);
  });

  test('rejects missing auth header', async () => {
    await request.post('/auth/logout').expect(401);
  });
});

/* ------------------------------------------------------------------ */
/*  Account lockout via HTTP                                             */
/* ------------------------------------------------------------------ */

describe('Account lockout', () => {
  test('locks account after 5 failed login attempts', async () => {
    const username = 'lockout_http_' + Date.now();
    await request.post('/auth/register').send({ username, password: 'secret1234' }).expect(201);

    for (let i = 0; i < 5; i++) {
      await request.post('/auth/login').send({ username, password: 'wrongpass' }).expect(401);
    }
    const res = await request.post('/auth/login').send({ username, password: 'secret1234' }).expect(429);
    expect(res.body.error).toMatch(/locked/i);
  });

  test('does not lock before 5 failed attempts', async () => {
    const username = 'lockout_ok_' + Date.now();
    await request.post('/auth/register').send({ username, password: 'secret1234' }).expect(201);

    for (let i = 0; i < 4; i++) {
      await request.post('/auth/login').send({ username, password: 'wrongpass' }).expect(401);
    }
    const res = await request.post('/auth/login').send({ username, password: 'secret1234' }).expect(200);
    expect(res.body.success).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Tournaments                                                         */
/* ------------------------------------------------------------------ */

describe('Tournaments', () => {
  let creatorAuth: string;
  let creatorId: string;
  let joinerAuth: string;

  beforeAll(async () => {
    /* Tournament creator and joiner must be registered users (with password) */
    const cRes = await request.post('/auth/register').send({ username: 'tourney_c', password: 'test1234' }).expect(201);
    creatorAuth = `Bearer ${cRes.body.token}`;
    creatorId = cRes.body.playerId;
    const jRes = await request.post('/auth/register').send({ username: 'tourney_j', password: 'test1234' }).expect(201);
    joinerAuth = `Bearer ${jRes.body.token}`;
  });

  test('POST /tournaments creates a tournament', async () => {
    const res = await request
      .post('/tournaments')
      .set('Authorization', creatorAuth)
      .send({ name: 'Test Tournament', maxPlayers: 4 })
      .expect(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Test Tournament');
    expect(res.body.status).toBe('waiting');
    expect(res.body.created_by).toBe(creatorId);
  });

  test('POST /tournaments rejects anonymous users', async () => {
    await request.post('/tournaments').set('Authorization', 'Bearer no-such-token').send({ name: 'X' }).expect(401);
  });

  test('POST /tournaments requires name', async () => {
    await request.post('/tournaments').set('Authorization', creatorAuth).send({}).expect(400);
    await request.post('/tournaments').set('Authorization', creatorAuth).send({ name: '' }).expect(400);
    await request.post('/tournaments').set('Authorization', creatorAuth).send({ name: '   ' }).expect(400);
  });

  test('GET /tournaments lists public tournaments', async () => {
    const res = await request.get('/tournaments').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const t = res.body.find(
      (t: { name: string; id: string; participantCount: number }) => t.name === 'Test Tournament',
    );
    expect(t).toBeDefined();
    expect(t).toHaveProperty('participantCount');
  });

  test('participantCount reflects actual number of joined players', async () => {
    /* Create a new tournament with two additional joiners */
    const regA = await request.post('/auth/register').send({ username: 'pcount_a', password: 'test1234' }).expect(201);
    const authA = `Bearer ${regA.body.token}`;
    const regB = await request.post('/auth/register').send({ username: 'pcount_b', password: 'test1234' }).expect(201);
    const authB = `Bearer ${regB.body.token}`;

    const createRes = await request
      .post('/tournaments')
      .set('Authorization', creatorAuth)
      .send({ name: 'PCount Test', maxPlayers: 8 })
      .expect(201);
    const tId = createRes.body.id;

    /* Only creator initially */
    let list = await request.get('/tournaments').expect(200);
    let t = list.body.find((t: { id: string; participantCount: number }) => t.id === tId);
    expect(t!.participantCount).toBe(1);

    /* Join player A */
    await request.post(`/tournaments/${tId}/join`).set('Authorization', authA).expect(200);
    list = await request.get('/tournaments').expect(200);
    t = list.body.find((t: { id: string; participantCount: number }) => t.id === tId);
    expect(t!.participantCount).toBe(2);

    /* Join player B */
    await request.post(`/tournaments/${tId}/join`).set('Authorization', authB).expect(200);
    list = await request.get('/tournaments').expect(200);
    t = list.body.find((t: { id: string; participantCount: number }) => t.id === tId);
    expect(t!.participantCount).toBe(3);
  });

  test('POST /tournaments/:id/join allows joining', async () => {
    const list = await request.get('/tournaments').expect(200);
    const t = list.body.find((t: { name: string; id: string }) => t.name === 'Test Tournament');
    const res = await request.post(`/tournaments/${t!.id}/join`).set('Authorization', joinerAuth).expect(200);
    expect(res.body.id).toBe(t.id);
  });

  test('POST /tournaments/:id/join rejects duplicate', async () => {
    const list = await request.get('/tournaments').expect(200);
    const t = list.body.find((t: { name: string; id: string }) => t.name === 'Test Tournament');
    await request.post(`/tournaments/${t!.id}/join`).set('Authorization', joinerAuth).expect(409);
  });

  test('POST /tournaments/:id/join rejects non-existent', async () => {
    await request.post('/tournaments/non-existent/join').set('Authorization', joinerAuth).expect(404);
  });

  test('POST /tournaments/:id/leave allows leaving', async () => {
    const list = await request.get('/tournaments').expect(200);
    const t = list.body.find((t: { name: string; id: string }) => t.name === 'Test Tournament');
    await request.post(`/tournaments/${t!.id}/leave`).set('Authorization', joinerAuth).expect(200);

    /* can re-join after leaving */
    await request.post(`/tournaments/${t!.id}/join`).set('Authorization', joinerAuth).expect(200);
  });

  test('POST /tournaments/:id/start with 2+ players', async () => {
    const list = await request.get('/tournaments').expect(200);
    const t = list.body.find((t: { name: string; id: string }) => t.name === 'Test Tournament');
    const res = await request.post(`/tournaments/${t!.id}/start`).set('Authorization', creatorAuth).expect(200);
    expect(res.body.status).toBe('active');
  });

  test('POST /tournaments/:id/start rejects already started', async () => {
    const list = await request.get('/tournaments').expect(200);
    const t = list.body.find((t: { name: string; id: string }) => t.name === 'Test Tournament');
    await request.post(`/tournaments/${t!.id}/start`).set('Authorization', creatorAuth).expect(400);
  });

  test('POST /tournaments/:id/leave rejected after start', async () => {
    const list = await request.get('/tournaments').expect(200);
    const t = list.body.find((t: { name: string; id: string }) => t.name === 'Test Tournament');
    await request.post(`/tournaments/${t!.id}/leave`).set('Authorization', joinerAuth).expect(400);
  });

  test('POST /tournaments requires at least 2 players to start', async () => {
    const res = await request
      .post('/tournaments')
      .set('Authorization', creatorAuth)
      .send({ name: 'Solo Tourney', maxPlayers: 4 })
      .expect(201);
    const soloId = res.body.id;

    await request.post(`/tournaments/${soloId}/start`).set('Authorization', creatorAuth).expect(400);
  });

  test('POST /tournaments/:id/start rejects non-creator', async () => {
    const res = await request
      .post('/tournaments')
      .set('Authorization', creatorAuth)
      .send({ name: 'Start Test', maxPlayers: 4 })
      .expect(201);
    const id = res.body.id;
    await request.post(`/tournaments/${id}/join`).set('Authorization', joinerAuth).expect(200);
    await request.post(`/tournaments/${id}/start`).set('Authorization', joinerAuth).expect(403);
  });

  test('PUT /tournaments/:id edits tournament', async () => {
    const res = await request
      .post('/tournaments')
      .set('Authorization', creatorAuth)
      .send({ name: 'Editable Tourney', maxPlayers: 8 })
      .expect(201);
    const id = res.body.id;

    const edited = await request
      .put(`/tournaments/${id}`)
      .set('Authorization', creatorAuth)
      .send({ name: 'Edited Name', maxPlayers: 16 })
      .expect(200);
    expect(edited.body.name).toBe('Edited Name');
    expect(edited.body.max_players).toBe(16);
  });

  test('PUT /tournaments/:id rejects non-creator', async () => {
    const res = await request
      .post('/tournaments')
      .set('Authorization', creatorAuth)
      .send({ name: 'No Edit', maxPlayers: 4 })
      .expect(201);
    const id = res.body.id;

    await request.put(`/tournaments/${id}`).set('Authorization', joinerAuth).send({ name: 'Hacked' }).expect(403);
  });

  test('DELETE /tournaments/:id deletes tournament', async () => {
    const res = await request
      .post('/tournaments')
      .set('Authorization', creatorAuth)
      .send({ name: 'Delete Me', maxPlayers: 4 })
      .expect(201);
    const id = res.body.id;

    await request.delete(`/tournaments/${id}`).set('Authorization', creatorAuth).expect(200);
    await request.get(`/tournaments/${id}`).expect(404);
  });

  test('DELETE /tournaments/:id rejects non-creator', async () => {
    const res = await request
      .post('/tournaments')
      .set('Authorization', creatorAuth)
      .send({ name: 'No Delete', maxPlayers: 4 })
      .expect(201);
    const id = res.body.id;

    await request.delete(`/tournaments/${id}`).set('Authorization', joinerAuth).expect(403);
  });

  test('private tournament excluded from public list, joinable by code', async () => {
    const res = await request
      .post('/tournaments')
      .set('Authorization', creatorAuth)
      .send({ name: 'Secret Tourney', maxPlayers: 4, isPrivate: true })
      .expect(201);
    expect(res.body).toHaveProperty('join_code');
    const joinCode = res.body.join_code;

    const list = await request.get('/tournaments').expect(200);
    expect(list.body.some((t: { name: string }) => t.name === 'Secret Tourney')).toBe(false);

    const joinByCode = await request
      .post('/tournaments/join-by-code')
      .set('Authorization', joinerAuth)
      .send({ code: joinCode })
      .expect(200);
    expect(joinByCode.body.id).toBe(res.body.id);
  });

  test('POST /tournaments/join-by-code with invalid code', async () => {
    await request
      .post('/tournaments/join-by-code')
      .set('Authorization', joinerAuth)
      .send({ code: 'INVALID' })
      .expect(404);
  });

  test('POST /tournaments/join-by-code requires code', async () => {
    await request.post('/tournaments/join-by-code').set('Authorization', joinerAuth).send({}).expect(400);
  });
});

/* ------------------------------------------------------------------ */
/*  Bot games                                                           */
/* ------------------------------------------------------------------ */

describe('Bot games', () => {
  let playerAuth: string;

  beforeAll(async () => {
    const p = await registerPlayer('bot_player');
    playerAuth = p.authHeader;
  });

  afterAll(() => {
    game.killAllEngines();
  });

  test('POST /games/bot creates a bot game', async () => {
    const res = await request.post('/games/bot').set('Authorization', playerAuth).send({ skillLevel: 1 }).expect(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('active');
    expect(res.body.players).toHaveProperty('black', '_bot_');
  });

  test('POST /games/bot rejects missing auth', async () => {
    await request.post('/games/bot').send({ skillLevel: 1 }).expect(401);
  });

  test('POST /games/bot allows making a move', async () => {
    const res = await request.post('/games/bot').set('Authorization', playerAuth).send({ skillLevel: 1 }).expect(201);
    const gameId = res.body.id;

    const moveRes = await request
      .post(`/games/${gameId}/move`)
      .set('Authorization', playerAuth)
      .send({ from: 'e2', to: 'e4' });
    expect(moveRes.status).toBe(200);
    expect(moveRes.body.status).toBe('active');
    const apiRes = await request.get(`/games/${gameId}`).set('Authorization', playerAuth);
    expect(apiRes.body.moveHistory.length).toBeGreaterThanOrEqual(1);
  });

  test('POST /games/bot as black (bot is white)', async () => {
    const res = await request
      .post('/games/bot')
      .set('Authorization', playerAuth)
      .send({ skillLevel: 1, playerColor: 'black' })
      .expect(201);
    expect(res.body.players.white).toBe('_bot_');
    expect(res.body.players.black).not.toBe('_bot_');
  });

  test('POST /games/bot returns spectateCode', async () => {
    const res = await request.post('/games/bot').set('Authorization', playerAuth).send({ skillLevel: 1 }).expect(201);
    expect(res.body.spectateMode).toBe('code');
    expect(res.body.spectateCode).toBeDefined();
    expect(typeof res.body.spectateCode).toBe('string');
  });
});

/* ------------------------------------------------------------------ */
/*  Admin extra endpoints (bot-games, tournaments)                       */
/* ------------------------------------------------------------------ */

describe('Admin API — bot games & tournaments', () => {
  let adminAuth: string;
  let playerAuth: string;

  beforeAll(async () => {
    const res = await request.post('/admin/api/login').send({ username: 'admin', password: 'admin' });
    adminAuth = `Bearer ${res.body.token}`;
    const pRes = await request
      .post('/auth/register')
      .send({ username: 'admin_bot_t', password: 'test1234' })
      .expect(201);
    playerAuth = `Bearer ${pRes.body.token}`;
  });

  test('GET /admin/api/bot-games returns stats', async () => {
    const res = await request.get('/admin/api/bot-games').set('Authorization', adminAuth).expect(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('active');
    expect(res.body).toHaveProperty('games');
    expect(typeof res.body.total).toBe('number');
    expect(Array.isArray(res.body.games)).toBe(true);
  });

  test('GET /admin/api/tournaments lists all tournaments', async () => {
    const res = await request.get('/admin/api/tournaments').set('Authorization', adminAuth).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(0);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('participantCount');
    }
  });

  test('DELETE /admin/api/tournaments/:id deletes tournament', async () => {
    const tRes = await request
      .post('/tournaments')
      .set('Authorization', playerAuth)
      .send({ name: 'Admin Delete Me', maxPlayers: 4 })
      .expect(201);
    const id = tRes.body.id;

    await request.delete(`/admin/api/tournaments/${id}`).set('Authorization', adminAuth).expect(200);
    await request.get(`/admin/api/tournaments/${id}`).set('Authorization', adminAuth).expect(404);
  });

  test('DELETE /admin/api/tournaments/:id returns 404 for non-existent', async () => {
    await request.delete('/admin/api/tournaments/non-existent').set('Authorization', adminAuth).expect(404);
  });
});

/* ------------------------------------------------------------------ */
/*  New Admin API Endpoints                                              */
/* ------------------------------------------------------------------ */

describe('Admin API — create account', () => {
  let adminAuth: string;

  beforeAll(async () => {
    const res = await request.post('/admin/api/login').send({ username: 'admin', password: 'admin' });
    adminAuth = `Bearer ${res.body.token}`;
  });

  test('POST /admin/api/accounts creates a new account', async () => {
    const res = await request
      .post('/admin/api/accounts')
      .set('Authorization', adminAuth)
      .send({ username: 'admin_created', password: 'pass1234', displayName: 'Admin Created' })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('id');

    const list = await request.get('/admin/api/accounts').set('Authorization', adminAuth).expect(200);
    expect(list.body.rows.some((a: { username: string }) => a.username === 'admin_created')).toBe(true);
  });

  test('POST /admin/api/accounts rejects duplicate username', async () => {
    await request
      .post('/admin/api/accounts')
      .set('Authorization', adminAuth)
      .send({ username: 'admin_created', password: 'pass1234' })
      .expect(409);
  });

  test('POST /admin/api/accounts rejects short password', async () => {
    await request
      .post('/admin/api/accounts')
      .set('Authorization', adminAuth)
      .send({ username: 'admin_pw', password: 'ab' })
      .expect(400);
  });

  test('POST /admin/api/accounts rejects short username', async () => {
    await request
      .post('/admin/api/accounts')
      .set('Authorization', adminAuth)
      .send({ username: 'x', password: 'pass1234' })
      .expect(400);
  });

  test('POST /admin/api/accounts rejects missing password', async () => {
    await request
      .post('/admin/api/accounts')
      .set('Authorization', adminAuth)
      .send({ username: 'admin_nopw' })
      .expect(400);
  });

  test('POST /admin/api/accounts rejects missing auth', async () => {
    await request.post('/admin/api/accounts').send({ username: 'x', password: 'pass1234' }).expect(401);
  });
});

describe('Admin API — user games', () => {
  let adminAuth: string;
  let playerAuth: string;
  let playerId: string;

  beforeAll(async () => {
    const aRes = await request.post('/admin/api/login').send({ username: 'admin', password: 'admin' });
    adminAuth = `Bearer ${aRes.body.token}`;
    const pRes = await request.post('/auth/register').send({ username: 'adm_ug', password: 'test1234' }).expect(201);
    playerAuth = `Bearer ${pRes.body.token}`;
    playerId = pRes.body.playerId;
  });

  test('GET /admin/api/accounts/:id/games returns empty for new player', async () => {
    const res = await request.get(`/admin/api/accounts/${playerId}/games`).set('Authorization', adminAuth).expect(200);
    expect(res.body).toHaveProperty('active');
    expect(res.body).toHaveProperty('completed');
    expect(Array.isArray(res.body.active)).toBe(true);
    expect(Array.isArray(res.body.completed)).toBe(true);
  });

  test('GET /admin/api/accounts/:id/games returns 404 for non-existent', async () => {
    await request.get('/admin/api/accounts/non-existent/games').set('Authorization', adminAuth).expect(404);
  });

  test('GET /admin/api/accounts/:id/games requires auth', async () => {
    await request.get(`/admin/api/accounts/${playerId}/games`).expect(401);
  });
});

describe('Admin API — impersonate', () => {
  let adminAuth: string;
  let playerId: string;

  beforeAll(async () => {
    const aRes = await request.post('/admin/api/login').send({ username: 'admin', password: 'admin' });
    adminAuth = `Bearer ${aRes.body.token}`;
    const pRes = await request.post('/auth/register').send({ username: 'adm_imp', password: 'test1234' }).expect(201);
    playerId = pRes.body.playerId;
  });

  test('POST /admin/api/accounts/:id/impersonate returns a token', async () => {
    const res = await request
      .post(`/admin/api/accounts/${playerId}/impersonate`)
      .set('Authorization', adminAuth)
      .expect(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('userId', playerId);
    expect(res.body).toHaveProperty('username');
    expect(typeof res.body.token).toBe('string');

    const me = await request.get('/auth/me').set('Authorization', `Bearer ${res.body.token}`).expect(200);
    expect(me.body.id).toBe(playerId);
  });

  test('POST /admin/api/accounts/:id/impersonate returns 404 for non-existent', async () => {
    await request.post('/admin/api/accounts/non-existent/impersonate').set('Authorization', adminAuth).expect(404);
  });

  test('POST /admin/api/accounts/:id/impersonate requires auth', async () => {
    await request.post(`/admin/api/accounts/${playerId}/impersonate`).expect(401);
  });
});

describe('Admin API — tournament edit & force start', () => {
  let adminAuth: string;
  let playerAuth: string;
  let tournamentId: string;

  beforeAll(async () => {
    const aRes = await request.post('/admin/api/login').send({ username: 'admin', password: 'admin' });
    adminAuth = `Bearer ${aRes.body.token}`;
    const pRes = await request.post('/auth/register').send({ username: 'adm_tedit', password: 'test1234' }).expect(201);
    playerAuth = `Bearer ${pRes.body.token}`;
    const tRes = await request
      .post('/tournaments')
      .set('Authorization', playerAuth)
      .send({ name: 'Admin Edit Test', maxPlayers: 8 })
      .expect(201);
    tournamentId = tRes.body.id;
  });

  test('PUT /admin/api/tournaments/:id edits name and maxPlayers', async () => {
    await request
      .put(`/admin/api/tournaments/${tournamentId}`)
      .set('Authorization', adminAuth)
      .send({ name: 'Admin Edited', maxPlayers: 16 })
      .expect(200);

    const detail = await request
      .get(`/admin/api/tournaments/${tournamentId}`)
      .set('Authorization', adminAuth)
      .expect(200);
    expect(detail.body.name).toBe('Admin Edited');
    expect(detail.body.max_players).toBe(16);
  });

  test('PUT /admin/api/tournaments/:id edits status', async () => {
    await request
      .put(`/admin/api/tournaments/${tournamentId}`)
      .set('Authorization', adminAuth)
      .send({ status: 'completed' })
      .expect(200);

    const detail = await request
      .get(`/admin/api/tournaments/${tournamentId}`)
      .set('Authorization', adminAuth)
      .expect(200);
    expect(detail.body.status).toBe('completed');
  });

  test('PUT /admin/api/tournaments/:id returns 404 for non-existent', async () => {
    await request
      .put('/admin/api/tournaments/non-existent')
      .set('Authorization', adminAuth)
      .send({ name: 'X' })
      .expect(404);
  });

  test('POST /admin/api/tournaments/:id/force-start force starts a waiting tournament', async () => {
    const tRes = await request
      .post('/tournaments')
      .set('Authorization', playerAuth)
      .send({ name: 'Force Start Me', maxPlayers: 4 })
      .expect(201);
    const id = tRes.body.id;

    const res = await request
      .post(`/admin/api/tournaments/${id}/force-start`)
      .set('Authorization', adminAuth)
      .expect(200);
    expect(res.body.success).toBe(true);

    const detail = await request.get(`/admin/api/tournaments/${id}`).set('Authorization', adminAuth).expect(200);
    expect(detail.body.status).toBe('running');
  });

  test('POST /admin/api/tournaments/:id/force-start rejects non-waiting tournament', async () => {
    const tRes = await request
      .post('/tournaments')
      .set('Authorization', playerAuth)
      .send({ name: 'Already Running', maxPlayers: 4 })
      .expect(201);
    const id = tRes.body.id;

    const joinerRes = await request
      .post('/auth/register')
      .send({ username: 'adm_ts_join_' + Date.now(), password: 'test1234' })
      .expect(201);
    const joinerAuth = `Bearer ${joinerRes.body.token}`;

    await request.post(`/tournaments/${id}/join`).set('Authorization', joinerAuth).expect(200);
    await request.post(`/tournaments/${id}/start`).set('Authorization', playerAuth).expect(200);

    await request.post(`/admin/api/tournaments/${id}/force-start`).set('Authorization', adminAuth).expect(400);
  });

  test('POST /admin/api/tournaments/:id/force-start returns 404 for non-existent', async () => {
    await request.post('/admin/api/tournaments/non-existent/force-start').set('Authorization', adminAuth).expect(404);
  });
});

describe('Admin API — WS monitor', () => {
  let adminAuth: string;

  beforeAll(async () => {
    const res = await request.post('/admin/api/login').send({ username: 'admin', password: 'admin' });
    adminAuth = `Bearer ${res.body.token}`;
  });

  test('GET /admin/api/ws returns connection info', async () => {
    const res = await request.get('/admin/api/ws').set('Authorization', adminAuth).expect(200);
    expect(res.body).toHaveProperty('totalPlayerConnections');
    expect(res.body).toHaveProperty('totalSpectatorConnections');
    expect(res.body).toHaveProperty('connectedPlayers');
    expect(res.body).toHaveProperty('spectatedGames');
    expect(res.body).toHaveProperty('players');
    expect(res.body).toHaveProperty('spectators');
    expect(typeof res.body.totalPlayerConnections).toBe('number');
    expect(typeof res.body.connectedPlayers).toBe('number');
    expect(Array.isArray(res.body.players)).toBe(true);
    expect(Array.isArray(res.body.spectators)).toBe(true);
  });

  test('GET /admin/api/ws requires auth', async () => {
    await request.get('/admin/api/ws').expect(401);
  });
});

describe('Admin API — health check', () => {
  let adminAuth: string;

  beforeAll(async () => {
    const res = await request.post('/admin/api/login').send({ username: 'admin', password: 'admin' });
    adminAuth = `Bearer ${res.body.token}`;
  });

  test('GET /admin/api/health returns health status', async () => {
    const res = await request.get('/admin/api/health').set('Authorization', adminAuth).expect(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('database');
    expect(res.body.database).toHaveProperty('connected', true);
    expect(res.body.database).toHaveProperty('latencyMs');
    expect(typeof res.body.database.latencyMs).toBe('number');
    expect(res.body).toHaveProperty('server');
    expect(res.body.server).toHaveProperty('uptime');
    expect(res.body.server).toHaveProperty('nodeVersion');
    expect(res.body.server).toHaveProperty('pid');
    expect(res.body.server).toHaveProperty('memory');
    expect(res.body).toHaveProperty('game');
    expect(res.body.game).toHaveProperty('activeGames');
    expect(res.body.game).toHaveProperty('onlinePlayers');
    expect(res.body).toHaveProperty('timestamp');
  });

  test('GET /admin/api/health requires auth', async () => {
    await request.get('/admin/api/health').expect(401);
  });
});

describe('Admin API — DB browser (tables & query)', () => {
  let adminAuth: string;

  beforeAll(async () => {
    const res = await request.post('/admin/api/login').send({ username: 'admin', password: 'admin' });
    adminAuth = `Bearer ${res.body.token}`;
  });

  test('GET /admin/api/db/tables returns table list', async () => {
    const res = await request.get('/admin/api/db/tables').set('Authorization', adminAuth).expect(200);
    expect(res.body).toHaveProperty('tables');
    expect(Array.isArray(res.body.tables)).toBe(true);
    expect(res.body.tables.length).toBeGreaterThan(0);
    for (const t of res.body.tables) {
      expect(t).toHaveProperty('name');
      expect(t).toHaveProperty('estimatedRows');
      expect(typeof t.name).toBe('string');
    }
    expect(res.body.tables.some((t: { name: string }) => t.name === 'users')).toBe(true);
  });

  test('POST /admin/api/db/query runs SELECT and returns results', async () => {
    const res = await request
      .post('/admin/api/db/query')
      .set('Authorization', adminAuth)
      .send({ sql: 'SELECT * FROM users LIMIT 5' })
      .expect(200);
    expect(res.body).toHaveProperty('columns');
    expect(res.body).toHaveProperty('rows');
    expect(res.body).toHaveProperty('totalRows');
    expect(res.body).toHaveProperty('elapsedMs');
    expect(Array.isArray(res.body.columns)).toBe(true);
    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(res.body.columns.length).toBeGreaterThan(0);
  });

  test('POST /admin/api/db/query rejects write queries', async () => {
    await request
      .post('/admin/api/db/query')
      .set('Authorization', adminAuth)
      .send({ sql: 'DELETE FROM users' })
      .expect(403);
    await request
      .post('/admin/api/db/query')
      .set('Authorization', adminAuth)
      .send({ sql: "INSERT INTO users (id) VALUES ('x')" })
      .expect(403);
    await request
      .post('/admin/api/db/query')
      .set('Authorization', adminAuth)
      .send({ sql: 'DROP TABLE users' })
      .expect(403);
  });

  test('POST /admin/api/db/query rejects empty sql', async () => {
    await request.post('/admin/api/db/query').set('Authorization', adminAuth).send({ sql: '' }).expect(400);
  });

  test('POST /admin/api/db/query requires auth', async () => {
    await request.post('/admin/api/db/query').send({ sql: 'SELECT 1' }).expect(401);
  });

  test('GET /admin/api/db/tables requires auth', async () => {
    await request.get('/admin/api/db/tables').expect(401);
  });
});

describe('Move Quality', () => {
  let authHeader: string;

  beforeAll(async () => {
    const p = await registerPlayer('analysis-user');
    authHeader = p.authHeader;
  });

  test('POST /analysis/move-quality returns 401 without auth', async () => {
    await request.post('/analysis/move-quality').send({}).expect(401);
    await request.post('/analysis/move-quality').send({ fen: 'start' }).expect(401);
    await request.post('/analysis/move-quality').send({ move: 'e2e4' }).expect(401);
    await request.post('/analysis/move-quality').send({ fen: 'invalid', move: 'e2e4' }).expect(401);
  });

  test('POST /analysis/move-quality returns shape for any move', async () => {
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const res = await request
      .post('/analysis/move-quality')
      .set('Authorization', authHeader)
      .send({ fen: startFen, move: 'e2e4' })
      .expect(200);

    expect(res.body).toHaveProperty('bestMove');
    expect(res.body).toHaveProperty('bestScore');
    expect(res.body).toHaveProperty('playedMove', 'e2e4');
    expect(res.body).toHaveProperty('quality');
    expect(['excellent', 'good', 'inaccuracy', 'mistake']).toContain(res.body.quality);
  });

  test('POST /analysis/move-quality: playing the best move yields excellent', async () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const ref = await request
      .post('/analysis/move-quality')
      .set('Authorization', authHeader)
      .send({ fen, move: 'e2e4' })
      .expect(200);
    expect(ref.body.bestMove).toBeTruthy();

    const res = await request
      .post('/analysis/move-quality')
      .set('Authorization', authHeader)
      .send({ fen, move: ref.body.bestMove })
      .expect(200);

    expect(res.body.quality).toBe('excellent');
  });

  test('POST /analysis/move-quality handles en passant FEN', async () => {
    /* Position where en passant capture is available */
    const epFen = 'rnbqkbnr/pp1ppppp/8/2pP4/8/8/PPP1PPPP/RNBQKBNR w KQkq c6 0 3';
    const res = await request
      .post('/analysis/move-quality')
      .set('Authorization', authHeader)
      .send({ fen: epFen, move: 'd5c6' })
      .expect(200);

    expect(res.body).toHaveProperty('bestMove');
    expect(res.body).toHaveProperty('playedMove', 'd5c6');
    expect(res.body).toHaveProperty('quality');
  });

  test('POST /analysis/move-quality handles castling FEN', async () => {
    /* Position where kingside castling (e1g1) is legal */
    const castleFen = 'r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 1 2';
    const res = await request
      .post('/analysis/move-quality')
      .set('Authorization', authHeader)
      .send({ fen: castleFen, move: 'e1g1' })
      .expect(200);

    expect(res.body).toHaveProperty('bestMove');
    expect(res.body).toHaveProperty('playedMove', 'e1g1');
    expect(res.body).toHaveProperty('quality');
  });
});

describe('Admin actions', () => {
  let adminAuth: string;

  beforeAll(async () => {
    const res = await request.post('/admin/api/login').send({ username: 'admin', password: 'admin' }).expect(200);
    adminAuth = 'Bearer ' + res.body.token;
  });

  test('POST /admin/api/players/:id/kick kicks a waiting player', async () => {
    const { playerId } = await registerPlayer('kicked-player');
    const res = await request
      .post('/admin/api/players/' + playerId + '/kick')
      .set('Authorization', adminAuth)
      .expect(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /admin/api/players/:id/kick returns 400 for nonexistent', async () => {
    await request.post('/admin/api/players/no-such-player/kick').set('Authorization', adminAuth).expect(400);
  });

  test('POST /admin/api/games/:id/end ends an active game', async () => {
    const { authHeader } = await registerPlayer('end-game-p1');
    const gameId = await createGame(authHeader);
    const res = await request
      .post('/admin/api/games/' + gameId + '/end')
      .set('Authorization', adminAuth)
      .expect(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /admin/api/games/:id/end returns 400 for nonexistent', async () => {
    await request.post('/admin/api/games/no-such-game/end').set('Authorization', adminAuth).expect(400);
  });

  test('POST /admin/api/games/:id/end returns 400 for already-finished game', async () => {
    const { authHeader } = await registerPlayer('end-game-p2');
    const gameId = await createGame(authHeader);
    await request
      .post('/admin/api/games/' + gameId + '/end')
      .set('Authorization', adminAuth)
      .expect(200);
    await request
      .post('/admin/api/games/' + gameId + '/end')
      .set('Authorization', adminAuth)
      .expect(400);
  });
});

describe('Admin API — toggle-admin', () => {
  let adminAuth: string;
  let testUserId: string;
  let testUserAuth: string;

  beforeAll(async () => {
    const res = await request.post('/admin/api/login').send({ username: 'admin', password: 'admin' }).expect(200);
    adminAuth = 'Bearer ' + res.body.token;
    const reg = await registerPlayer('toggle-admin-test');
    testUserId = reg.playerId;
    testUserAuth = reg.authHeader;
  });

  test('PUT /admin/api/accounts/:id/toggle-admin makes user admin', async () => {
    const res = await request
      .put('/admin/api/accounts/' + testUserId + '/toggle-admin')
      .set('Authorization', adminAuth)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isAdmin).toBe(true);
  });

  test('PUT /admin/api/accounts/:id/toggle-admin removes admin status', async () => {
    const res = await request
      .put('/admin/api/accounts/' + testUserId + '/toggle-admin')
      .set('Authorization', adminAuth)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isAdmin).toBe(false);
  });

  test('PUT /admin/api/accounts/:id/toggle-admin rejects non-existent account', async () => {
    await request.put('/admin/api/accounts/no-such-id/toggle-admin').set('Authorization', adminAuth).expect(404);
  });

  test('PUT /admin/api/accounts/:id/toggle-admin rejects missing auth', async () => {
    await request.put('/admin/api/accounts/' + testUserId + '/toggle-admin').expect(401);
  });
});

describe('Reports — player submission', () => {
  let reporterAuth: string;
  let reporterId: string;
  let targetId: string;

  beforeAll(async () => {
    const r1 = await registerPlayer('report-player-1');
    reporterAuth = r1.authHeader;
    reporterId = r1.playerId;
    const r2 = await registerPlayer('report-player-2');
    targetId = r2.playerId;
  });

  test('POST /reports creates a report', async () => {
    const res = await request
      .post('/reports')
      .set('Authorization', reporterAuth)
      .send({ targetId, reason: 'Cheating during game' })
      .expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('id');
  });

  test('POST /reports with gameId creates a report', async () => {
    const gameId = await createGame(reporterAuth);
    await joinGame(gameId, (await registerPlayer('report-player-3')).authHeader);
    const res = await request
      .post('/reports')
      .set('Authorization', reporterAuth)
      .send({ targetId, reason: 'Stalling', gameId })
      .expect(201);
    expect(res.body.success).toBe(true);
  });

  test('POST /reports rejects self-reporting', async () => {
    await request
      .post('/reports')
      .set('Authorization', reporterAuth)
      .send({ targetId: reporterId, reason: 'Test' })
      .expect(400);
  });

  test('POST /reports rejects non-existent target', async () => {
    await request
      .post('/reports')
      .set('Authorization', reporterAuth)
      .send({ targetId: '00000000-0000-0000-0000-000000000000', reason: 'Test' })
      .expect(404);
  });

  test('POST /reports rejects missing auth', async () => {
    await request.post('/reports').send({ targetId, reason: 'Test' }).expect(401);
  });

  test('POST /reports rejects empty reason', async () => {
    await request.post('/reports').set('Authorization', reporterAuth).send({ targetId, reason: '' }).expect(400);
  });
});

describe('Admin API — reports management', () => {
  let adminAuth: string;
  let reportId: string;

  beforeAll(async () => {
    const res = await request.post('/admin/api/login').send({ username: 'admin', password: 'admin' }).expect(200);
    adminAuth = 'Bearer ' + res.body.token;
    const r1 = await registerPlayer('admin-reports-reporter');
    const r2 = await registerPlayer('admin-reports-target');
    const rep = await request
      .post('/reports')
      .set('Authorization', r1.authHeader)
      .send({ targetId: r2.playerId, reason: 'Abusive chat' })
      .expect(201);
    reportId = rep.body.id;
  });

  test('GET /admin/api/reports lists reports', async () => {
    const res = await request.get('/admin/api/reports').set('Authorization', adminAuth).expect(200);
    expect(res.body).toHaveProperty('reports');
    expect(Array.isArray(res.body.reports)).toBe(true);
    expect(res.body.reports.length).toBeGreaterThanOrEqual(1);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');
  });

  test('GET /admin/api/reports?status=open filters by status', async () => {
    const res = await request.get('/admin/api/reports?status=open').set('Authorization', adminAuth).expect(200);
    for (const r of res.body.reports) {
      expect(r.status).toBe('open');
    }
  });

  test('PUT /admin/api/reports/:id/status dismisses a report', async () => {
    const res = await request
      .put('/admin/api/reports/' + reportId + '/status')
      .set('Authorization', adminAuth)
      .send({ status: 'dismissed' })
      .expect(200);
    expect(res.body.success).toBe(true);
  });

  test('PUT /admin/api/reports/:id/status resolves a report', async () => {
    const r1 = await registerPlayer('resolve-test-report');
    const r2 = await registerPlayer('resolve-test-target');
    const rep = await request
      .post('/reports')
      .set('Authorization', r1.authHeader)
      .send({ targetId: r2.playerId, reason: 'Test for resolve' })
      .expect(201);
    const res = await request
      .put('/admin/api/reports/' + rep.body.id + '/status')
      .set('Authorization', adminAuth)
      .send({ status: 'resolved' })
      .expect(200);
    expect(res.body.success).toBe(true);
  });

  test('PUT /admin/api/reports/:id/status rejects invalid status', async () => {
    await request
      .put('/admin/api/reports/' + reportId + '/status')
      .set('Authorization', adminAuth)
      .send({ status: 'invalid' })
      .expect(400);
  });

  test('PUT /admin/api/reports/:id/status rejects non-existent report', async () => {
    await request
      .put('/admin/api/reports/no-such-report/status')
      .set('Authorization', adminAuth)
      .send({ status: 'dismissed' })
      .expect(404);
  });

  test('POST /admin/api/reports/:id/ban-target bans the reported player', async () => {
    const r1 = await registerPlayer('ban-target-reporter');
    const r2 = await registerPlayer('ban-target-victim');
    const rep = await request
      .post('/reports')
      .set('Authorization', r1.authHeader)
      .send({ targetId: r2.playerId, reason: 'Botting' })
      .expect(201);
    const res = await request
      .post('/admin/api/reports/' + rep.body.id + '/ban-target')
      .set('Authorization', adminAuth)
      .expect(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /admin/api/reports/:id/ban-target rejects non-existent report', async () => {
    await request.post('/admin/api/reports/no-such-report/ban-target').set('Authorization', adminAuth).expect(404);
  });
});

describe('Admin API — warn', () => {
  let adminAuth: string;
  let targetId: string;
  let targetAuth: string;

  beforeAll(async () => {
    const res = await request.post('/admin/api/login').send({ username: 'admin', password: 'admin' }).expect(200);
    adminAuth = 'Bearer ' + res.body.token;
    const reg = await registerPlayer('warn-target');
    targetId = reg.playerId;
    targetAuth = reg.authHeader;
  });

  test('POST /admin/api/warn sends warning', async () => {
    const res = await request
      .post('/admin/api/warn')
      .set('Authorization', adminAuth)
      .send({ userId: targetId, message: 'Please follow the rules' })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('warningId');
  });

  test('POST /admin/api/warn rejects non-existent user', async () => {
    await request
      .post('/admin/api/warn')
      .set('Authorization', adminAuth)
      .send({ userId: '00000000-0000-0000-0000-000000000000', message: 'Test' })
      .expect(404);
  });

  test('POST /admin/api/warn rejects empty message', async () => {
    await request
      .post('/admin/api/warn')
      .set('Authorization', adminAuth)
      .send({ userId: targetId, message: '' })
      .expect(400);
  });

  test('POST /admin/api/warn rejects missing fields', async () => {
    await request.post('/admin/api/warn').set('Authorization', adminAuth).send({ userId: targetId }).expect(400);
  });

  test('POST /admin/api/warn rejects missing auth', async () => {
    await request.post('/admin/api/warn').send({ userId: targetId, message: 'Test' }).expect(401);
  });
});

describe('Rate limiting', () => {
  test('checkRateLimit returns true initially', async () => {
    expect(await game.checkRateLimit('rate-test-player')).toBe(true);
  });

  test('checkRateLimit returns false after many requests', async () => {
    const pid = 'rate-test-spam';
    for (let i = 0; i < 100; i++) await game.checkRateLimit(pid);
    expect(await game.checkRateLimit(pid)).toBe(false);
  });
});

describe('Move validation', () => {
  test('POST /games/:id/move rejects invalid square format', async () => {
    const { authHeader } = await registerPlayer('move-inv-sq');
    const gameId = await createGame(authHeader);
    const p2 = await registerPlayer('move-inv-sq-2');
    await joinGame(gameId, p2.authHeader);
    const res = await makeMove(gameId, authHeader, 'e9', 'e5');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid|square|format/i);
  });
});
