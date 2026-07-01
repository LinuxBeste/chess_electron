# Environment Variables

## chess-api

| Variable                        | Default                                         | Required | Type   | Description                                                     |
| ------------------------------- | ----------------------------------------------- | -------- | ------ | --------------------------------------------------------------- |
| `PORT`                          | `25565`                                         | no       | number | HTTP/WS server port                                             |
| `HOST`                          | `0.0.0.0`                                       | no       | string | Bind address                                                    |
| `CORS_ORIGIN`                   | `*`                                             | no       | string | Allowed CORS origin (must not be `*` in production)             |
| `CORS_CREDENTIALS`              | `true`                                          | no       | bool   | Allow credentials with CORS requests                            |
| `NODE_ENV`                      | `development`                                   | no       | string | `development`, `production`, or `test`                          |
| `MAX_BODY_SIZE`                 | `10kb`                                          | no       | string | Max JSON body size (e.g. `10kb`, `1mb`)                         |
| `REQUEST_TIMEOUT_MS`            | `30000`                                         | no       | number | Per-request timeout in ms                                       |
| `SHUTDOWN_TIMEOUT_MS`           | `10000`                                         | no       | number | Graceful shutdown timeout in ms                                 |
| `ENABLE_HELMET`                 | `true`                                          | no       | bool   | Enable HTTP security headers (CSP, HSTS, etc.)                  |
| `HSTS_MAX_AGE`                  | `31536000`                                      | no       | number | HSTS max-age in seconds (1 year)                                |
| `HSTS_INCLUDE_SUBDOMAINS`       | `true`                                          | no       | bool   | Include subdomains in HSTS                                      |
| `HSTS_PRELOAD`                  | `false`                                         | no       | bool   | Opt into browser HSTS preload list                              |
| `CSP_SCRIPT_SRC`                | `'self','unsafe-inline'`                        | no       | string | CSP script-src (comma-separated)                                |
| `CSP_STYLE_SRC`                 | `'self','unsafe-inline'`                        | no       | string | CSP style-src (comma-separated)                                 |
| `LOG_LEVEL`                     | `info`                                          | no       | string | Log level (`debug`, `info`, `warn`, `error`)                    |
| `LOG_RETENTION_DAYS`            | `30`                                            | no       | number | Days to retain log files                                        |
| `ENABLE_MORGAN`                 | `true`                                          | no       | bool   | Enable HTTP request logging                                     |
| `MORGAN_FORMAT`                 | `combined`                                      | no       | string | Morgan log format (`combined`, `short`, `dev`, `tiny`)          |
| `DATABASE_URL`                  | `postgresql://chess:chess@localhost:5432/chess` | no       | string | PostgreSQL connection string                                    |
| `DB_POOL_MAX`                   | `20`                                            | no       | number | Max pool connections                                            |
| `DB_POOL_IDLE_TIMEOUT_MS`       | `30000`                                         | no       | number | Idle connection timeout                                         |
| `DB_POOL_CONNECTION_TIMEOUT_MS` | `5000`                                          | no       | number | Connection timeout                                              |
| `DB_RETRY_DELAY_MS`             | `5000`                                          | no       | number | Delay between DB init retries                                   |
| `DB_RETRY_MAX_ATTEMPTS`         | `5`                                             | no       | number | DB init retries (0 = exit immediately)                          |
| `DB_BACKUP_INTERVAL_MS`         | `21600000`                                      | no       | number | DB backup interval (6h, 0=disable)                              |
| `DB_PATH`                       | `data/chess.db`                                 | no       | string | Display path in admin config endpoint                           |
| `ADMIN_USERNAME`                | `admin`                                         | no       | string | Admin dashboard login username                                  |
| `ADMIN_PASSWORD`                | (random)                                        | no       | string | Admin password (auto-generated if not set)                      |
| `ADMIN_TOKEN_TTL`               | `86400000`                                      | no       | number | Admin session TTL (ms)                                          |
| `ADMIN_LOGIN_MAX_ATTEMPTS`      | `5`                                             | no       | number | Failed admin logins before lockout                              |
| `ADMIN_LOGIN_LOCKOUT_MINUTES`   | `15`                                            | no       | number | Admin lockout duration after max attempts                       |
| `PLAYER_TOKEN_TTL`              | `86400000`                                      | no       | number | Player token TTL (ms)                                           |
| `LOGIN_MAX_ATTEMPTS`            | `5`                                             | no       | number | Failed logins before lockout                                    |
| `LOGIN_LOCKOUT_MINUTES`         | `15`                                            | no       | number | Lockout duration after max attempts                             |
| `MAX_GAMES_PER_PLAYER`          | `20`                                            | no       | number | Max concurrent games per player                                 |
| `WAITING_TTL_MS`                | `600000`                                        | no       | number | Orphaned waiting game TTL (10 min, 0=disable)                   |
| `WAITING_TTL_MINUTES`           | `10`                                            | no       | number | Same as WAITING_TTL_MS but in minutes (admin config display)    |
| `COMPLETED_GAME_TTL_MS`         | `300000`                                        | no       | number | Completed game in-memory TTL (5 min)                            |
| `ACTIVE_GAMES_FILE`             | `data/active_games.json`                        | no       | string | File path for game persistence fallback (no-Redis mode)         |
| `FILE_SAVE_INTERVAL_MS`         | `30000`                                         | no       | number | Interval for saving active games to file (ms)                   |
| `DISABLE_FILE_PERSISTENCE`      | `false`                                         | no       | bool   | Disable JSON file persistence fallback                          |
| `CHAT_MAX_LENGTH`               | `500`                                           | no       | number | Max characters per chat message                                 |
| `CHAT_HISTORY_MAX`              | `50`                                            | no       | number | Max in-memory chat messages per game                            |
| `GROUP_NAME_MAX_LENGTH`         | `50`                                            | no       | number | Max group conversation name length                              |
| `GROUP_HISTORY_LIMIT`           | `200`                                           | no       | number | Max chat messages loaded from DB per conversation               |
| `RATE_LIMIT_WINDOW_MS`          | `60000`                                         | no       | number | Per-player rate limit window (ms)                               |
| `RATE_LIMIT_MAX_REQUESTS`       | `100`                                           | no       | number | Max requests per player per window                              |
| `IP_RATE_LIMIT_WINDOW_MS`       | `60000`                                         | no       | number | IP rate limit window (ms)                                       |
| `IP_RATE_LIMIT_MAX`             | `20`                                            | no       | number | Max requests per IP per window                                  |
| `REG_RATE_LIMIT_WINDOW_MS`      | `3600000`                                       | no       | number | Registration rate limit window (1 hour)                         |
| `REG_RATE_LIMIT_MAX`            | `5`                                             | no       | number | Max registrations per IP per window                             |
| `HEALTH_RATE_LIMIT_MAX`         | `60`                                            | no       | number | Max `/health` requests per IP per window                        |
| `WS_HEARTBEAT_INTERVAL`         | `30000`                                         | no       | number | WebSocket ping interval (ms)                                    |
| `WS_PONG_TIMEOUT`               | `10000`                                         | no       | number | WebSocket pong timeout (ms)                                     |
| `WS_RATE_LIMIT_PER_SEC`         | `10`                                            | no       | number | Max WebSocket messages per second                               |
| `WS_MAX_CONNECTIONS_PER_IP`     | `5`                                             | no       | number | Max WebSocket connections per IP                                |
| `WS_AUTH_MAX_ATTEMPTS`          | `10`                                            | no       | number | Failed WS auth attempts before IP block                         |
| `WS_AUTH_BLOCK_DURATION_MS`     | `30000`                                         | no       | number | WS auth IP block duration (ms)                                  |
| `REDIS_URL`                     | _(empty)_                                       | no       | string | Redis URL (set to enable Redis persistence + multi-instance WS) |
| `REDIS_GAME_TTL`                | `3600`                                          | no       | number | Redis game state TTL (seconds)                                  |
| `REDIS_CHAT_TTL`                | `3600`                                          | no       | number | Redis chat history TTL (seconds)                                |
| `MAX_CONCURRENT_ENGINES`        | `4`                                             | no       | number | Max concurrent Stockfish instances                              |
| `ENGINE_POLL_INTERVAL_MS`       | `100`                                           | no       | number | Engine ready-poll interval (ms)                                 |
| `ENGINE_DEFAULT_MOVETIME_MS`    | `500`                                           | no       | number | Default engine move time (ms)                                   |
| `ENGINE_TIMEOUT_BUFFER_MS`      | `10000`                                         | no       | number | Engine timeout buffer added to movetime (ms)                    |
| `ELO_K_FACTOR`                  | `32`                                            | no       | number | Elo K-factor for rating calculations                            |
| `ANALYSIS_MOVE_TIME_MS`         | `1000`                                          | no       | number | Analysis engine move time (ms)                                  |
| `ANALYSIS_PLAYED_MOVE_TIME_MS`  | `500`                                           | no       | number | Analysis engine time for played moves (ms)                      |
| `AVATAR_MAX_SIZE_BYTES`         | `2097152`                                       | no       | number | Max avatar upload size (bytes, 2 MB)                            |
| `LEADERBOARD_CACHE_TTL`         | `10000`                                         | no       | number | Leaderboard cache TTL (ms)                                      |
| `CLEANUP_INTERVAL_MS`           | `60000`                                         | no       | number | Bucket & stale-game sweep interval (ms)                         |
| `LOG_CLEANUP_INTERVAL_MS`       | `86400000`                                      | no       | number | Log file cleanup interval (24 hours)                            |
| `TOKEN_CLEANUP_INTERVAL_MS`     | `3600000`                                       | no       | number | Expired token cleanup interval (1 hour)                         |

