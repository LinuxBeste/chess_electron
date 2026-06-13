# Deployment

## Prerequisites

- Node.js 20 or Docker

## Local Development

```bash
# Install dependencies (from workspace root)
pnpm install

# Build (admin frontend + API server)
pnpm run build

# Run tests
pnpm test

# Start
pnpm start
```

Server listens on port 25565 by default. Override with `PORT` environment variable.

```bash
PORT=4000 pnpm start
```

## Admin Dashboard

The admin dashboard is a React SPA (Vite + TailwindCSS + lucide-react) served at `/admin/`.
It is built automatically as part of `pnpm run build` — Vite output goes into `dist/admin/`
and is served as static files by Express.

Default credentials: `admin` / `admin` (configurable via `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars).

## Docker

### Build

```bash
docker build -t chess-api .
```

The `Dockerfile` uses a multi-stage build:

1. **builder** stage — installs all dependencies (API + admin frontend), builds the React app with Vite, compiles TypeScript
2. **runner** stage — copies only production dependencies and compiled JS

### Docker Compose with Cloudflare Tunnel

```bash
docker compose up --build -d
```

The compose configuration includes:

- `chess-api` — internal-only on port 3000 (not exposed to host)
- `cloudflared` — Cloudflare Tunnel for public HTTPS access

Get your public URL:

```bash
docker compose logs cloudflared
# → https://<random>.trycloudflare.com
```

No open firewall ports required. TLS is handled automatically by Cloudflare.

### Named tunnel (permanent URL)

1. Install `cloudflared` on your machine
2. Run `cloudflared tunnel create chess-app` to create a tunnel and get credentials
3. Update `cloudflared/config.yml` with your tunnel ID and credentials file path
4. Mount the credentials volume in `docker-compose.yml` (uncomment the named tunnel section)
5. Set up DNS in Cloudflare dashboard to point your domain to the tunnel

## Environment Variables

| Variable                     | Default   | Description                                                       |
| ---------------------------- | --------- | ----------------------------------------------------------------- |
| `PORT`                       | `25565`   | HTTP/WS server port                                               |
| `NODE_ENV`                   | —         | Set to `test` to skip server startup (used by test runner)        |
| `ADMIN_USERNAME`             | `admin`   | Admin dashboard login username                                    |
| `ADMIN_PASSWORD`             | (random)  | Admin dashboard login password (auto-generated if not set)        |
| `ADMIN_TOKEN_TTL`            | `86400000`| Admin session token TTL in ms (default 24h)                       |
| `CORS_ORIGIN`                | `*`       | Allowed CORS origin                                               |
| `DB_PATH`                    | `data/chess.db` | SQLite database file path                                   |
| `MAX_GAMES_PER_PLAYER`       | `20`      | Maximum concurrent active games per player                        |
| `RATE_LIMIT_WINDOW_MS`       | `60000`   | Rate limit sliding window in ms                                   |
| `RATE_LIMIT_MAX_REQUESTS`    | `100`     | Max requests per player per window                                |
| `LOG_LEVEL`                  | `info`    | Log level: error, warn, info, debug                               |
| `WAITING_TTL_MS`             | `600000`  | Orphaned waiting game TTL (default 10 min, 0 to disable)          |
| `WS_HEARTBEAT_INTERVAL`      | `30000`   | WebSocket ping interval in ms                                     |
| `WS_PONG_TIMEOUT`            | `10000`   | WebSocket pong timeout before termination in ms                   |
| `WS_MAX_CONNECTIONS_PER_IP`  | `5`       | Max WebSocket connections per IP                                  |
| `LOGIN_MAX_ATTEMPTS`         | `5`       | Failed logins before account lockout                              |
| `LOGIN_LOCKOUT_MINUTES`      | `15`      | Account lockout duration in minutes                               |
| `DB_BACKUP_INTERVAL_MS`      | `21600000`| DB backup interval in ms (default 6h, 0 to disable)              |
| `MAX_CONCURRENT_ENGINES`     | `4`       | Max concurrent Stockfish engine instances for bot games           |

## start.sh

The `start.sh` script orchestrates both Docker and native modes with optional tunnel support:

```bash
# Docker mode (default) — API internal, cloudflared in stack
./start.sh

# Docker + extract cloudflared URL
./start.sh --tunnel cloudflared

# Native mode (npm start)
./start.sh --native

# Native + tunnel
./start.sh --native --tunnel cloudflared
```

## Testing

```bash
pnpm test
```

Runs Jest with `--forceExit --detectOpenHandles`. The test suite:

- `chess.test.ts` — unit tests covering the full chess engine
- `game.test.ts` — game logic unit tests
- `api.test.ts` — integration tests covering the full API surface and admin routes

Tests are designed to run outside Docker without any external services.
