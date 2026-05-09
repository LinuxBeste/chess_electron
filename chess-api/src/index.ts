/* Bootstrap file — creates the Express app, attaches WebSocket support,
 * and starts listening on the configured port.  Exported separately so
 * supertest can import the app without starting the server. */

import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import routes from './routes';
import * as game from './game';

export const app = express();

/* Parse incoming JSON request bodies for all routes */
app.use(express.json());
/* Attach all API routes */
app.use(routes);

/**
 * Create an HTTP server with WebSocket upgrade support.
 *
 * WebSocket connections are authenticated via a query parameter:
 *   ws://host:port/?token=<bearer-token>
 *
 * This is less conventional than upgrading an authenticated HTTP request,
 * but it works cleanly with browser WebSocket APIs that don't support
 * custom headers.
 */
export function createServer(): http.Server {
  const server = http.createServer(app);

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    /* Parse the token from the URL query string.
     * The `ws` library passes the raw request URL, so we need a dummy
     * base for the WHATWG URL parser to work correctly. */
    const url = new URL(req.url ?? '/', 'http://localhost');
    const token = url.searchParams.get('token');

    /* Reject connections without a token */
    if (!token) {
      ws.close(4001, 'Token required');
      return;
    }

    /* Reject connections with an invalid/unknown token */
    const player = game.authenticatePlayer(token);
    if (!player) {
      ws.close(4001, 'Invalid token');
      return;
    }

    /* Register the connection so the player receives game events */
    game.registerWSConnection(player.id, ws);

    /* Clean up when the connection drops */
    ws.on('close', () => {
      game.removeWSConnection(player.id, ws);
    });
  });

  return server;
}

/* Conditional server start: skip when imported by Jest (test environment).
 * This lets supertest bind to the app without port conflicts. */
const isTestEnv = typeof process.env.JEST_WORKER_ID !== 'undefined' || process.env.NODE_ENV === 'test';
if (!isTestEnv) {
  const PORT = parseInt(process.env.PORT ?? '3000', 10);
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`Chess API server listening on port ${PORT}`);
  });
}
