/* WebSocket end-to-end tests.
 *
 * Calls createServer() from index.ts to get a real HTTP+WS server,
 * then connects with real ws clients.  The server listens on a random
 * port so tests don't conflict with each other or the dev server.
 */

import { createServer, app } from '../src/index';
import http from 'http';
import { WebSocket } from 'ws';
import supertest from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as game from '../src/game';

const request = supertest(app);

let server: http.Server;
let port: number;

/* Register a player via HTTP and return auth info. */
async function registerPlayer(username: string): Promise<{ playerId: string; token: string; authHeader: string }> {
  const res = await request.post('/auth/register').send({ username }).expect(201);
  return {
    playerId: res.body.playerId,
    token: res.body.token,
    authHeader: `Bearer ${res.body.token}`,
  };
}

beforeAll(async () => {
  server = createServer();
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      port = (server.address() as any).port;
      resolve();
    });
  });
});

afterAll(() => {
  server.close();
});

/* Helper: connect a WS client, resolves when 'open' fires. */
function wsConnect(token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`, token);
    const timer = setTimeout(() => reject(new Error('WS connect timeout')), 5000);
    ws.on('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/* Helper: wait for the WebSocket to close and return the close code. */
function wsWaitForClose(ws: WebSocket): Promise<number> {
  return new Promise((resolve) => {
    ws.on('close', (code: number) => resolve(code));
  });
}

/* Helper: wait for a specific message type from a WS connection. */
function waitForMessage(ws: WebSocket, type: string, timeout = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for ' + type)), timeout);
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === type) {
          clearTimeout(timer);
          resolve(msg);
        }
      } catch {
        /* ignore malformed */
      }
    });
  });
}

/* Helper: send a JSON message. */
function wsSend(ws: WebSocket, msg: Record<string, unknown>): void {
  ws.send(JSON.stringify(msg));
}

describe('WebSocket connection', () => {
  test('connects with a valid token', async () => {
    const p = await registerPlayer('ws_valid');
    const ws = await wsConnect(p.token);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  test('connects with comma-separated protocol header', async () => {
    const p = await registerPlayer('ws_comma');
    const ws = await new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}`, [p.token, 'extra-value']);
      const timer = setTimeout(() => reject(new Error('WS connect timeout')), 5000);
      ws.on('open', () => {
        clearTimeout(timer);
        resolve(ws);
      });
      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  test('rejects connection without token', async () => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 5000);
      ws.on('open', () => {
        clearTimeout(timer);
        resolve();
      });
      ws.on('error', () => {
        clearTimeout(timer);
        reject(new Error('connect error'));
      });
    });
    const code = await wsWaitForClose(ws);
    expect(code).toBe(4001);
  });

  test('rejects connection with invalid token', async () => {
    const ws = await wsConnect('no-such-token');
    const code = await wsWaitForClose(ws);
    expect(code).toBe(4001);
  });
});

describe('WebSocket spectate', () => {
  test('spectate_ok for active game', async () => {
    const host = await registerPlayer('ws_spec_host');
    const spec = await registerPlayer('ws_spec_viewer');

    const ws = await wsConnect(spec.token);
    const gameRes = await request.post('/games').set('Authorization', host.authHeader).expect(201);
    const gameId = gameRes.body.id;

    const joiner = await registerPlayer('ws_spec_join');
    await request.post(`/games/${gameId}/join`).set('Authorization', joiner.authHeader).expect(200);

    wsSend(ws, { type: 'spectate', gameId });
    const msg = await waitForMessage(ws, 'spectate_ok');
    expect(msg.gameId).toBe(gameId);
    ws.close();
  });

  test('spectate_error for waiting game', async () => {
    const spec = await registerPlayer('ws_spec_wait');
    const ws = await wsConnect(spec.token);

    wsSend(ws, { type: 'spectate', gameId: 'no-such-game' });
    const msg = await waitForMessage(ws, 'spectate_error');
    expect(msg.error).toBeDefined();
    ws.close();
  });

  test('spectate_error for non-existent game', async () => {
    const spec = await registerPlayer('ws_spec_none');
    const ws = await wsConnect(spec.token);

    wsSend(ws, { type: 'spectate', gameId: 'non-existent-id' });
    const msg = await waitForMessage(ws, 'spectate_error');
    expect(msg.error).toBeDefined();
    ws.close();
  });

  test('spectate_code mode: code returned on creation', async () => {
    const host = await registerPlayer('ws_code_host');
    const res = await request
      .post('/games')
      .set('Authorization', host.authHeader)
      .send({ spectateMode: 'code' })
      .expect(201);
    expect(res.body.spectateMode).toBe('code');
    expect(res.body.spectateCode).toBeDefined();
    expect(typeof res.body.spectateCode).toBe('string');
  });

  test('spectate_code mode: rejected without code', async () => {
    const host = await registerPlayer('ws_code_nocode');
    const spec = await registerPlayer('ws_code_nocode_v');
    const res = await request
      .post('/games')
      .set('Authorization', host.authHeader)
      .send({ spectateMode: 'code' })
      .expect(201);
    const gameId = res.body.id;
    const joiner = await registerPlayer('ws_code_nocode_j');
    await request.post(`/games/${gameId}/join`).set('Authorization', joiner.authHeader).expect(200);

    const ws = await wsConnect(spec.token);
    wsSend(ws, { type: 'spectate', gameId });
    const msg = await waitForMessage(ws, 'spectate_error');
    expect(msg.error).toMatch(/spectate code/i);
    ws.close();
  });

  test('spectate_code mode: accepted with correct code', async () => {
    const host = await registerPlayer('ws_code_ok');
    const spec = await registerPlayer('ws_code_ok_v');
    const res = await request
      .post('/games')
      .set('Authorization', host.authHeader)
      .send({ spectateMode: 'code' })
      .expect(201);
    const gameId = res.body.id;
    const spectateCode: string = res.body.spectateCode;
    const joiner = await registerPlayer('ws_code_ok_j');
    await request.post(`/games/${gameId}/join`).set('Authorization', joiner.authHeader).expect(200);

    const ws = await wsConnect(spec.token);
    wsSend(ws, { type: 'spectate', gameId, code: spectateCode });
    const msg = await waitForMessage(ws, 'spectate_ok');
    expect(msg.gameId).toBe(gameId);
    ws.close();
  });

  test('spectate_code mode: rejected with wrong code', async () => {
    const host = await registerPlayer('ws_code_bad');
    const spec = await registerPlayer('ws_code_bad_v');
    const res = await request
      .post('/games')
      .set('Authorization', host.authHeader)
      .send({ spectateMode: 'code' })
      .expect(201);
    const gameId = res.body.id;
    const joiner = await registerPlayer('ws_code_bad_j');
    await request.post(`/games/${gameId}/join`).set('Authorization', joiner.authHeader).expect(200);

    const ws = await wsConnect(spec.token);
    wsSend(ws, { type: 'spectate', gameId, code: 'wrong-code' });
    const msg = await waitForMessage(ws, 'spectate_error');
    expect(msg.error).toMatch(/spectate code/i);
    ws.close();
  });

  test('spectate_code mode: spectateCode not leaked in game listings', async () => {
    const host = await registerPlayer('ws_code_leak');
    const res = await request
      .post('/games')
      .set('Authorization', host.authHeader)
      .send({ spectateMode: 'code' })
      .expect(201);

    /* The creation response includes the code */
    expect(res.body.spectateCode).toBeDefined();

    /* getGame should strip it */
    const getRes = await request.get('/games/' + res.body.id).expect(200);
    expect(getRes.body.spectateCode).toBeUndefined();

    /* active games should strip it */
    const activeRes = await request.get('/games/active').expect(200);
    for (const g of activeRes.body) {
      expect(g.spectateCode).toBeUndefined();
    }
  });
});

