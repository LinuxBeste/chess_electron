import { check, group, sleep } from 'k6';
import exec from 'k6/execution';
import { register, login, getMe, getHealth, getGamesList } from './helpers.ts';
import type { Credentials } from './helpers';

export const options = {
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: false }],
  },
  scenarios: {
    http_baseline: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '1m', target: 100 },
        { duration: '2m', target: 100 },
        { duration: '1m', target: 0 },
      ],
      gracefulStop: '10s',
    },
  },
};

export default function httpBaseline(): void {
  const vuId = exec.vu.idInTest;
  const creds: Credentials | null = register(`h${vuId}`);
  if (!creds) {
    sleep(1);
    return;
  }

  sleep(Math.random() * 0.5);

  group('auth flow', () => {
    const loginResult = login(creds.username, creds.password);
    check(loginResult, { 'logged in': (r: { token: string } | null) => r && r.token });

    if (loginResult) {
      getMe(loginResult.token);
      sleep(Math.random() * 0.3);
    }
  });

  group('read endpoints', () => {
    getHealth();
    sleep(Math.random() * 0.2);
    getGamesList(creds.token);
    sleep(Math.random() * 0.2);
  });

  sleep(1);
}
