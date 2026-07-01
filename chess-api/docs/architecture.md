# Architecture

## Layering

```
src/index.ts          Express app + WebSocket server setup, static file serving
src/routes.ts         Player API route handlers → parse input, delegate, respond
src/admin.ts          Admin API route handlers → auth, stats, accounts CRUD
src/game.ts           Game orchestration, auth, WebSocket broadcasting
src/engine.ts         Stockfish engine manager (child process spawn)
src/chess.ts          Pure chess engine - no I/O, no side effects
src/db.ts             PostgreSQL database helpers (users, tokens, tournaments, chat)
src/redis.ts          Redis client for cross-instance state + WebSocket messaging
src/state.ts          In-memory state maps + Redis write-through helpers
src/chat.ts           Chat logic (lobby, private, group conversations)
src/friends.ts        Friend request/management routes
src/elo.ts            Elo rating calculation
src/validation.ts     Zod schemas for input validation
src/types.ts          Shared TypeScript interfaces
src/logger.ts         File + console logger with log rotation
src/player.ts         Player state, token management, login lockout
admin-frontend/src/   React SPA components (Vite + TailwindCSS + lucide-react)
```

Data flows **downward**: routes call game functions, game functions call chess functions. Chess has no knowledge of HTTP, WebSocket, or game state - it operates on plain data structures (`Board`, `Move`, etc.).

## Data Flow

```
Player Client (HTTP)  →  routes.ts  →  game.ts  →  chess.ts  (pure functions)
                                                    ↓
Player Client (WS)    ←  game.ts broadcasts ← applyMove, getLegalMoves, getGameStatus
                       engine.ts ← game.ts triggers bot moves via UCI protocol

Admin Browser (HTTP)  →  admin.ts  →  game.ts / db.ts  ← via Bearer admin token
```

## Bot Engine

The Stockfish bot (`engine.ts`) spawns `stockfish-18-lite-single.js` as a child process using `child_process.spawn`. Communication follows the UCI (Universal Chess Interface) protocol:

1. On bot game creation, the engine is started and initialized with UCI commands.
2. When it's the bot's turn, `engine.ts` sends the current board position via `position fen ...` and runs `go depth ...` or `go movetime ...`.
3. The bot's best move is parsed from the UCI output and applied via the same move pipeline as human moves.
4. Skill level (1-20) controls search depth and node limits.

Engine lifecycle: spawned on game creation, destroyed on resign/game end.

## Admin Dashboard

The admin dashboard is a separate React SPA (`admin-frontend/`) built with Vite. During
`pnpm run build`, Vite outputs the compiled assets to `dist/admin/`, which Express
serves as static files at the `/admin/` path. The admin API routes (`admin.ts`) handle
backend operations (auth, stats, accounts CRUD) at `/admin/api/*`.

Admin login credentials are configured via environment variables (`ADMIN_USERNAME`,
`ADMIN_PASSWORD`). On successful login, a UUID bearer token is generated and stored
in-memory for the duration of the server process.

## Key Design Decisions

### Spectate Code Access

Games can be created with `spectateMode: 'code'`, which generates a UUID `spectateCode`. Spectators must provide this code in their WebSocket `spectate` message. The code is stripped from all public responses (`GET /games`, `GET /games/active`, `GET /games/:id`, WS broadcasts) via `sanitizeForClient()` - it is only visible to the game creator in the creation response.

### Token-Based Auth

Each player registration generates a UUID bearer token. Tokens are stored in a
`Map<token, playerId>` reverse index for O(1) lookup on every authenticated request.
A player can have multiple tokens (multi-device).

### WebSocket Broadcasting

When a move is made or a game ends, the move handler in `game.ts` sends the updated
state to both players' WebSocket connections immediately. The connections are stored
as `Map<playerId, Set<WebSocket>>` to support multiple browser tabs per player.

The WebSocket path is `/chess-ws` to avoid conflicts with webpack dev server's HMR at `/ws`.

### Legal Move Validation

`getLegalMoves` in `chess.ts` uses a two-phase approach:

1. Generate **pseudo-legal** moves for each piece (movement rules only).
2. For each pseudo-legal move, `applyMove` on a cloned board, then check if the king is in check. If not, the move is legal.

This is computationally heavier than integrating check-avoidance into each piece's move generator, but it is **provably correct** - there is no way for a pseudo-legal move to slip through as long as `applyMove` and `isInCheck` are correct.

### Attack Detection

`isSquareAttackedBy` scans **outward** from the target square using direction vectors, rather than iterating all opponent pieces. Since it is called many times during legal-move filtering (once per candidate move), the direction-outward approach is significantly faster: it stops at the first blocking piece in each direction instead of processing every piece on the board.

