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
  const res = await request
    .post('/auth/register')
    .send({ username })
    .expect(201);
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
  const res = await request
    .post('/games')
    .set('Authorization', authHeader)
    .expect(201);
  return res.body.id;
}

/* Join a game as black (expects 200 OK). */
async function joinGame(gameId: string, authHeader: string): Promise<void> {
  await request
    .post(`/games/${gameId}/join`)
    .set('Authorization', authHeader)
    .expect(200);
}

/* Make a move in a game.  Returns the response for further assertions. */
async function makeMove(
  gameId: string,
  authHeader: string,
  from: string,
  to: string,
): Promise<supertest.Response> {
  return request
    .post(`/games/${gameId}/move`)
    .set('Authorization', authHeader)
    .send({ from, to });
}

describe('Auth', () => {
  test('POST /auth/register creates a player and returns token', async () => {
    /* Happy path: registration returns playerId and bearer token */
    const res = await request
      .post('/auth/register')
      .send({ username: 'alice' })
      .expect(201);
    expect(res.body).toHaveProperty('playerId');
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.playerId).toBe('string');
    expect(typeof res.body.token).toBe('string');
  });

  test('POST /auth/register rejects empty username', async () => {
    /* Empty string is not a valid username */
    await request
      .post('/auth/register')
      .send({ username: '' })
      .expect(400);
  });

  test('GET /auth/me returns player info with valid token', async () => {
    /* Register a player, then verify the token works for /auth/me */
    const { token } = await registerPlayer('bob');
    const res = await request
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.username).toBe('bob');
    expect(res.body).toHaveProperty('id');
  });

  test('GET /auth/me rejects invalid token', async () => {
    /* Random token should be rejected */
    await request
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  test('GET /auth/me rejects missing auth header', async () => {
    /* No auth header at all -> 401 */
    await request
      .get('/auth/me')
      .expect(401);
  });
});

describe('Game creation and joining', () => {
  test('POST /games creates a waiting game', async () => {
    /* New game starts in 'waiting' status with only the white player */
    const { authHeader } = await registerPlayer('p1');
    const res = await request
      .post('/games')
      .set('Authorization', authHeader)
      .expect(201);
    expect(res.body.status).toBe('waiting');
    expect(res.body.players.white).toBeDefined();
  });

  test('GET /games lists waiting games', async () => {
    /* Create one game and verify it shows up in the open games list */
    await registerPlayer('p2');
    const white = await registerPlayer('p2_2');
    await createGame(white.authHeader);

    const res = await request
      .get('/games')
      .expect(200);
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

    const res = await request
      .post(`/games/${gameId}/join`)
      .set('Authorization', black.authHeader)
      .expect(200);
    expect(res.body.status).toBe('active');
    expect(res.body.players.white).toBe(white.playerId);
    expect(res.body.players.black).toBe(black.playerId);
  });

  test('cannot join your own game', async () => {
    /* Creator cannot also join as black (no self-play) */
    const p = await registerPlayer('lonely');
    const gameId = await createGame(p.authHeader);

    await request
      .post(`/games/${gameId}/join`)
      .set('Authorization', p.authHeader)
      .expect(400);
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
    await makeMove(gameId, white.authHeader, 'e2', 'e4').then(r => expect(r.status).toBe(200));
    /* 1... e5 — black responds symmetrically */
    await makeMove(gameId, black.authHeader, 'e7', 'e5').then(r => expect(r.status).toBe(200));
    /* 2. Qh5 — white develops queen early (aggressive) */
    await makeMove(gameId, white.authHeader, 'd1', 'h5').then(r => expect(r.status).toBe(200));
    /* 2... Nc6 — black develops a knight */
    await makeMove(gameId, black.authHeader, 'b8', 'c6').then(r => expect(r.status).toBe(200));
    /* 3. Bc4 — white develops bishop to threatening diagonal */
    await makeMove(gameId, white.authHeader, 'f1', 'c4').then(r => expect(r.status).toBe(200));
    /* 3... Nf6 — black develops other knight (doesn't see the threat) */
    await makeMove(gameId, black.authHeader, 'g8', 'f6').then(r => expect(r.status).toBe(200));
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

    const res = await request
      .post(`/games/${gameId}/resign`)
      .set('Authorization', white.authHeader)
      .expect(200);
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

    const res = await request
      .get(`/games/${gameId}/moves`)
      .set('Authorization', white.authHeader)
      .expect(200);
    expect(res.body.moves).toBeDefined();
    expect(Array.isArray(res.body.moves)).toBe(true);
    expect(res.body.moves.length).toBeGreaterThan(0);
    /* Each move has from/to fields */
    expect(res.body.moves[0]).toHaveProperty('from');
    expect(res.body.moves[0]).toHaveProperty('to');
  });
});

describe('GET /health', () => {
  test('returns health status with uptime and stats', async () => {
    /* Health endpoint is unauthenticated and always returns OK */
    const res = await request
      .get('/health')
      .expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('gamesActive');
    expect(res.body).toHaveProperty('playersOnline');
  });
});
