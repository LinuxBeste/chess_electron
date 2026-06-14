# API Reference

Base URL: `http://localhost:25565` (direct) or webpack proxy at `http://localhost:3000` (in dev).

## Authentication

### Two modes

1. **Anonymous (Quick Play)** - just a display name, no password, no persistence. Name can be a duplicate. Stats are not saved between sessions.
2. **Registered (Account)** - unique username + password, persisted to SQLite. Stats (wins/losses/draws) and Elo rating are tracked automatically.

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

**Response (409 - username taken):**

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

### POST /auth/logout

Invalidate the current session token. Requires auth.

**Response (200):**

```json
{ "success": true }
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
  "avatarUrl": "/avatars/uuid.jpg",
  "elo": 1200,
  "stats": { "wins": 5, "losses": 2, "draws": 1 }
}
```

### PUT /auth/me

Update the authenticated player's display name. Requires auth.

**Request:**

```json
{ "displayName": "Alice" }
```

**Response (200):**

```json
{ "success": true, "displayName": "Alice" }
```

### PUT /auth/me/password

Change password (registered users only). Requires auth.

**Request:**

```json
{ "currentPassword": "old-secret", "newPassword": "new-secret" }
```

`newPassword` must be at least 8 characters.

**Response (200):** `{ "success": true }`

### POST /auth/me/avatar

Upload a profile picture (registered users only). Requires auth.  
`Content-Type: multipart/form-data` with field name `avatar`.  
Allowed types: JPEG, PNG, GIF, WebP. Max file size: 2 MB.

**Response (200):**

```json
{ "avatarUrl": "/avatars/uuid.jpg" }
```

### DELETE /auth/me/avatar

Remove the profile picture. Requires auth.

**Response (200):** `{ "success": true }`

### DELETE /auth/me

Delete the authenticated player's account permanently (registered users only). Requires auth.

**Response (200):** `{ "success": true }`

### GET /players/:playerId/profile

Get a player's public profile. Requires auth.

**Response (200):**

```json
{
  "id": "uuid-v4",
  "username": "alice",
  "displayName": "Alice",
  "isRegistered": true,
  "avatarUrl": "/avatars/uuid.jpg",
  "createdAt": 1700000000000,
  "stats": { "wins": 5, "losses": 2, "draws": 1 }
}
```

## Server Infrastructure

The server has a bunch of middleware bolted on to keep it from falling over in production. Here's the stack:

| What              | Why it's there                                                    |
| ----------------- | ----------------------------------------------------------------- |
| **trust proxy**   | So the server sees real IPs behind Cloudflare, not 127.0.0.1      |
| **CORS**          | `CORS_ORIGIN` env var, defaults to `*` (change this for prod)     |
| **CSP**           | Helmet with `'unsafe-inline'` on scripts/styles - Vite needs it   |
| **JSON limit**    | 10 KB. If your payload is bigger, you're doing something wrong    |
| **Timeout**       | 30 seconds then 503 + `req.destroy()`. Infinite loops begone      |
| **IP rate limit** | 20 req/min on login/register. Keeps the script kiddies at bay     |
| **Player limit**  | 100 req/min per player (configurable). Adjust to taste            |
| **WS timeout**    | 10s pong timeout. Dead clients get booted                         |
| **WS IP limit**   | Max 5 WS connections per IP. One person, five tabs - fine         |

### Crash Recovery

If something panics (`unhandledRejection`, `uncaughtException`), it gets logged and the process keeps running. No auto-exit - we're not Node.js circa 2015 anymore.

### Background Cleanup

The server runs a few cleanup loops so memory doesn't balloon:

- Every 60s: expired login lockouts and stale rate-limit entries
- Every 30min: dead admin tokens
- Every 10min: orphaned waiting games (configurable, 0=never)
- Every 6h: SQLite backup to `data/backups/` (keeps 7 days, also configurable)

### Graceful Shutdown

On SIGTERM/SIGINT (Docker stop, Ctrl+C, etc.):

1. Kill all Stockfish processes (no orphaned engines)
2. Close every WebSocket connection
3. Close the SQLite database cleanly
4. Exit

