# Admin Dashboard Guide

## Access

The admin dashboard is served at `/admin/` on the API server. Build it first:

```bash
pnpm run build
# Vite output → dist/admin/
```

Start the server and navigate to `http://localhost:25565/admin/`.

## Authentication

Login with credentials configured via environment variables:

| Variable                      | Default          | Description                                                                                             |
| ----------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| `ADMIN_USERNAME`              | `admin`          | Login username                                                                                          |
| `ADMIN_PASSWORD`              | (auto-generated) | Login password. If unset, a random 24-char hex string is logged at startup. **Required in production.** |
| `ADMIN_TOKEN_TTL`             | `86400000` (24h) | Session token TTL in ms                                                                                 |
| `ADMIN_LOGIN_MAX_ATTEMPTS`    | `5`              | Failed attempts before temporary lockout                                                                |
| `ADMIN_LOGIN_LOCKOUT_MINUTES` | `15`             | Lockout duration after too many failures                                                                |

The session is a bearer token stored in `localStorage`. Tokens are single-session; logging in elsewhere won't invalidate other sessions.

## Dashboard Sections

- **Overview** — active/waiting/completed game counts, online players, recent registrations, engine load
- **Games** — search games by ID or player, view board state, move history, abort active games
- **Players** — search/ban/unban players, view game history, reset lockouts
- **Bans** — view and manage IP + player bans
- **Engine** — monitor Stockfish engine pool (active, idle, queued)
- **Logs** — tail log files in real-time via `/admin/api/logs`
- **Config** — read-only view of runtime configuration

## API Endpoints

All admin endpoints are under `/admin/api/*` and require the `Authorization: Bearer <token>` header.

| Method   | Path                           | Description                        |
| -------- | ------------------------------ | ---------------------------------- |
| `POST`   | `/admin/api/login`             | Authenticate, returns bearer token |
| `POST`   | `/admin/api/logout`            | Invalidate session                 |
| `GET`    | `/admin/api/stats`             | Server statistics                  |
| `GET`    | `/admin/api/games`             | List/search games                  |
| `GET`    | `/admin/api/games/:id`         | Game detail with board state       |
| `DELETE` | `/admin/api/games/:id`         | Abort a game                       |
| `GET`    | `/admin/api/players`           | List/search players                |
| `GET`    | `/admin/api/players/:id`       | Player detail                      |
| `POST`   | `/admin/api/players/:id/ban`   | Ban a player                       |
| `POST`   | `/admin/api/players/:id/unban` | Unban a player                     |
| `GET`    | `/admin/api/bans`              | List all bans                      |
| `DELETE` | `/admin/api/bans/:id`          | Remove a ban                       |
| `GET`    | `/admin/api/engine`            | Engine pool status                 |
| `GET`    | `/admin/api/config`            | Runtime configuration              |
| `GET`    | `/admin/api/logs`              | Tail recent log entries            |

## Stockfish Engine Configuration

The engine manager spawns Stockfish as a child process. Configure via environment variables:

| Variable                     | Default | Description                                                                                                                                                                                 |
| ---------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MAX_CONCURRENT_ENGINES`     | `4`     | Maximum concurrent Stockfish instances. Each bot game uses one engine. When all engines are busy, additional bot games wait in a queue.                                                     |
| `ENGINE_DEFAULT_MOVETIME_MS` | `500`   | Time (ms) Stockfish searches per move. Higher = stronger play, higher latency.                                                                                                              |
| `ENGINE_POLL_INTERVAL_MS`    | `100`   | How often (ms) the engine manager polls for UCI output.                                                                                                                                     |
| `ENGINE_TIMEOUT_BUFFER_MS`   | `10000` | Additional buffer (ms) added to movetime before declaring engine timeout. If Stockfish doesn't respond after `ENGINE_DEFAULT_MOVETIME_MS + ENGINE_TIMEOUT_BUFFER_MS`, the engine is killed. |

### Sizing guidelines

- Each engine instance uses ~100-200 MB RAM during search.
- At `ENGINE_DEFAULT_MOVETIME_MS=500`, a single core handles ~2 engines without overload.
- `MAX_CONCURRENT_ENGINES=4` works on a 4-core machine. Increase proportionally with cores.
- For production with 50+ concurrent bot games, set `MAX_CONCURRENT_ENGINES` to match available cores and expect a queue.

### Skill levels

Stockfish skill is controlled by search depth (`go depth N`). The bot game creation endpoint accepts a skill parameter (1-20):

| Skill | Depth | Relative strength                 |
| ----- | ----- | --------------------------------- |
| 1-5   | 1-4   | Beginner (makes visible blunders) |
| 6-10  | 5-9   | Intermediate                      |
| 11-15 | 10-14 | Advanced                          |
| 16-20 | 15+   | Expert (near-perfect play)        |

Higher skill levels use more CPU time per move.

## Monitoring

### Health endpoint

`GET /health` returns JSON with:

- Database connectivity (latency + error count)
- Redis status (enabled/connected)
- Memory usage (rss, heapUsed, heapTotal)
- Active WebSocket connections
- Active/waiting/total game counts
- Uptime

Configure Docker to use it via the HEALTHCHECK in `Dockerfile` — pings every 30s with 10s timeout, 3 retries before unhealthy.

### Logs

- **Log level**: controlled by `LOG_LEVEL` (error, warn, info, debug)
- **File rotation**: logs are written to `logs/chess-api.log`, rotated daily, retained 30 days (`LOG_RETENTION_DAYS`)
- **Admin tail**: `/admin/api/logs` streams recent log entries

### Database backups

Automatic backups are controlled by `DB_BACKUP_INTERVAL_MS` (default 6h, set 0 to disable). Backups use `pg_dump` and are stored in `data/backups/`. The server cleans up backups older than 7 days.

### Periodic cleanup

| Interval | Variable                    | Default  | What it cleans                                          |
| -------- | --------------------------- | -------- | ------------------------------------------------------- |
| 60s      | `CLEANUP_INTERVAL_MS`       | 60000    | Stale games, expired rate-limit buckets, WS auth blocks |
| 1h       | `TOKEN_CLEANUP_INTERVAL_MS` | 3600000  | Expired auth tokens                                     |
| 24h      | `LOG_CLEANUP_INTERVAL_MS`   | 86400000 | Old log files                                           |
| 6h       | `DB_BACKUP_INTERVAL_MS`     | 21600000 | DB backup (also cleans backups >7 days)                 |

## Production Checklist

1. Set a strong `ADMIN_PASSWORD`
2. Set `CORS_ORIGIN` to a specific origin (server refuses `*` in production)
3. Configure `DATABASE_URL` with a production PostgreSQL instance
4. (Optional) Set `REDIS_URL` for multi-instance deployments
5. Configure `MAX_CONCURRENT_ENGINES` based on available CPU cores
6. Set `NODE_ENV=production` (enables security defaults)
7. Ensure `data/` and `logs/` directories are mounted as volumes (Docker) or persistent storage
