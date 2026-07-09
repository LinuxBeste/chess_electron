import { group, sleep } from 'k6';
import exec from 'k6/execution';
import { register, createBotGame, makeMove, resignGame, OPENING_MOVES } from './helpers';
import type { Credentials } from './helpers';

export const options = {
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: false }],
  },
  scenarios: {
    engine: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 2 },
        { duration: '1m', target: 5 },
        { duration: '2m', target: 10 },
        { duration: '1m', target: 0 },
      ],
      gracefulStop: '30s',
    },
  },
};

export default function engineStress(): void {
  const vuId = exec.vu.idInTest;
  const creds: Credentials | null = register(`e${vuId}`);
  if (!creds) {
    sleep(1);
    return;
  }

  sleep(0.5);

  group('engine', () => {
    const game = createBotGame(creds.token, (vuId % 3) + 1);
    if (!game) return;

    sleep(1);

    for (let i = 0; i < 4; i++) {
      const move = OPENING_MOVES[i];
      if (!move) break;
      if (!makeMove(creds.token, game.id, move.from, move.to)) break;
      sleep(1);
    }

    resignGame(creds.token, game.id);
  });

  sleep(2);
}
