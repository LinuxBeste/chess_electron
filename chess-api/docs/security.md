# Security Architecture

## Authentication

### Player auth

Players authenticate with a UUID bearer token. The flow:

1. **Register** (`POST /auth/register`): username + optional password → returns `{ playerId, token }`.
2. **Login** (`POST /auth/login`): username + password → returns `{ playerId, token }` (for registered users).
3. **Authenticate** (`GET /auth/me`): validates bearer token, returns player identity.

Tokens are stored in a `Map<token, playerId>` reverse index for O(1) lookup. Each player can have multiple simultaneous tokens (multi-device). Tokens expire after `PLAYER_TOKEN_TTL` (default 24h). On password change, all existing tokens are revoked (both in-memory and from the DB).

### Admin auth

Admin uses a separate auth system:

1. **Login** (`POST /admin/api/login`): username + password → returns bearer token.
2. All admin endpoints require `Authorization: Bearer <token>` header.
3. Tokens expire after `ADMIN_TOKEN_TTL` (default 24h).
4. Admin password is configured via `ADMIN_PASSWORD` env var. If unset, a random 48-char hex string is auto-generated and logged at startup. **Always set a strong password in production.**
5. Login lockout: `ADMIN_LOGIN_MAX_ATTEMPTS` (default 5) failures triggers a `ADMIN_LOGIN_LOCKOUT_MINUTES` (default 15) lockout.

### Password hashing

Both player and admin passwords are hashed with PBKDF2 (HMAC-SHA256, 100000 iterations, 16-byte salt). The hash format is:

```
<algorithm>:<iterations>:<salt_hex>:<hash_hex>
```

Example: `pbkdf2:100000:a1b2c3...:def456...`

## Rate Limiting

The server has multiple rate-limiting layers:

### HTTP rate limits

| Layer        | Window                          | Max requests                           | Applies to                                              |
| ------------ | ------------------------------- | -------------------------------------- | ------------------------------------------------------- |
| Per-player   | `RATE_LIMIT_WINDOW_MS` (60s)    | `RATE_LIMIT_MAX_REQUESTS` (100)        | Authenticated endpoints                                 |
| Per-IP       | `IP_RATE_LIMIT_WINDOW_MS` (60s) | `IP_RATE_LIMIT_MAX` (20)               | Game listing, leaderboard, tournaments, register, login |
| Registration | `REG_RATE_LIMIT_WINDOW_MS` (1h) | `REG_RATE_LIMIT_MAX` (5)               | `/auth/register` per IP                                 |
| Health       | 60s                             | `HEALTH_RATE_LIMIT_MAX` (60)           | `/health`                                               |
| Login        | Implicit                        | Lockout after `LOGIN_MAX_ATTEMPTS` (5) | `/auth/login` per username                              |

Rate limits use a sliding-window algorithm with `Map<string, number[]>` (timestamps in ms). Old entries are swept every `CLEANUP_INTERVAL_MS`.

### WebSocket rate limits

- **Message rate**: `WS_RATE_LIMIT_PER_SEC` (default 10) messages per second per connection. Excess messages are dropped.
- **Connection limit**: `WS_MAX_CONNECTIONS_PER_IP` (default 5) concurrent connections per IP.
- **Auth throttling**: `WS_AUTH_MAX_ATTEMPTS` (default 10) failed auth attempts trigger a `WS_AUTH_BLOCK_DURATION_MS` (default 30s) IP block.

## CORS

`CORS_ORIGIN` configures the allowed origin. In production mode (`NODE_ENV=production`), the server refuses to start if `CORS_ORIGIN=*`. Must be set to a specific origin or comma-separated list.

## Content Security Policy (CSP)

Configured via helmet:

- `script-src`: defaults to `'self' 'unsafe-inline'` (configurable via `CSP_SCRIPT_SRC`)
- `style-src`: defaults to `'self' 'unsafe-inline'` (configurable via `CSP_STYLE_SRC`)

`'unsafe-inline'` is required because the admin dashboard is a React SPA with inline styles/scripts from Vite bundling.

