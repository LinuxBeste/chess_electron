# Load Tests

Uses [k6](https://k6.io) to stress-test the chess API.

## Setup

### Option A: Docker exec (recommended)

k6 is pre-installed in the Docker image:

```bash
# Run any scenario
docker exec -it chess-api-chess-api-1 chess-admin load-test -s http_baseline
docker exec -it chess-api-chess-api-1 chess-admin load-test -s game_flow
docker exec -it chess-api-chess-api-1 chess-admin load-test -s websocket
docker exec -it chess-api-chess-api-1 chess-admin load-test -s engine
docker exec -it chess-api-chess-api-1 chess-admin load-test -s sustained
docker exec -it chess-api-chess-api-1 chess-admin load-test -s max_load
# Export JSON summary
docker exec -it chess-api-chess-api-1 chess-admin load-test -s sustained -o results.json
```

### Option B: CLI (host)

The chess-admin CLI runs k6 directly on the host (requires k6 installed):

```bash
# Run any scenario
chess-admin load-test -s http_baseline
chess-admin load-test -s game_flow
chess-admin load-test -s websocket
chess-admin load-test -s engine
chess-admin load-test -s sustained
chess-admin load-test -s max_load
```

### Option C: Native

```bash
# Install k6 (Debian/Ubuntu)
sudo apt install k6

# Or download from https://k6.io/docs/getting-started/installation/
```

## Server Preparation

The default rate limits will block load test traffic. On the server,
add these to your `.env` before starting:

```bash
IP_RATE_LIMIT_MAX=100000
REG_RATE_LIMIT_MAX=100000
RATE_LIMIT_MAX_REQUESTS=100000
WS_MAX_CONNECTIONS_PER_IP=1000
```

Otherwise tests will hit 429/403 on registration and login.

## Usage (Native)

```bash
# Build first, then run
cd chess-api && pnpm build:loadtest

# Run a specific scenario
k6 run --env BASE_URL=http://192.168.178.198:25565 \
       dist/http-baseline.js

# Test from localhost
k6 run --env BASE_URL=http://localhost:25565 dist/game-flow.js
```

## Scenarios

| Scenario        | What it does                              | Duration | VUs         |
| --------------- | ----------------------------------------- | -------- | ----------- |
| `http_baseline` | Register, login, profile, read endpoints  | 6m       | 1→100→0     |
| `game_flow`     | Create game, join, make moves, resign     | 5m       | 1→30→0      |
| `websocket`     | Connect WS, send chat, receive messages   | 5m       | 1→50→0      |
| `engine`        | Create bot games, engine move analysis    | 4m30s    | 1→10→0      |
| `sustained`     | Mixed HTTP + WS + game workload           | 5m       | 20 constant |
| `max_load`      | Aggressive ramp-up to find breaking point | 6m30s    | 1→200       |

## Output

k6 prints a summary with:

- HTTP request rate (req/s) and latency (p50/p95/p99)
- Error rate per endpoint group
- Custom metrics (`*_duration`, `*_errors`)

For JSON export (for Grafana or analysis):

```bash
k6 run --env BASE_URL=http://192.168.178.198:25565 \
       --summary-export=results.json \
       dist/http-baseline.js
```

## Notes

- Each VU registers its own user. At high VU counts, the DB will
  accumulate many test users (clean up with the admin CLI).
- The `engine` and `max_load` scenarios may leave running bot games.
  Server cleanup sweeps remove stale games after 10 min.
- The `websocket` scenario connects from a single IP and will be
  limited by `WS_MAX_CONNECTIONS_PER_IP` unless raised.