describe('WebSocket chat', () => {
  test('chat message does not throw', async () => {
    const p1 = await registerPlayer('ws_chat_p1');
    const p2 = await registerPlayer('ws_chat_p2');

    const ws1 = await wsConnect(p1.token);
    const gameRes = await request.post('/games').set('Authorization', p1.authHeader).expect(201);
    const gameId = gameRes.body.id;
    await request.post(`/games/${gameId}/join`).set('Authorization', p2.authHeader).expect(200);

    wsSend(ws1, { type: 'chat_message', gameId, text: 'hello' });
    /* No direct response to chat — just verify no crash */
    await new Promise((r) => setTimeout(r, 100));
    ws1.close();
  });
});

describe('WebSocket challenges', () => {
  test('challenge sent to target player', async () => {
    const p1 = await registerPlayer('ws_chal_p1');
    const p2 = await registerPlayer('ws_chal_p2');

    const ws1 = await wsConnect(p1.token);
    const ws2 = await wsConnect(p2.token);

    const gameRes = await request.post('/games').set('Authorization', p1.authHeader).expect(201);
    const gameId = gameRes.body.id;

    wsSend(ws1, { type: 'challenge', toPlayerId: p2.playerId, gameId });

    const msg = await waitForMessage(ws2, 'challenge');
    expect(msg.fromPlayerId).toBe(p1.playerId);
    expect(msg.gameId).toBe(gameId);
    ws1.close();
    ws2.close();
  });

  test('challenge_accept forwarded to target', async () => {
    const p1 = await registerPlayer('ws_chal_a1');
    const p2 = await registerPlayer('ws_chal_a2');

    const ws1 = await wsConnect(p1.token);
    const ws2 = await wsConnect(p2.token);

    const gameRes = await request.post('/games').set('Authorization', p1.authHeader).expect(201);
    const gameId = gameRes.body.id;

    wsSend(ws1, { type: 'challenge_accept', toPlayerId: p2.playerId, gameId });

    const msg = await waitForMessage(ws2, 'challenge_accept');
    expect(msg.fromPlayerId).toBe(p1.playerId);
    expect(msg.gameId).toBe(gameId);
    ws1.close();
    ws2.close();
  });

  test('challenge_decline forwarded to target', async () => {
    const p1 = await registerPlayer('ws_chal_d1');
    const p2 = await registerPlayer('ws_chal_d2');

    const ws1 = await wsConnect(p1.token);
    const ws2 = await wsConnect(p2.token);

    const gameRes = await request.post('/games').set('Authorization', p1.authHeader).expect(201);
    const gameId = gameRes.body.id;

    wsSend(ws1, { type: 'challenge_decline', toPlayerId: p2.playerId, gameId });

    const msg = await waitForMessage(ws2, 'challenge_decline');
    expect(msg.fromPlayerId).toBe(p1.playerId);
    expect(msg.gameId).toBe(gameId);
    ws1.close();
    ws2.close();
  });
});
