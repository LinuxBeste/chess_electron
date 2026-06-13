# API Reference

Base URL: `http://localhost:25565` (direct) or webpack proxy at `http://localhost:3000` (in dev).

## Authentication

### Two modes

1. **Anonymous (Quick Play)** — just a display name, no password, no persistence. Name can be a duplicate. Stats are not saved between sessions.
2. **Registered (Account)** — unique username + password, persisted to SQLite. Stats (wins/losses/draws) and Elo rating are tracked automatically.

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
  "elo": 1200,
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

### POST /games/bot

Create a game against the Stockfish bot. Requires auth.

**Request:**

```json
{
  "color": "white",
  "skillLevel": 10
}
```

`skillLevel` ranges from 1 (weakest) to 20 (strongest).

**Response (201):** GameState with black set to `_bot_`.

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

### GET /games/completed

Get completed games for the authenticated player (archive). Supports pagination via `?page=1&limit=20`.

**Response (200):**

```json
{
  "games": [ { ...GameState }, ... ],
  "total": 42,
  "page": 1,
  "limit": 20
}
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

### POST /games/:gameId/draw

Offer, accept, or decline a draw. Requires auth.

**Request (offer):** `{ "action": "offer" }`
**Request (accept):** `{ "action": "accept" }`
**Request (decline):** `{ "action": "decline" }`

### GET /players/:playerId/games

Get completed games for the authenticated player. Requires auth. Can only view your own history.

**Response (200):**

```json
[ { ...GameState }, ... ]
```

**Response (403):** `{ "error": "Can only view your own match history" }`

### GET /players/me/active-game

Get the player's current active game ID.

**Response (200):**

```json
{ "gameId": "uuid-v4" }
```

**Response (404):** `{ "error": "No active game" }`

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

## Leaderboard

### GET /leaderboard

Get all registered players sorted by Elo rating.

**Response (200):**

```json
[
  { "rank": 1, "playerId": "uuid", "username": "alice", "elo": 1500, "wins": 10, "losses": 2, "draws": 1 },
  { "rank": 2, "playerId": "uuid", "username": "bob", "elo": 1300, "wins": 5, "losses": 3, "draws": 2 }
]
```

## Tournaments

### POST /tournaments

Create a tournament. Requires auth.

**Request:**

```json
{
  "name": "My Tournament",
  "maxPlayers": 8,
  "isPrivate": false
}
```

If `isPrivate` is true, the response includes a `joinCode` (8-char alphanumeric).

**Response (201):**

```json
{
  "id": "uuid-v4",
  "name": "My Tournament",
  "status": "waiting",
  "maxPlayers": 8,
  "isPrivate": false,
  "joinCode": null,
  "participants": [],
  "creatorId": "uuid-v4"
}
```

### GET /tournaments

List all tournaments (public or joined).

### GET /tournaments/join-by-code/:code

Join a private tournament using its 8-character join code. Requires auth.

### GET /tournaments/:id

Get tournament details.

### POST /tournaments/:id/join

Join a public tournament. Requires auth.

### PUT /tournaments/:id

Update tournament settings (creator only).

### DELETE /tournaments/:id

Cancel tournament (creator only).

## Admin Dashboard

The admin dashboard is served at `/admin/` (React SPA, built with Vite). It provides
server management features for operators.

### Authentication

Admin credentials are configured via environment variables (default: `admin`/`admin`).
Login returns a bearer token valid until server restart.

### POST /admin/api/login

**Request:**

```json
{ "username": "admin", "password": "admin" }
```

**Response (200):**

```json
{ "token": "uuid-v4" }
```

**Response (401):**

```json
{ "error": "Invalid admin credentials" }
```

All subsequent admin endpoints require the token in the `Authorization` header:

```
Authorization: Bearer <uuid>
```

### GET /admin/api/stats

Dashboard overview statistics.

**Response:**

```json
{
  "gamesActive": 2,
  "playersOnline": 4,
  "registeredUsers": 10,
  "totalUsers": 15
}
```

### GET /admin/api/games

All games currently tracked in memory (waiting, active, and finished).

**Response:**

```json
[
  {
    "id": "uuid",
    "status": "active",
    "white": "alice",
    "black": "bob",
    "turn": "white",
    "moves": 12,
    "createdAt": 1700000000000,
    "winner": null,
    "visibility": "public"
  }
]
```

### GET /admin/api/players

All players currently tracked in memory (both registered and temporary).

**Response:**

```json
[
  {
    "id": "uuid",
    "username": "alice",
    "displayName": "alice",
    "isRegistered": true,
    "online": true,
    "tokens": 2
  }
]
```

### GET /admin/api/bot-games

All bot games with counts and stats.

### GET /admin/api/tournaments

All tournaments with status and participant counts.

### GET /admin/api/leaderboard

Full leaderboard snapshot for admin.

### GET /admin/api/accounts

All permanent (registered) accounts from the database.

**Response:**

```json
[
  {
    "id": "uuid",
    "username": "alice",
    "displayName": "Alice",
    "createdAt": 1700000000000,
    "wins": 5,
    "losses": 2,
    "draws": 1,
    "elo": 1200
  }
]
```

### PUT /admin/api/accounts/:id

Update an account's display name.

**Request:**

```json
{ "displayName": "New Name" }
```

**Response:** `{ "success": true }`

### POST /admin/api/accounts/:id/reset-password

Reset an account's password.

**Request:**

```json
{ "newPassword": "new-secret" }
```

**Response:** `{ "success": true }`

### DELETE /admin/api/accounts/:id

Delete an account and all its session tokens.

**Response:** `{ "success": true }`

## WebSocket

Connect to the WebSocket endpoint at `ws://host:port/chess-ws` with the token as a query parameter:

```
ws://localhost:25565/chess-ws?token=<bearer-token>
```

In dev with webpack proxy: `ws://localhost:3000/chess-ws?token=<bearer-token>`

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

**Offer/accept/decline draw:**

```json
{ "type": "offer_draw", "gameId": "uuid" }
{ "type": "accept_draw", "gameId": "uuid" }
{ "type": "decline_draw", "gameId": "uuid" }
```

**Rematch:**

```json
{ "type": "rematch_offer", "gameId": "uuid" }
{ "type": "rematch_accept", "gameId": "uuid" }
```

**Challenge another player:**

```json
{ "type": "challenge", "toPlayerId": "uuid", "gameId": "uuid" }
{ "type": "challenge_accept", "toPlayerId": "uuid", "gameId": "uuid" }
{ "type": "challenge_decline", "toPlayerId": "uuid", "gameId": "uuid" }
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

**Opponent disconnected/reconnected:**

```json
{ "type": "opponent_disconnected", "gameId": "uuid" }
{ "type": "opponent_reconnected", "gameId": "uuid" }
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

| Status      | Description                             |
| ----------- | --------------------------------------- |
| `waiting`   | Created, waiting for second player      |
| `active`    | Both players joined, game in progress   |
| `checkmate` | King is in check with no legal moves    |
| `stalemate` | No legal moves but king is not in check |
| `draw`      | Draw by 50-move rule or agreement       |
| `resigned`  | A player resigned                       |
