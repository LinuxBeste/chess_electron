# Architecture

## Layering

```
src/index.ts          Express app + WebSocket server setup, static file serving
src/routes.ts         Player API route handlers → parse input, delegate, respond
src/admin.ts          Admin API route handlers → auth, stats, accounts CRUD
src/game.ts           Game orchestration, auth, WebSocket broadcasting
src/chess.ts          Pure chess engine — no I/O, no side effects
src/types.ts          Shared TypeScript interfaces
admin-frontend/src/   React SPA components (Vite + TailwindCSS + lucide-react)
```

Data flows **downward**: routes call game functions, game functions call chess functions. Chess has no knowledge of HTTP, WebSocket, or game state — it operates on plain data structures (`Board`, `Move`, etc.).

## Data Flow

```
Player Client (HTTP)  →  routes.ts  →  game.ts  →  chess.ts  (pure functions)
                                                    ↓
Player Client (WS)    ←  game.ts broadcasts ← applyMove, getLegalMoves, getGameStatus

Admin Browser (HTTP)  →  admin.ts  →  game.ts / db.ts  ← via Bearer admin token
```

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

All game/player state lives in `Map` objects in `game.ts`. No database. Data is ephemeral — restarting the process loses everything. This is acceptable for the target use case (local multiplayer, demos, small tournaments).

### Token-Based Auth

Each player registration generates a UUID bearer token. Tokens are stored in a `Map<token, playerId>` reverse index for O(1) lookup on every authenticated request. A player can have multiple tokens (multi-device).

### WebSocket Broadcasting

When a move is made or a game ends, the move handler in `game.ts` sends the updated state to both players' WebSocket connections immediately. The connections are stored as `Map<playerId, Set<WebSocket>>` to support multiple browser tabs per player.

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

## Testing Strategy

- **`chess.test.ts`** — Pure unit tests for chess engine functions. No HTTP, no I/O. Tests each piece type, special moves, check/checkmate/stalemate, algebraic notation, board serialization.
- **`api.test.ts`** — Integration tests using supertest against the Express app. Tests authentication, game lifecycle (create → join → move → checkmate), move validation, resign, health endpoint.
