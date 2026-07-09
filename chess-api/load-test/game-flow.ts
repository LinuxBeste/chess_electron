import { group, sleep } from 'k6';
import exec from 'k6/execution';
import { register, createGame, joinGame, makeMove, resignGame, OPENING_MOVES } from './helpers';
import type { Credentials } from './helpers';

export const options = {
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: false }],
  },
  scenarios: {
    game_flow: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '1m', target: 20 },
        { duration: '2m', target: 30 },
        { duration: '1m', target: 0 },
      ],
      gracefulStop: '30s',
    },
  },
};

export default function gameFlow(): void {
  const vuId = exec.vu.idInTest;
  const pairId = Math.floor(vuId / 2);

  const credsA: Credentials | null = register(`g${pairId}a`);
  const credsB: Credentials | null = register(`g${pairId}b`);

  if (!credsA || !credsB) {
    sleep(2);
    return;
  }

  sleep(0.5);

  group('game lifecycle', () => {
    const game = createGame(credsA.token);
    if (!game) return;

    sleep(0.3);

    const joined = joinGame(credsB.token, game.id);
    if (!joined) return;

    sleep(0.3);

    for (let i = 0; i < 6; i++) {
      const move = OPENING_MOVES[i];
      if (!move) break;

      const attacker = i % 2 === 0 ? credsA : credsB;
      if (!makeMove(attacker.token, game.id, move.from, move.to)) break;

      sleep(0.2);
    }

    resignGame(credsA.token, game.id);
  });

  sleep(1);
}
