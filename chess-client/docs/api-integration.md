# API Integration

## REST Endpoints

Every API call the client makes lives in `src/renderer/api.ts`. Each function was written by staring at `../chess-api/src/routes.ts` until it made sense, then double-checked against the API docs.

| Function                | Method | Path                             | Auth | Request Body                                   | Response                                         |
| ----------------------- | ------ | -------------------------------- | ---- | ---------------------------------------------- | ------------------------------------------------ |
| `register`              | POST   | `/auth/register`                 | No   | `{ username, password? }`                      | `{ playerId, token, isRegistered, displayName }` |
| `login`                 | POST   | `/auth/login`                    | No   | `{ username, password }`                       | `{ playerId, token, displayName }`               |
| `logout`                | POST   | `/auth/logout`                   | Yes  | -                                             | `{ success: true }`                              |
| `getMe`                 | GET    | `/auth/me`                       | Yes  | -                                             | `{ id, username, displayName, isRegistered, avatarUrl?, stats? }` |
| `updateDisplayName`     | PUT    | `/auth/me`                       | Yes  | `{ displayName }`                              | `{ success: true, displayName }`                 |
| `changePassword`        | PUT    | `/auth/me/password`              | Yes  | `{ currentPassword, newPassword }`             | `{ success: true }`                              |
| `uploadAvatar`          | POST   | `/auth/me/avatar`                | Yes  | `FormData` (field: `avatar`)                   | `{ avatarUrl }`                                  |
| `deleteAvatar`          | DELETE | `/auth/me/avatar`                | Yes  | -                                             | `{ success: true }`                              |
| `deleteAccount`         | DELETE | `/auth/me`                       | Yes  | -                                             | `{ success: true }`                              |
| `getPlayerProfile`      | GET    | `/players/:playerId/profile`     | Yes  | -                                             | `{ id, username, displayName, avatarUrl?, stats? }` |
| `healthCheck`           | GET    | `/health`                        | No   | -                                             | `{ status, uptime, gamesActive, playersOnline }` |
| `createGame`            | POST   | `/games`                         | Yes  | `{ visibility?, spectateMode? }`               | `GameState` (includes `spectateMode`, `spectateCode` if mode is `code`) |
| `createBotGame`         | POST   | `/games/bot`                     | Yes  | `{ skillLevel, playerColor? }`                 | `GameState`                                      |
| `getOpenGames`          | GET    | `/games`                         | No   | -                                             | `GameState[]` (without `spectateCode`)           |
| `getActiveGames`        | GET    | `/games/active`                  | No   | -                                             | `GameState[]` (without `spectateCode`)           |
| `getGame`               | GET    | `/games/:gameId`                 | No   | -                                             | `GameState` (without `spectateCode`)             |
| `joinGame`              | POST   | `/games/:gameId/join`            | Yes  | -                                             | `GameState`                                      |
| `abortGame`             | POST   | `/games/:gameId/abort`           | Yes  | -                                             | `{ success: true }`                              |
| `makeMove`              | POST   | `/games/:gameId/move`            | Yes  | `{ from, to, promotion? }`                     | `GameState`                                      |
| `resignGame`            | POST   | `/games/:gameId/resign`          | Yes  | -                                             | `GameState`                                      |
| `drawGame`              | POST   | `/games/:gameId/draw`            | Yes  | `{ action: 'offer'|'accept'|'decline' }`       | `GameState`                                      |
| `getPlayerGames`        | GET    | `/players/:playerId/games`       | Yes  | -                                             | `GameState[]`                                    |
| `getLegalMoves`         | GET    | `/games/:gameId/moves`           | Yes  | -                                             | `{ moves: [{from,to}] }`                         |
| `getActiveGame`         | GET    | `/players/me/active-game`        | Yes  | -                                             | `{ game: GameState \| null }`                    |
| `getLeaderboard`        | GET    | `/leaderboard`                   | No   | `?page=&limit=`                               | `{ entries: RatingEntry[], total, page, limit }` |
| `getArchivedGames`      | GET    | `/games/archive`                 | No   | `?page=&limit=&player=&status=&from=&to=`      | `{ games, total, page, limit }`                  |
| `getArchivedGame`       | GET    | `/games/archive/:gameId`         | No   | -                                             | Archived game object                             |
| `createTournament`      | POST   | `/tournaments`                   | Yes  | `{ name, maxPlayers, isPrivate? }`             | `Tournament`                                     |
| `getTournaments`        | GET    | `/tournaments`                   | No   | -                                             | `Tournament[]`                                   |
| `getTournament`         | GET    | `/tournaments/:id`               | No   | -                                             | `Tournament` (with participants, matches)        |
| `joinTournament`        | POST   | `/tournaments/:id/join`          | Yes  | -                                             | `Tournament`                                     |
| `joinTournamentByCode`  | POST   | `/tournaments/join-by-code`      | Yes  | `{ code }`                                     | `Tournament`                                     |
| `leaveTournament`       | POST   | `/tournaments/:id/leave`         | Yes  | -                                             | `{ success: true }`                              |
| `updateTournament`      | PUT    | `/tournaments/:id`               | Yes  | `{ name, maxPlayers, isPrivate? }`             | `Tournament`                                     |
| `deleteTournament`      | DELETE | `/tournaments/:id`               | Yes  | -                                             | `{ success: true }`                              |
| `startTournament`       | POST   | `/tournaments/:id/start`         | Yes  | -                                             | `Tournament` (with `matches`)                    |
| `sendFriendRequest`     | POST   | `/friends/request`               | Yes  | `{ username }`                                 | `{ id }`                                         |
| `getFriendRequests`     | GET    | `/friends/requests`              | Yes  | -                                             | `{ incoming: [], outgoing: [] }`                 |
| `acceptFriendRequest`   | POST   | `/friends/requests/:id/accept`   | Yes  | -                                             | `{ success: true }`                              |
| `declineFriendRequest`  | POST   | `/friends/requests/:id/decline`  | Yes  | -                                             | `{ success: true }`                              |
| `cancelFriendRequest`   | POST   | `/friends/requests/:id/cancel`   | Yes  | -                                             | `{ success: true }`                              |
| `removeFriend`          | DELETE | `/friends/:friendId`             | Yes  | -                                             | `{ success: true }`                              |
| `getFriends`            | GET    | `/friends`                       | Yes  | -                                             | `FriendInfo[]` (with online status)              |

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

