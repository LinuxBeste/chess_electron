# Troubleshooting & FAQ

## Server won't start

### Port already in use

```
Error: listen EADDRINUSE :::25565
```

Kill the old process:

```bash
lsof -ti :25565 | xargs kill -9
```

### CORS_ORIGIN is set to \* in production

Set `CORS_ORIGIN` to a specific origin before starting in production mode:

```bash
CORS_ORIGIN=https://your-domain.com docker compose up
```

### DB connection fails

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

Ensure PostgreSQL is running and `DATABASE_URL` is correct. The default is `postgresql://chess:chess@localhost:5432/chess`.

Test with:

```bash
psql "$DATABASE_URL" -c "SELECT 1"
```

### ADMIN_PASSWORD not set (warning)

```
WARN: ADMIN_PASSWORD not set — a random password will be generated and logged on first request
```

This is not an error — a random password is generated on startup and logged at `info` level. Set `ADMIN_PASSWORD` explicitly for predictable admin access.

---

## WebSocket won't connect

### 401 on connect

The WS query parameter `token` is missing or invalid. Ensure the token was obtained from `/auth/register` or `/auth/login`.

Correct URL format:

```
ws://host:25565/chess-ws?token=<uuid>
```

### 403 — IP banned

Too many failed WS auth attempts from your IP (`WS_AUTH_MAX_ATTEMPTS`, default 10). Wait `WS_AUTH_BLOCK_DURATION_MS` (default 30s) or restart the server to clear blocks.

### Connection limit reached

Each IP is limited to `WS_MAX_CONNECTIONS_PER_IP` (default 5) concurrent connections. Close unused tabs.

### WebSocket connects but immediately disconnects

Check the server heartbeat: the server pings every `WS_HEARTBEAT_INTERVAL` (30s) and expects a pong within `WS_PONG_TIMEOUT` (10s). Network proxies may strip ping/pong frames.

---

## Game issues

### "Rate limited — slow down"

- **HTTP 429**: You exceeded `IP_RATE_LIMIT_MAX` (20 req/min on anonymous GET routes) or `RATE_LIMIT_MAX_REQUESTS` (100 req/min per player).
- **WebSocket rate limit**: >10 messages/second. Pacing is enforced server-side; excess messages are dropped.

### Game state not updating

WebSocket messages arrive in real time. If the page is stale:

- Try a hard refresh (Ctrl+F5).
- Check that the server log shows the move was processed.
- Verify the game is still active (not completed/aborted).

### "Cannot join game" error

- **Game is full**: already has white and black.
- **Game was aborted**: waiting games can be aborted by the creator.
- **Private game**: not shown in the public lobby; must join by ID.
- **Spectate code**: set on creation — spectators must provide the code.

### Clock reset or missing time data

Clock data is sent with the game state. If clocks show `null`, the game was created without time control (untimed mode). Create a game with `timeControl` parameters to enable clocks.

---

## Bot issues

### Bot doesn't respond

- Ensure Stockfish is installed (`stockfish` package or system binary in PATH).
- Check `MAX_CONCURRENT_ENGINES` (default 4). If all slots are busy, the bot queues.
- The engine timeout is `ENGINE_DEFAULT_MOVETIME_MS` (default 500ms) plus `ENGINE_TIMEOUT_BUFFER_MS` (default 10s).

### Bot plays too weak / too strong

Adjust `skillLevel` (1-20) when creating a bot game. Level 1 makes random blunders, level 20 plays at full strength.

---

## Login issues

### "Account locked"

After 5 failed login attempts (`LOGIN_MAX_ATTEMPTS`), the account is locked for 15 minutes (`LOGIN_LOCKOUT_MINUTES`). Wait or restart the server to clear the lockout map.

### "Password incorrect"

- Passwords are case-sensitive.
- Anonymous accounts (no password) cannot log in via password. Use the token from registration or register with a password.

### "Authentication required"

- Missing `Authorization: Bearer <token>` header.
- Token expired (TTL defaults to 24h, configurable via `PLAYER_TOKEN_TTL`).
- All tokens revoked on password change.
- Server restart invalidates in-memory tokens (unless Redis is enabled).

---

## Redis

### Redis unavailable at startup

```
WARN: Redis unavailable — running without Redis. Set REDIS_URL to enable.
```

The server continues with in-memory-only state. Active games and chat are not shared across instances. Set `REDIS_URL` to enable.

### Game state lost after restart (no Redis)

Without Redis, active games are stored in memory only. Enable file-based persistence (`DISABLE_FILE_PERSISTENCE=false`, default) to save to `ACTIVE_GAMES_FILE` (default `data/active_games.json`) every `FILE_SAVE_INTERVAL_MS` (30s) for restart survival.

---

## Database

### Migration failures

Migrations are tracked in the `_migrations` table. To re-apply a migration:

1. `DELETE FROM _migrations WHERE version = N;`
2. Restart the server.

### Backup fails

```
DB backup failed: Error: spawn pg_dump ENOENT
```

`pg_dump` must be installed on the server PATH. On Alpine:

```bash
apk add postgresql17-client
```

---

## Electron client

### White screen on startup

- Try `DISABLE_HARDWARE_ACCEL=false` to enable GPU rendering.
- Check DevTools (`DEVTOOLS=true`) for console errors.
- Verify `CHESS_SERVER_URL` points to a running API server.

### "Failed to load .env"

The Electron client loads `.env` from `chess-client/`. Ensure the file exists with at least:

```
CHESS_SERVER_URL=http://localhost:25565
```

### WebSocket connects to webpack HMR instead of chess

The chess WS path is `/chess-ws`. The webpack HMR uses `/ws`. Ensure the client is configured for `/chess-ws`.

---

## Admin dashboard

### "Access denied"

Admin requires `Authorization: Bearer <token>` header obtained from `POST /admin/api/login`. Session expires after `ADMIN_TOKEN_TTL` (default 24h).

### "Admin login locked"

After `ADMIN_LOGIN_MAX_ATTEMPTS` (default 5) failed attempts, the admin account is locked for `ADMIN_LOGIN_LOCKOUT_MINUTES` (default 15). Restart the server to clear.

### Dashboard shows no data

The admin dashboard polls REST endpoints. If the API is reachable but returns empty results, there may be no active games or registered users yet.

---

## Common error codes

| Status | Meaning                                        | Common fix                             |
| ------ | ---------------------------------------------- | -------------------------------------- |
| 400    | Bad request — invalid input                    | Check request body matches API schema  |
| 401    | Missing or invalid token                       | Re-authenticate, include Bearer header |
| 403    | Not allowed (ban, not your game, unregistered) | Register an account unless anonymous   |
| 404    | Resource not found                             | Check game ID, tournament ID, username |
| 409    | Conflict (already friends, already in game)    | Resolve duplicate state                |
| 429    | Rate limited                                   | Slow down, wait for window to expire   |
| 500    | Internal server error                          | Check server logs for details          |

---

## Performance

### High CPU usage

- Stockfish engine processes consume CPU. Limit with `MAX_CONCURRENT_ENGINES`.
- Each `GET /games` with many open games may be slow. Pagination is not implemented.

### Slow response times

- DB query with no index on a large `completed_games` table. Add a composite index if needed.
- Leaderboard query cached for `LEADERBOARD_CACHE_TTL` (10s). First request after cache expiry is slow.
- Rate limit bucket cleanup runs every `CLEANUP_INTERVAL_MS` (60s). Large `Map` size may cause GC pressure.
