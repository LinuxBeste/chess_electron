# API Integration

## REST Endpoints

All calls go through `src/renderer/api.ts`. Each function was written by reading `../chess-api/src/routes.ts` and confirmed against `../chess-api/docs/api.md`.

| Function             | Method | Path                    | Auth | Request Body                  | Response             |
|----------------------|--------|-------------------------|------|-------------------------------|----------------------|
| `register`           | POST   | `/auth/register`        | No   | `{ username }`                | `{ playerId, token }`|
| `getMe`              | GET    | `/auth/me`              | Yes  | —                             | `{ id, username }`   |
| `healthCheck`        | GET    | `/health`               | No   | —                             | `{ status, uptime, gamesActive, playersOnline }` |
| `createGame`         | POST   | `/games`                | Yes  | —                             | `GameState`          |
| `getOpenGames`       | GET    | `/games`                | No   | —                             | `GameState[]`        |
| `getGame`            | GET    | `/games/:gameId`        | No   | —                             | `GameState`          |
| `joinGame`           | POST   | `/games/:gameId/join`   | Yes  | —                             | `GameState`          |
| `makeMove`           | POST   | `/games/:gameId/move`   | Yes  | `{ from, to, promotion? }`    | `GameState`          |
| `resignGame`         | POST   | `/games/:gameId/resign` | Yes  | —                             | `GameState`          |
| `getLegalMoves`      | GET    | `/games/:gameId/moves`  | Yes  | —                             | `{ moves: [{from,to}] }`|

## WebSocket Events

Connection: `ws://localhost:3000/?token=<bearer-token>` (confirmed in `../chess-api/src/index.ts`)

### `type: "move"`
Broadcast when a player makes a legal move.

```json
{
  "type": "move",
  "gameId": "uuid",
  "board": [{ "square": "e4", "piece": "pawn", "color": "white" }, ...],
  "turn": "black",
  "lastMove": { "from": "e2", "to": "e4" },
  "status": "active"
}
```

### `type: "game_over"`
Broadcast when the game ends (checkmate, stalemate, or resignation).

```json
{
  "type": "game_over",
  "gameId": "uuid",
  "board": [...],
  "turn": "black",
  "lastMove": { ... },
  "status": "checkmate",
  "result": "checkmate",
  "reason": "white wins by checkmate"
}
```

## Auth Flow

1. Call `register(username)` → receive `{ playerId, token }`
2. Store both in the observable store
3. All subsequent authenticated requests read `store.get('token')` and inject it as `Authorization: Bearer <token>`
4. WebSocket connection includes token as query parameter

## Type Mapping

The client re-exports all API types from `../chess-api/src/types.ts` in `src/types.ts`. Key types:

| Type                | Purpose                               |
|---------------------|---------------------------------------|
| `Color`             | `'white' \| 'black'`                  |
| `PieceType`         | All six piece types                   |
| `GameStatus`        | `waiting \| active \| checkmate \| stalemate \| draw \| resigned` |
| `GameState`         | Full game snapshot (board, turn, status, players, moveHistory, etc.) |
| `Board`             | `(Piece \| null)[][]` — 8×8 grid     |
| `Move`              | A move with from/to, capture, castling, en-passant, promotion metadata |
| `SerializedSquare`  | WS message board format: `{ square, piece, color }` |