Your opponent tabbed out, or their cat walked on the keyboard. Or they came back.

```json
{ "type": "opponent_disconnected", "gameId": "uuid" }
{ "type": "opponent_reconnected", "gameId": "uuid" }
```

### Client Messages (sent via WebSocket)

| Type                | Body                     | Description                |
| ------------------- | ------------------------ | -------------------------- |
| `spectate`          | `{ gameId, code? }`      | Start spectating (include `code` if game has `spectateMode: 'code'`) |
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

| Type               | Body                          | Condition                          |
| ------------------ | ----------------------------- | ---------------------------------- |
| `spectate_ok`      | `{ gameId, game }`            | Successfully spectating            |
| `spectate_error`   | `{ gameId, error }`           | Game not found or not active       |
| `spectator_count`  | `{ gameId, count }`           | Spectator count changed            |
| `draw_offered`     | `{ gameId, byPlayerId }`      | Other player offered draw          |
| `draw_accepted`    | `{ gameId }`                  | Draw was accepted                  |
| `draw_declined`    | `{ gameId }`                  | Draw was declined                  |
| `rematch_offered`  | `{ gameId, byPlayerId }`      | Other player offered rematch       |
| `game_aborted`     | `{ gameId }`                  | Game was aborted by creator        |
| `game_list_update` | `{ openGames, activeGames }`  | Game list changed (lobby refresh)  |
| `admin_broadcast`  | `{ message, timestamp }`      | Admin broadcast to all players     |

## Auth Flow

1. Call `register(username)` → receive `{ playerId, token }`
2. Store both in the observable store
3. All subsequent authenticated requests read `store.get('token')` and inject it as `Authorization: Bearer <token>`
4. WebSocket connection includes the token as a query parameter (`ws://localhost:3000/chess-ws?token=<bearer-token>`)

5. **Session validation** - On app startup, a restored session is validated by calling `GET /auth/me`. If the server rejects the token (server restart wipes the in-memory token store), the session is cleared and the user sees the login view instead of auto-navigating to the lobby.

## Type Mapping

The client re-exports all API types from `../chess-api/src/types.ts` in `src/types.ts`. Key types:

| Type               | Purpose                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `Color`            | `'white' \| 'black'`                                                                                          |
| `PieceType`        | All six piece types                                                                                           |
| `GameStatus`       | `waiting \| active \| checkmate \| stalemate \| draw \| resigned`                                             |
| `GameState`        | Full game snapshot (board, turn, status, players, moveHistory, boardHistory, halfMoveClock, visibility, spectateMode, spectateCode, etc.) |
| `Board`            | `(Piece \| null)[][]` - 8×8 grid                                                                              |
| `Move`             | A move with from/to, capture, castling, en-passant, promotion metadata                                        |
| `SerializedSquare` | WS message board format: `{ square, piece, color }`                                                           |