### Board Representation

The board is `board[rank][file]` where rank 0 = rank 8 (black's home) and rank 7 = rank 1 (white's home). This matches standard top-to-bottom rendering.

### Max Games Per Player

A player is limited to `MAX_GAMES_PER_PLAYER` (default 20) concurrent active games. This prevents game-stalling exploits while allowing multiple simultaneous games.

### Elo Rating

K-factor configurable via `ELO_K_FACTOR` (default 32). Anonymous players are not rated. Rating changes are calculated after each completed game.

## Production Deployment

In production, the API runs behind a Cloudflare Tunnel (no open ports). The docker-compose stack includes both the API and `cloudflared` container. TLS is terminated by Cloudflare at the edge.

## Game Persistence & Scalability

### Persistence options

| Layer                | Storage                   | Survives restart | Data                                                             |
| -------------------- | ------------------------- | ---------------- | ---------------------------------------------------------------- |
| In-memory            | `Map` in `state.ts`       | No               | Active games, player sessions, chat history, rate-limit state    |
| Redis (optional)     | `game:<id>` keys with TTL | Yes              | Active game state, player indexes, chat, draw/rematch offers     |
| PostgreSQL           | Tables                    | Yes              | Users, tokens, tournaments, completed games, bans, chat messages |
| JSON file (fallback) | `data/active_games.json`  | Yes              | Active games (only when Redis is disabled)                       |

Without Redis, active games live only in memory. A server restart loses all in-progress
games unless the JSON file fallback is enabled (which saves every `FILE_SAVE_INTERVAL_MS`
and on graceful shutdown).

### Scaling limits

| Resource              | Limit                                                | Bottleneck               |
| --------------------- | ---------------------------------------------------- | ------------------------ |
| Concurrent games      | 1000-2000 (single process)                           | V8 heap, event loop      |
| WebSocket connections | ~1000 per process                                    | Memory, file descriptors |
| Bot engines           | `MAX_CONCURRENT_ENGINES` (default 4)                 | CPU cores                |
| Players per game      | 2                                                    | Game design              |
| Requests per player   | `RATE_LIMIT_MAX_REQUESTS` per `RATE_LIMIT_WINDOW_MS` | Configurable             |
| Games per player      | `MAX_GAMES_PER_PLAYER` (default 20)                  | Configurable             |
| DB connections        | `DB_POOL_MAX` (default 20)                           | PostgreSQL               |

The server is designed as a **single-instance** deployment. To scale horizontally:

1. Configure `REDIS_URL` for shared state across instances
2. Redis pub/sub broadcasts WebSocket messages (player:_ and spectate:_ channels)
3. Each instance handles its own WebSocket connections; Redis relays messages between them
4. PostgreSQL is the backing store and can be scaled independently (read replicas, connection pooling)

Note: there is no built-in inter-instance mutex. Concurrent moves on the same game
across two instances could race. The architecture assumes game moves arrive
sequentially for any given game, which holds in practice when the API is behind a
single load balancer that routes by game ID.

### In-memory state + Redis write-through

Game/player state lives in `Map` objects in `state.ts`. Every mutation calls
`persistGame(id)` which writes through to Redis. When Redis is unavailable, the
server continues with in-memory-only state (no crash, no data loss beyond active
games on restart if file fallback is also disabled).

### PostgreSQL for persistence

Registered users, auth tokens, friend relationships, tournament data, bans, chat
messages, and completed games are persisted to PostgreSQL via `db.ts`. Connection
pooling with configurable pool size and timeouts.

## Race conditions

The server is single-threaded (Node.js event loop), so JavaScript-level operations
are inherently serialized within one event-loop tick. However, async functions yield
the event loop between `await` calls. This means two concurrent requests can both
pass a validation check (e.g. "is it this player's turn?") before either one
mutates the game state.

To prevent this, game-state-mutating functions use a **per-game mutex** implemented
as a promise chain (`gameLocks` in `game.ts`). Each mutating operation queues
behind the previous one for the same game, ensuring serial execution.

Mutex scope: `makeMove`, `resignGame`, `offerDraw`, `acceptDraw`, `declineDraw`,
`offerRematch`, `acceptRematch`, `declineRematch`, `abortGame`.

## Testing Strategy

- **`chess.test.ts`** - Pure unit tests for chess engine functions. No HTTP, no I/O. (191 tests)
- **`game.test.ts`** - Game logic unit tests (state transitions, validation).
- **`api.test.ts`** - Integration tests using supertest against the Express app. Covers authentication, game lifecycle, bot games, tournaments, admin routes. (828 tests)
- **`ws.test.ts`** - WebSocket end-to-end tests (spectate with/without code, auth rejection, chat, challenge forwarding).
