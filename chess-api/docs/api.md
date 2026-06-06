# API Reference

Base URL: `http://localhost:3000`

## Authentication

### Two modes

1. **Anonymous (Quick Play)** — just a display name, no password, no persistence. Name can be a duplicate. Stats are not saved between sessions.
2. **Registered (Account)** — unique username + password, persisted to SQLite. Stats (wins/losses/draws) are tracked automatically.

All authenticated endpoints require a bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

### POST /auth/register

Create a new player. Two modes:

- **Anonymous**: `{ "username": "alice" }` (in-memory, name can be duplicate)
- **Registered**: `{ "username": "alice", "password": "secret" }` (persisted, username must be unique)

**Response (201):**
```json
{
  "playerId": "uuid-v4",
  "token": "uuid-v4",
  "isRegistered": false,
  "displayName": "alice"
}
```

**Response (409 — username taken):**
```json
{ "error": "Username is already taken" }
```

### POST /auth/login

Log in as an existing registered user.

**Request:**
```json
{ "username": "alice", "password": "secret" }
```

**Response (200):**
```json
{
  "success": true,
  "playerId": "uuid-v4",
  "token": "uuid-v4",
  "displayName": "alice"
}
```

**Response (401):**
```json
{ "error": "Invalid username or password" }
```

### GET /auth/me

Returns the authenticated player's info. Requires auth. Includes stats for registered users.

**Response (anonymous):**
```json
{
  "id": "uuid-v4",
  "username": "alice",
  "displayName": "alice",
  "isRegistered": false
}
```

**Response (registered):**
```json
{
  "id": "uuid-v4",
  "username": "alice",
  "displayName": "alice",
  "isRegistered": true,
  "stats": { "wins": 5, "losses": 2, "draws": 1 }
}
```

## Health

### GET /health

**Response:**
```json
{
  "status": "ok",
  "uptime": 123.45,
  "gamesActive": 2,
  "playersOnline": 4
}
```

## Games

### POST /games

Create a new game. The creator plays white. Requires auth.

Optional body field: `visibility` (`'public' | 'private'`, defaults to `'public'`).

**Response (201):**
```json
{
  "id": "uuid-v4",
  "board": [[...], ...],
  "turn": "white",
  "status": "waiting",
  "players": { "white": "playerId" },
  "moveHistory": [],
  "boardHistory": [],
  "enPassantTarget": null,
  "castlingRights": {
    "white": { "kingside": true, "queenside": true },
    "black": { "kingside": true, "queenside": true }
  },
  "lastMove": null,
  "winner": null,
  "halfMoveClock": 0,
  "createdAt": 1700000000000,
  "visibility": "public"
}
```

### GET /games

List all open (waiting) public games.

**Response:**
```json
[ { ...GameState }, ... ]
```

### GET /games/active

List all active games (for spectating). No auth required.

**Response:**
```json
[ { ...GameState }, ... ]
```

### GET /games/:gameId

Get a game by ID.

**Response:** GameState object.

### POST /games/:gameId/join

Join a game as black. Requires auth.

**Response:** GameState (status changes to `active`).

### POST /games/:gameId/move

Make a move. Requires auth.

**Request:**
```json
{
  "from": "e2",
  "to": "e4",
  "promotion": "queen"
}
```

`promotion` is optional (defaults to queen).

**Response:** Updated GameState.

### POST /games/:gameId/resign

Resign from a game. Requires auth.

**Response:** GameState with status `resigned` and winner set.

### GET /players/:playerId/games

Get completed games for the authenticated player (match history). Requires auth. Can only view your own history.

**Response (200):**
```json
[ { ...GameState }, ... ]
```

**Response (403):** `{ "error": "Can only view your own match history" }`

### GET /games/:gameId/moves

Get all legal moves for the authenticated player in a game. Requires auth.

**Response:**
```json
{
  "moves": [
    { "from": "e2", "to": "e4" },
    { "from": "g1", "to": "f3" }
  ]
}
```

## WebSocket

Connect to the WebSocket endpoint at the same host/port with the token as a query parameter:

```
ws://localhost:3000/?token=<bearer-token>
```

### Client Messages

**Spectate a game:**
```json
{
  "type": "spectate",
  "gameId": "uuid"
}
```

**Unspectate a game:**
```json
{
  "type": "unspectate",
  "gameId": "uuid"
}
```

**Send a chat message:**
```json
{
  "type": "chat_message",
  "gameId": "uuid",
  "text": "Hello!"
}
```

### Server Messages

**On game started:**
```json
{
  "type": "game_started",
  "gameId": "uuid",
  "game": { ...GameState }
}
```

**On a move:**
```json
{
  "type": "move",
  "gameId": "uuid",
  "board": [ { "square": "e4", "piece": "pawn", "color": "white" }, ... ],
  "turn": "black",
  "lastMove": { "from": "e2", "to": "e4" },
  "status": "active"
}
```

**On game end (checkmate/stalemate/resign/draw):**
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

**Chat message broadcast:**
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

**Spectator acknowledgement:**
```json
{
  "type": "spectate_ok",
  "gameId": "uuid",
  "game": { ...GameState }
}
```

**Spectator error:**
```json
{
  "type": "spectate_error",
  "gameId": "uuid",
  "error": "Game not found or not active"
}
```

## Game Status Values

| Status     | Description |
|------------|-------------|
| `waiting`  | Created, waiting for second player |
| `active`   | Both players joined, game in progress |
| `checkmate`| King is in check with no legal moves |
| `stalemate`| No legal moves but king is not in check |
| `draw`     | Draw by 50-move rule |
| `resigned` | A player resigned |
