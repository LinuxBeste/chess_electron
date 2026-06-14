# Environment Variables

## chess-api

| Variable                    | Default         | Description                                   |
| --------------------------- | --------------- | --------------------------------------------- |
| `PORT`                      | `25565`         | HTTP/WS server port                           |
| `CORS_ORIGIN`               | `*`             | Allowed CORS origin                           |
| `WS_HEARTBEAT_INTERVAL`     | `30000`         | WebSocket ping interval (ms)                  |
| `WS_PONG_TIMEOUT`           | `10000`         | WebSocket pong timeout (ms)                   |
| `WS_MAX_CONNECTIONS_PER_IP` | `5`             | Max WebSocket connections per IP              |
| `LOG_LEVEL`                 | `info`          | Log level (debug, info, warn, error)          |
| `ADMIN_USERNAME`            | `admin`         | Admin dashboard login username                |
| `ADMIN_PASSWORD`            | (random)        | Admin password (auto-generated if not set)    |
| `ADMIN_TOKEN_TTL`           | `86400000`      | Admin session TTL in ms (default 24h)         |
| `DB_PATH`                   | `data/chess.db` | SQLite database file path                     |
| `MAX_GAMES_PER_PLAYER`      | `20`            | Max concurrent games per player               |
| `MAX_CONCURRENT_ENGINES`    | `4`             | Max concurrent Stockfish instances            |
| `RATE_LIMIT_WINDOW_MS`      | `60000`         | Rate limit window (ms)                        |
| `RATE_LIMIT_MAX_REQUESTS`   | `100`           | Max requests per player per window            |
| `WAITING_TTL_MS`            | `600000`        | Orphaned waiting game TTL (10 min, 0=disable) |
| `LOGIN_MAX_ATTEMPTS`        | `5`             | Failed logins before lockout                  |
| `LOGIN_LOCKOUT_MINUTES`     | `15`            | Lockout duration after max attempts           |
| `DB_BACKUP_INTERVAL_MS`     | `21600000`      | DB backup interval (6h, 0=disable)            |

## chess-client

| Variable                 | Default                      | Description                                              |
| ------------------------ | ---------------------------- | -------------------------------------------------------- |
| `CHESS_SERVER_URL`       | `http://localhost:3000`      | API server URL (webpack proxy)                           |
| `CHESS_WS_URL`           | _(same as CHESS_SERVER_URL)_ | WebSocket URL override                                   |
| `DEFAULT_USERNAME`       | _(empty)_                    | Pre-fills the login username; auto-submits login if set  |
| `AUTO_CONNECT`           | `true`                       | Auto-connect WebSocket on startup                        |
| `THEME`                  | `default`                    | Board theme (default, classic, blue, green, gray, amber) |
| `SOUND_ENABLED`          | `true`                       | Enable sound effects by default                          |
| `SHOW_LEGAL_HINTS`       | `true`                       | Show legal move hints by default                         |
| `DISABLE_HARDWARE_ACCEL` | `true`                       | Disable GPU acceleration (set to `false` to enable)      |
| `DEVTOOLS`               | `false`                      | Open DevTools on window creation                         |
| `WINDOW_TITLE`           | `Chess`                      | Window title                                             |
| `WINDOW_WIDTH`           | `1280`                       | Default window width                                     |
| `WINDOW_HEIGHT`          | `900`                        | Default window height                                    |
| `WINDOW_MIN_WIDTH`       | `960`                        | Minimum window width                                     |
| `WINDOW_MIN_HEIGHT`      | `700`                        | Minimum window height                                    |
