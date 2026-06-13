# API Integration

## REST Endpoints

All calls go through `src/renderer/api.ts`. Each function was written by reading `../chess-api/src/routes.ts` and confirmed against `../chess-api/docs/api.md`.

| Function           | Method | Path                       | Auth | Request Body                       | Response                                         |
| ------------------ | ------ | -------------------------- | ---- | ---------------------------------- | ------------------------------------------------ |
| `register`         | POST   | `/auth/register`           | No   | `{ username }`                     | `{ playerId, token }`                            |
| `getMe`            | GET    | `/auth/me`                 | Yes  | —                                  | `{ id, username, elo? }`                         |
| `healthCheck`      | GET    | `/health`                  | No   | —                                  | `{ status, uptime, gamesActive, playersOnline }` |
| `createGame`       | POST   | `/games`                   | Yes  | `{ visibility? }`                  | `GameState`                                      |
| `createBotGame`    | POST   | `/games/bot`               | Yes  | `{ color, skillLevel }`            | `GameState`                                      |
| `getOpenGames`     | GET    | `/games`                   | No   | —                                  | `GameState[]`                                    |
| `getActiveGames`   | GET    | `/games/active`            | No   | —                                  | `GameState[]`                                    |
| `getGame`          | GET    | `/games/:gameId`           | No   | —                                  | `GameState`                                      |
| `joinGame`         | POST   | `/games/:gameId/join`      | Yes  | —                                  | `GameState`                                      |
| `makeMove`         | POST   | `/games/:gameId/move`      | Yes  | `{ from, to, promotion? }`         | `GameState`                                      |
| `resignGame`       | POST   | `/games/:gameId/resign`    | Yes  | —                                  | `GameState`                                      |
| `getPlayerGames`   | GET    | `/players/:playerId/games` | Yes  | —                                  | `GameState[]`                                    |
| `getLegalMoves`    | GET    | `/games/:gameId/moves`     | Yes  | —                                  | `{ moves: [{from,to}] }`                         |
| `getLeaderboard`   | GET    | `/leaderboard`             | No   | —                                  | `LeaderboardEntry[]`                             |
| `createTournament` | POST   | `/tournaments`             | Yes  | `{ name, maxPlayers, isPrivate? }` | `Tournament`                                     |
| `getActiveGame`    | GET    | `/players/me/active-game`  | Yes  | —                                  | `{ gameId }`                                     |

## WebSocket Events

Connection: `ws://localhost:3000/chess-ws?token=<bearer-token>` (confirmed in `../chess-api/src/index.ts`)

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

Broadcast when the game ends (checkmate, stalemate, draw, or resignation).

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

### `type: "game_started"`

Broadcast to white when a second player joins.

```json
{
  "type": "game_started",
  "gameId": "uuid",
  "game": { ... }
}
```

### `type: "chat_message"`

Broadcast to players and spectators when someone sends a chat message.

```json
{
  "type": "chat_message",
  "gameId": "uuid",
  "playerId": "uuid",
  "username": "alice",
  "text": "Hello!",
  "timestamp": 1700000000000
}
```

### `type: "opponent_disconnected"` / `"opponent_reconnected"`

Broadcast when the opponent's WebSocket connection drops or reconnects.

```json
{ "type": "opponent_disconnected", "gameId": "uuid" }
{ "type": "opponent_reconnected", "gameId": "uuid" }
```

### Client Messages (sent via WebSocket)

| Type                | Body                     | Description                |
| ------------------- | ------------------------ | -------------------------- |
| `spectate`          | `{ gameId }`             | Start spectating a game    |
| `unspectate`        | `{ gameId }`             | Stop spectating            |
| `chat_message`      | `{ gameId, text }`       | Send a chat message        |
| `offer_draw`        | `{ gameId }`             | Offer a draw               |
| `accept_draw`       | `{ gameId }`             | Accept draw offer          |
| `decline_draw`      | `{ gameId }`             | Decline draw offer         |
| `rematch_offer`     | `{ gameId }`             | Offer rematch              |
| `rematch_accept`    | `{ gameId }`             | Accept rematch             |
| `challenge`         | `{ toPlayerId, gameId }` | Challenge player to a game |
| `challenge_accept`  | `{ toPlayerId, gameId }` | Accept challenge           |
| `challenge_decline` | `{ toPlayerId, gameId }` | Decline challenge          |
| `get_chat_history`  | `{ gameId }`             | Request chat history       |

### Server Responses to Client Messages

| Type             | Body                | Condition                    |
| ---------------- | ------------------- | ---------------------------- |
| `spectate_ok`    | `{ gameId, game }`  | Successfully spectating      |
| `spectate_error` | `{ gameId, error }` | Game not found or not active |

## Auth Flow

1. Call `register(username)` → receive `{ playerId, token }`
2. Store both in the observable store
3. All subsequent authenticated requests read `store.get('token')` and inject it as `Authorization: Bearer <token>`
4. WebSocket connection includes the token as a query parameter (`ws://localhost:3000/chess-ws?token=<bearer-token>`)

5. **Session validation** — On app startup, a restored session is validated by calling `GET /auth/me`. If the server rejects the token (server restart wipes the in-memory token store), the session is cleared and the user sees the login view instead of auto-navigating to the lobby.

## Type Mapping

The client re-exports all API types from `../chess-api/src/types.ts` in `src/types.ts`. Key types:

| Type               | Purpose                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `Color`            | `'white' \| 'black'`                                                                                          |
| `PieceType`        | All six piece types                                                                                           |
| `GameStatus`       | `waiting \| active \| checkmate \| stalemate \| draw \| resigned`                                             |
| `GameState`        | Full game snapshot (board, turn, status, players, moveHistory, boardHistory, halfMoveClock, visibility, etc.) |
| `Board`            | `(Piece \| null)[][]` — 8×8 grid                                                                              |
| `Move`             | A move with from/to, capture, castling, en-passant, promotion metadata                                        |
| `SerializedSquare` | WS message board format: `{ square, piece, color }`                                                           |
