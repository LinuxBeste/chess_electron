# API Reference

Base URL: `http://localhost:3000`

## Authentication

Register a player to receive a bearer token. Include this token in the `Authorization` header for all authenticated endpoints.

```
Authorization: Bearer <token>
```

### POST /auth/register

Create a new player account (no password, just a display name).

**Request:**
```json
{ "username": "alice" }
```

**Response (201):**
```json
{
  "playerId": "uuid-v4",
  "token": "uuid-v4"
}
```

### GET /auth/me

Returns the authenticated player's info. Requires auth.

**Response:**
```json
{
  "id": "uuid-v4",
  "username": "alice"
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

**Response (201):**
```json
{
  "id": "uuid-v4",
  "board": [[...], ...],
  "turn": "white",
  "status": "waiting",
  "players": { "white": "playerId" },
  "moveHistory": [],
  "enPassantTarget": null,
  "castlingRights": {
    "white": { "kingside": true, "queenside": true },
    "black": { "kingside": true, "queenside": true }
  },
  "lastMove": null,
  "winner": null,
  "createdAt": 1700000000000
}
```

### GET /games

List all open (waiting) games.

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

### Server Messages

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

**On game end (checkmate/stalemate/resign):**
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

## Game Status Values

| Status     | Description |
|------------|-------------|
| `waiting`  | Created, waiting for second player |
| `active`   | Both players joined, game in progress |
| `checkmate`| King is in check with no legal moves |
| `stalemate`| No legal moves but king is not in check |
| `resigned` | A player resigned |
