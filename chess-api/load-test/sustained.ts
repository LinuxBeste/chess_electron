import http from 'k6/http';
import { sleep, group } from 'k6';
import ws from 'k6/ws';
import exec from 'k6/execution';
import {
  BASE_URL,
  WS_URL,
  register,
  login,
  getMe,
  getHealth,
  getGamesList,
  createGame,
  joinGame,
  makeMove,
  resignGame,
  OPENING_MOVES,
} from './helpers';
import type { Credentials } from './helpers';

export const options = {
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: false }],
  },
  scenarios: {
    sustained: {
      executor: 'constant-vus',
      vus: 20,
      duration: '5m',
      gracefulStop: '30s',
    },
  },
};

export default function mixedWorkload(): void {
  const vuId = exec.vu.idInTest;

  http.get(`${BASE_URL}/health`);
  sleep(Math.random() * 0.5);

  const creds: Credentials | null = register(`s${vuId}`);
  if (!creds) {
    sleep(1);
    return;
  }

  sleep(Math.random() * 0.3);

  const roll = Math.random();

  if (roll < 0.3) {
    group('read heavy', () => {
      const loginResult = login(creds.username, creds.password);
      if (loginResult) {
        getMe(loginResult.token);
        sleep(Math.random() * 0.2);
        getGamesList(loginResult.token);
        sleep(Math.random() * 0.2);
        getHealth();
      }
    });
  } else if (roll < 0.6) {
    group('game play', () => {
      const game = createGame(creds.token);
      if (game) {
        sleep(0.2);
        const partner: Credentials | null = register(`sp${vuId}`);
        if (partner) {
          joinGame(partner.token, game.id);
          sleep(0.2);
          for (let i = 0; i < 4; i++) {
            const move = OPENING_MOVES[i];
            if (!move) break;
            const mover = i % 2 === 0 ? creds : partner;
            if (!makeMove(mover.token, game.id, move.from, move.to)) break;
            sleep(0.1);
          }
          resignGame(creds.token, game.id);
        }
      }
    });
  } else {
    group('websocket', () => {
      ws.connect(WS_URL, { headers: { 'Sec-WebSocket-Protocol': creds.token } }, (socket) => {
        socket.on('open', () => {
          socket.send(JSON.stringify({ type: 'lobby_chat', text: 'load test message' }));
        });
        socket.setTimeout(() => socket.close(), 3000);
      });
    });
  }

  sleep(2);
}