No data loss. Your games in progress will be lost (they're in-memory), but the database is safe.

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

**Request:** (all optional)

```json
{
  "visibility": "public",
  "spectateMode": "public"
}
```

- `visibility`: `'public'` (default) or `'private'`
- `spectateMode`: `'public'` (default, anyone can spectate) or `'code'` (requires a share code)

When `spectateMode` is `'code'`, the response includes a `spectateCode` field (UUID). This code is never exposed in public listings, active games lists, or game detail responses - only in the creation response.

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
  "visibility": "public",
  "spectateMode": "public",
  "spectateCode": null
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

`skillLevel` goes from 1 (plays like it's never seen a chessboard) to 20 (Stockfish at full strength, good luck).

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

Get completed games for the authenticated player. Supports pagination via `?page=1&limit=20`. Requires auth (own games only).

**Response (200):**

```json
{
  "games": [ { ...GameState }, ... ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### GET /games/archive

Public game archive - search completed games. No auth required.  
Supports pagination and filtering via query parameters.

**Query parameters:**

| Param    | Type     | Description                                       |
| -------- | -------- | ------------------------------------------------- |
| `page`   | `number` | Page number (default 1)                           |
| `limit`  | `number` | Items per page (default 20, max 100)              |
| `player` | `string` | Filter by player ID                               |
| `status` | `string` | Filter by status (`checkmate`, `resigned`, etc.)  |
| `from`   | `number` | Unix timestamp - only games after this date       |
| `to`     | `number` | Unix timestamp - only games before this date      |

**Response (200):**

```json
{
  "games": [{ ...archived game }],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### GET /games/archive/:gameId

Get a single archived game by ID.

**Response (200):** Archived game object.

**Response (404):** `{ "error": "Game not found" }`

### GET /games/:gameId

Get a game by ID.

**Response:** GameState object.

### POST /games/:gameId/join

Join a game as black. Requires auth.

**Response:** GameState (status changes to `active`).

### POST /games/:gameId/abort

Abort a waiting game (creator only). Requires auth.

**Response (200):** `{ "success": true }`

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

Get registered players sorted by Elo rating. Supports pagination via `?page=1&limit=50` (max 100).

**Response (200):**

```json
{
  "entries": [
    { "playerId": "uuid", "username": "alice", "displayName": "Alice", "avatarUrl": null, "rating": 1500, "wins": 10, "losses": 2, "draws": 1 },
    ...
  ],
  "total": 42,
  "page": 1,
  "limit": 50
}
```

## Friends

The friend system is only available to registered users.

### GET /friends

List friends with online status and current game. Requires auth.

**Response (200):**

```json
[
  {
    "id": "uuid",
    "username": "bob",
    "displayName": "Bob",
    "avatarUrl": null,
    "online": true,
    "currentGameId": "uuid-or-null"
  }
]
```

### POST /friends/request

Send a friend request by username. Requires auth.

**Request:**

```json
{ "username": "bob" }
```

**Response (201):** `{ "id": "request-id" }`

**Errors:** 404 (user not found), 409 (already friends or request pending), 400 (self-request)

### GET /friends/requests

List pending friend requests (incoming and outgoing). Requires auth.

**Response (200):**

```json
{
  "incoming": [{ "id": "req-id", "playerId": "uuid", "username": "bob", "displayName": "Bob", "avatarUrl": null, "createdAt": 1700000000000 }],
  "outgoing": [{ ... }]
}
```

### POST /friends/requests/:id/accept

Accept an incoming friend request. Requires auth (must be the request recipient).

**Response (200):** `{ "success": true }`

### POST /friends/requests/:id/decline

Decline an incoming friend request. Requires auth (must be the request recipient).

**Response (200):** `{ "success": true }`

### POST /friends/requests/:id/cancel

Cancel an outgoing friend request. Requires auth (must be the request sender).

**Response (200):** `{ "success": true }`

### DELETE /friends/:friendId

Remove a friend from the friend list. Requires auth.

**Response (200):** `{ "success": true }`

## Tournaments

### POST /tournaments

Create a tournament. Requires auth (registered users only).

**Request:**

```json
{
  "name": "My Tournament",
  "maxPlayers": 8,
  "isPrivate": false
}
```

- `maxPlayers`: 2-64 (default 8)
- `isPrivate`: if true, generates an 8-character `joinCode` for sharing

**Response (201):**

```json
{
  "id": "uuid-v4",
  "name": "My Tournament",
  "status": "waiting",
  "maxPlayers": 8,
  "isPrivate": false,
  "joinCode": null,
  "participants": [{ "playerId": "uuid", "displayName": "Alice", "seed": 0 }],
  "creatorId": "uuid-v4"
}
```

### GET /tournaments

List all public tournaments (no auth required).

### GET /tournaments/:id

Get tournament details (includes participants and matches).  
`joinCode` is only shown to the tournament creator.

### POST /tournaments/:id/join

Join a public tournament. Requires auth (registered users only).  
The tournament must be in `waiting` status and have space available.

**Response (200):** Tournament object with the new participant added.

### POST /tournaments/join-by-code

Join a private tournament using its 8-character join code. Requires auth (registered users only).

**Request:**

```json
{ "code": "ABC12345" }
```

**Response (200):** Tournament object.

### POST /tournaments/:id/leave

Leave a tournament you've joined (creator only during `waiting` status). Requires auth.

**Response (200):** `{ "success": true }`

### PUT /tournaments/:id

Update tournament name, max players, or privacy (creator only, `waiting` status only). Requires auth.

### DELETE /tournaments/:id

Cancel tournament (creator only, `waiting` status only). Requires auth.

**Response (200):** `{ "success": true }`

### POST /tournaments/:id/start

Start the tournament (creator only, `waiting` status only, minimum 2 players).  
Generates single-elimination brackets seeded by join order. Requires auth.

**Response (200):** Tournament object with `status: "active"` and `matches` populated.

## Admin Dashboard

There's a React dashboard at `/admin/` if you want to see what's happening on the server without curling every endpoint. It's built with Vite + Tailwind, served as static files by Express.

### Authentication

Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in your environment. If you forget to set the password, a random 24-character one gets generated and logged on startup - check your logs. Passwords are PBKDF2-hashed (same as user passwords). Tokens expire after 24h by default (`ADMIN_TOKEN_TTL`).

### POST /admin/api/login

**Request:**

```json
{ "username": "admin", "password": "<password>" }
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

### DELETE /admin/api/accounts/:id

Delete an account and all its session tokens.

**Response:** `{ "success": true }`

### POST /admin/api/accounts/:id/reset-password

Reset a user's password (admin override, no current password required).

**Request:** `{ "newPassword": "new-secret" }` (min 8 chars)

**Response:** `{ "success": true }`

### DELETE /admin/api/accounts/:id/avatar

Remove a user's profile picture.

**Response:** `{ "success": true }`

### POST /admin/api/logout

Invalidate the current admin session token.

**Response (200):** `{ "success": true }`

### GET /admin/api/system

Detailed system information - memory, CPU, disk, network interfaces, process info.

**Response (200):** Object with `memory`, `cpu`, `process`, `system`, `disk`, `networks` sub-objects.

### GET /admin/api/system/metrics

Live delta-tracked metrics (CPU %, memory, network I/O, disk I/O).  
Call repeatedly to get rate deltas.

**Response (200):**

```json
{
  "cpu": 12.5,
  "memory": { "used": 8589934592, "total": 17179869184, "percent": 50.0 },
  "net": { "rx": 102400, "tx": 51200 },
  "disk": { "read": 4096, "write": 2048 },
  "timestamp": 1700000000000
}
```

### GET /admin/api/system/processes

List running processes sorted by CPU usage (from `ps aux`).

**Response (200):**

```json
[
  { "user": "chess", "pid": 1234, "cpu": 5.2, "mem": 1.5, "rss": 65536, "command": "node dist/index.js" }
]
```

### GET /admin/api/config

Server configuration (env var values, sanitized).

**Response (200):**

```json
{
  "maxGamesPerPlayer": 20,
  "rateLimitWindowMs": 60000,
  "rateLimitMaxRequests": 100,
  "waitingTtl": 10,
  "adminUsername": "admin",
  "dbPath": "data/chess.db",
  "nodeVersion": "v20.0.0",
  "platform": "linux"
}
```

### POST /admin/api/players/:id/ban

Ban a player by player ID. Active games involving the player are ended.

**Response (200):** `{ "success": true }`

### POST /admin/api/players/:id/kick

Disconnect a player (force-close their WebSocket connections).

**Response (200):** `{ "success": true }`

### POST /admin/api/games/:id/end

Force-end an active game (admin override). Kills engine process for bot games.

**Response (200):** `{ "success": true }`

### GET /admin/api/bans

List all banned players and IPs.

**Response (200):**

```json
{
  "players": ["player-id-1", "player-id-2"],
  "ips": ["1.2.3.4", "5.6.7.8"]
}
```

### POST /admin/api/bans/ip

Ban an IP address.

**Request:** `{ "ip": "1.2.3.4" }`

**Response (200):** `{ "success": true }`

### DELETE /admin/api/bans/player/:id

Unban a player by player ID.

**Response (200):** `{ "success": true }`

### DELETE /admin/api/bans/ip/:ip

Unban an IP address.

**Response (200):** `{ "success": true }`

### GET /admin/api/logs

Read server log files. Supports `?type=app|audit|http|all` and `?lines=200` (max 5000).

**Response (200):**

```json
{
  "logs": { "app": ["line1", "line2"], "audit": [], "http": [] },
  "files": ["app-2025-01-01.log", "audit-2025-01-01.log"]
}
```

### GET /admin/api/archive

Search completed games in the database. Supports `?page`, `?limit`, `?player=`, `?status=`.

### GET /admin/api/tournaments/:id

Get detailed tournament info including participants and matches (admin full access).

### DELETE /admin/api/tournaments/:id

Delete a tournament and all its matches/participants (admin cascade delete).

### POST /admin/api/broadcast

Send a broadcast message to all connected players via WebSocket.

**Request:** `{ "message": "Server maintenance in 5 minutes" }`

**Response (200):** `{ "success": true, "recipientCount": 15 }`

## WebSocket

Connect to the WebSocket endpoint at `ws://host:port/chess-ws` with the token as a query parameter:

```
ws://localhost:25565/chess-ws?token=<bearer-token>
```

In dev with webpack proxy: `ws://localhost:3000/chess-ws?token=<bearer-token>`

### Client Messages

**Spectate a game:**

If the game was created with `spectateMode: "code"`, the `code` field is required.

```json
{
  "type": "spectate",
  "gameId": "uuid",
  "code": "optional-spectate-code"
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

**Game aborted (creator cancelled waiting game):**

```json
{ "type": "game_aborted", "gameId": "uuid" }
```

**Opponent disconnected/reconnected:**

```json
{ "type": "opponent_disconnected", "gameId": "uuid" }
{ "type": "opponent_reconnected", "gameId": "uuid" }
```

**Draw offered/accepted/declined:**

```json
{ "type": "draw_offered", "gameId": "uuid", "byPlayerId": "uuid" }
{ "type": "draw_accepted", "gameId": "uuid" }
{ "type": "draw_declined", "gameId": "uuid" }
```

**Rematch offered:**

```json
{ "type": "rematch_offered", "gameId": "uuid", "byPlayerId": "uuid" }
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

**Spectator count changed:**

```json
{ "type": "spectator_count", "gameId": "uuid", "count": 3 }
```

**Game list updated (broadcast when games are created/joined/ended):**

```json
{ "type": "game_list_update", "openGames": [{ ... }], "activeGames": [{ ... }] }
```

**Admin broadcast:**

```json
{ "type": "admin_broadcast", "message": "Server maintenance soon", "timestamp": 1700000000000 }
```

## Game Status Values

These are the possible values for `GameState.status`. Nothing too surprising if you've played chess before.

| Status      | What it means                        |
| ----------- | ------------------------------------ |
| `waiting`   | Looking for a second player          |
| `active`    | Game is on                            |
| `checkmate` | King's trapped, game's over          |
| `stalemate` | No legal moves, not in check - a draw|
| `draw`      | 50-move rule, agreement, or repetition|
| `resigned`  | Someone gave up                      |
