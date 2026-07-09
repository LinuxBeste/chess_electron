import { check, sleep, group } from 'k6';
import ws from 'k6/ws';
import exec from 'k6/execution';
import { WS_URL, register, wsErrorRate, wsConnectTrend, randItem, CHAT_MESSAGES } from './helpers';
import type { Credentials } from './helpers';

export const options = {
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: false }],
  },
  scenarios: {
    websocket: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '1m', target: 25 },
        { duration: '2m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      gracefulStop: '30s',
    },
  },
};

export default function webSocketTest(): void {
  const vuId = exec.vu.idInTest;
  const creds: Credentials | null = register(`w${vuId}`);
  if (!creds) {
    sleep(1);
    return;
  }

  sleep(0.3);

  group('websocket', () => {
    const wsStart = Date.now();
    const res = ws.connect(WS_URL, { headers: { 'Sec-WebSocket-Protocol': creds.token } }, (socket) => {
      socket.on('open', () => {
        wsConnectTrend.add(Date.now() - wsStart);

        socket.send(JSON.stringify({ type: 'get_lobby_chat_history' }));

        for (let i = 0; i < 3; i++) {
          socket.send(JSON.stringify({ type: 'lobby_chat', text: randItem(CHAT_MESSAGES) }));
        }
      });

      let msgCount = 0;
      socket.on('message', () => {
        msgCount++;
      });

      socket.setTimeout(() => {
        check(msgCount > 0, { 'received WS messages': (v: number) => v });
        if (msgCount === 0) wsErrorRate.add(1);
        socket.close();
      }, 5000);
    });

    check(res, { 'WS connected (status 101)': (r: { status: number } | null) => r && r.status === 101 });
    wsErrorRate.add(!(res && res.status === 101));
  });

  sleep(1);
}
