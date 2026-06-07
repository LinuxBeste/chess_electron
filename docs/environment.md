# Environment Variables

## chess-api

| Variable                  | Default | Description                          |
| ------------------------- | ------- | ------------------------------------ |
| `PORT`                    | `3000`  | HTTP server port                     |
| `CORS_ORIGIN`             | `*`     | Allowed CORS origin                  |
| `WS_HEARTBEAT_INTERVAL`   | `30000` | WebSocket ping interval (ms)         |
| `LOG_LEVEL`               | `info`  | Log level (debug, info, warn, error) |
| `MAX_GAMES_PER_PLAYER`    | `1`     | Max concurrent games per player      |
| `RATE_LIMIT_WINDOW_MS`    | `60000` | Rate limit window (ms)               |
| `RATE_LIMIT_MAX_REQUESTS` | `30`    | Max requests per window per player   |

## chess-client

| Variable                 | Default                      | Description                                              |
| ------------------------ | ---------------------------- | -------------------------------------------------------- |
| `CHESS_SERVER_URL`       | `http://localhost:3000`      | API server URL                                           |
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