## HSTS (HTTP Strict Transport Security)

| Variable                  | Default  | Description                            |
| ------------------------- | -------- | -------------------------------------- |
| `HSTS_MAX_AGE`            | 31536000 | 1 year in seconds                      |
| `HSTS_INCLUDE_SUBDOMAINS` | true     | Include subdomains                     |
| `HSTS_PRELOAD`            | false    | Request browser preload list inclusion |

## Ban System

- **Player bans**: Ban by player ID via `POST /admin/api/players/:id/ban`. Kicked immediately if connected.
- **IP bans**: Ban by IP address via admin API. Disconnects all WebSocket connections from that IP immediately.
- Bans are persisted to PostgreSQL and loaded into memory on startup (`loadPersistedBans`).

## Account Lockout

| Endpoint     | Max attempts                   | Lockout duration                   | Scope        |
| ------------ | ------------------------------ | ---------------------------------- | ------------ |
| Player login | `LOGIN_MAX_ATTEMPTS` (5)       | `LOGIN_LOCKOUT_MINUTES` (15)       | Per username |
| Admin login  | `ADMIN_LOGIN_MAX_ATTEMPTS` (5) | `ADMIN_LOGIN_LOCKOUT_MINUTES` (15) | Per username |

Lockouts are tracked in memory and survive server restarts in the sense that they are ephemeral (no DB persistence). Lockouts expire automatically after the configured duration.

## Input Validation

- All request bodies are validated with **Zod schemas** (`src/validation.ts`).
- JSON body size limited to `MAX_BODY_SIZE` (default 10kb).
- Request timeout: `REQUEST_TIMEOUT_MS` (default 30s).
- Move validation: square format (`/^[a-h][1-8]$/`), piece existence, color ownership, legal move verification via chess engine.

## WebSocket Security

- WS connections require a token query parameter: `ws://host:port/chess-ws?token=<token>`.
- Token is validated on connection; invalid tokens or missing tokens → immediate close.
- The WS path is `/chess-ws` — distinct from webpack dev server's HMR WebSocket at `/ws`.
- Heartbeat: server pings every `WS_HEARTBEAT_INTERVAL` (30s), expects pong within `WS_PONG_TIMEOUT` (10s) or connection is closed.

## Error Handling

- **Unhandled rejections**: set `process.exitCode = 1` (logged but doesn't crash).
- **Uncaught exceptions**: call `process.exit(1)` (can't recover from undefined state).
- **DB init retry**: retries `DB_RETRY_MAX_ATTEMPTS` times with `DB_RETRY_DELAY_MS` delay before exiting.
- **Redis fallback**: if Redis init fails, the server continues with in-memory-only state (graceful degradation).

## Security Headers (helmet)

| Header                      | Value                           | Configurable                      |
| --------------------------- | ------------------------------- | --------------------------------- |
| `Content-Security-Policy`   | script-src + style-src          | `CSP_SCRIPT_SRC`, `CSP_STYLE_SRC` |
| `Strict-Transport-Security` | max-age, includeSubDomains      | `HSTS_*` vars                     |
| `X-Content-Type-Options`    | nosniff                         | Fixed                             |
| `X-Frame-Options`           | SAMEORIGIN                      | Fixed                             |
| `X-XSS-Protection`          | 0 (disables legacy XSS filter)  | Fixed                             |
| `Referrer-Policy`           | strict-origin-when-cross-origin | Fixed                             |

Helmet is enabled by default. Disable with `ENABLE_HELMET=false` (not recommended in production).

## Docker Security

- **Non-root user**: container runs as `chess` (UID/GID 1000) via `su-exec` in entrypoint.
- **Volume permissions**: entrypoint chowns mounted `data/` and `logs/` volumes before dropping privileges.
- **Health check**: Docker HEALTHCHECK pings `/health` every 30s, 10s timeout, 3 retries.
- **No open ports** (in tunnel mode): chess-api is `expose` only, not `ports` in docker-compose. Cloudflare tunnel provides public access.