## chess-client

| Variable                 | Default                 | Description                                              |
| ------------------------ | ----------------------- | -------------------------------------------------------- |
| `CHESS_SERVER_URL`       | `http://localhost:3000` | API server URL (webpack proxy)                           |
| `CHESS_WS_URL`           | _(same as server)_      | WebSocket URL override                                   |
| `DEFAULT_USERNAME`       | _(empty)_               | Pre-fills the login username; auto-submits if set        |
| `AUTO_CONNECT`           | `true`                  | Auto-connect WebSocket on startup                        |
| `THEME`                  | `default`               | Board theme (default, classic, blue, green, gray, amber) |
| `SOUND_ENABLED`          | `true`                  | Enable sound effects by default                          |
| `SHOW_LEGAL_HINTS`       | `true`                  | Show legal move hints by default                         |
| `DISABLE_HARDWARE_ACCEL` | `true`                  | Disable GPU acceleration (set to `false` to enable)      |
| `DEVTOOLS`               | `false`                 | Open DevTools on window creation                         |
| `WINDOW_TITLE`           | `Chess`                 | Window title                                             |
| `WINDOW_WIDTH`           | `1280`                  | Default window width                                     |
| `WINDOW_HEIGHT`          | `900`                   | Default window height                                    |
| `WINDOW_MIN_WIDTH`       | `960`                   | Minimum window width                                     |
| `WINDOW_MIN_HEIGHT`      | `700`                   | Minimum window height                                    |
