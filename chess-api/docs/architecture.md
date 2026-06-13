# Architecture

## Layering

```
src/index.ts          Express app + WebSocket server setup, static file serving
src/routes.ts         Player API route handlers → parse input, delegate, respond
src/admin.ts          Admin API route handlers → auth, stats, accounts CRUD
src/game.ts           Game orchestration, auth, WebSocket broadcasting
src/engine.ts         Stockfish engine manager (child process spawn)
src/chess.ts          Pure chess engine — no I/O, no side effects
src/db.ts             SQLite database helpers (users, tokens, tournaments)
src/types.ts          Shared TypeScript interfaces
admin-frontend/src/   React SPA components (Vite + TailwindCSS + lucide-react)
```

Data flows **downward**: routes call game functions, game functions call chess functions. Chess has no knowledge of HTTP, WebSocket, or game state — it operates on plain data structures (`Board`, `Move`, etc.).

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
4. Skill level (1–20) controls search depth and node limits.

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

### In-Memory State

Game/player state lives in `Map` objects in `game.ts`. No database for active games.
Data is ephemeral — restarting the process loses in-progress games. This is acceptable
for the target use case (local multiplayer, demos, small tournaments).

### SQLite for Persistence

Registered users, auth tokens, friend relationships, tournament data, and bans are
persisted to SQLite via `db.ts`. This allows server restarts without losing accounts.

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

This is computationally heavier than integrating check-avoidance into each piece's move generator, but it is **provably correct** — there is no way for a pseudo-legal move to slip through as long as `applyMove` and `isInCheck` are correct.

### Attack Detection

`isSquareAttackedBy` scans **outward** from the target square using direction vectors, rather than iterating all opponent pieces. Since it is called many times during legal-move filtering (once per candidate move), the direction-outward approach is significantly faster: it stops at the first blocking piece in each direction instead of processing every piece on the board.

### Board Representation

The board is `board[rank][file]` where rank 0 = rank 8 (black's home) and rank 7 = rank 1 (white's home). This matches standard top-to-bottom rendering.

### One-Game-Per-Player

A player cannot be in more than one active game at a time. This prevents game-stalling exploits and simplifies the concurrency model.

### Elo Rating

K-factor fixed at 32. Anonymous players are not rated. Rating changes are calculated after each completed game.

## Production Deployment

In production, the API runs behind a Cloudflare Tunnel (no open ports). The docker-compose stack includes both the API and `cloudflared` container. TLS is terminated by Cloudflare at the edge.

## Testing Strategy

- **`chess.test.ts`** — Pure unit tests for chess engine functions. No HTTP, no I/O.
- **`game.test.ts`** — Game logic unit tests (state transitions, validation).
- **`api.test.ts`** — Integration tests using supertest against the Express app. Covers authentication, game lifecycle, bot games, tournaments, admin routes.
