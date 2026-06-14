# curl Examples

## Prerequisites

Make sure the server is running:

```bash
pnpm run build && pnpm start
```

Or via Docker:

```bash
docker compose up --build
```

All examples hit `http://localhost:25565` directly. If you're running through the webpack dev proxy, swap in `http://localhost:3000` instead.

## 1. Register Players

```bash
# Register white player
curl -s -X POST http://localhost:25565/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "alice"}' | jq
```

**Response:**

```json
{
  "playerId": "550e8400-e29b-41d4-a716-446655440000",
  "token": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "isRegistered": false,
  "displayName": "alice"
}
```

```bash
# Register black player
curl -s -X POST http://localhost:25565/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "bob"}' | jq
```

Save the tokens - you'll need them for authenticated requests.

## 2. Create a Game (White)

```bash
curl -s -X POST http://localhost:25565/games \
  -H "Authorization: Bearer <white-token>" | jq
```

**Response:**

```json
{
  "id": "game-uuid-here",
  "status": "waiting",
  "players": { "white": "white-player-id" },
  "turn": "white",
  ...
}
```

Save the game ID from the response.

## 3. List Open Games

```bash
curl -s http://localhost:25565/games | jq
```

## 4. Join a Game (Black)

```bash
curl -s -X POST http://localhost:25565/games/<game-id>/join \
  -H "Authorization: Bearer <black-token>" | jq
```

**Response:** status changes to `active`.

## 4b. Create a Game with Spectate Code

```bash
curl -s -X POST http://localhost:25565/games \
  -H "Authorization: Bearer <white-token>" \
  -H "Content-Type: application/json" \
  -d '{"visibility": "public", "spectateMode": "code"}' | jq
```

**Response** includes `"spectateCode": "uuid"` - share this with spectators.

Spectators connect via WebSocket and include the code:

```json
{ "type": "spectate", "gameId": "<game-id>", "code": "<spectate-code>" }
```

## 5. Play a Full Game (Scholar's Mate)

```bash
# 1. e4
curl -s -X POST http://localhost:25565/games/<game-id>/move \
  -H "Authorization: Bearer <white-token>" \
  -H "Content-Type: application/json" \
  -d '{"from": "e2", "to": "e4"}' | jq

# 1... e5
curl -s -X POST http://localhost:25565/games/<game-id>/move \
  -H "Authorization: Bearer <black-token>" \
  -H "Content-Type: application/json" \
  -d '{"from": "e7", "to": "e5"}' | jq

# 2. Qh5
curl -s -X POST http://localhost:25565/games/<game-id>/move \
  -H "Authorization: Bearer <white-token>" \
  -H "Content-Type: application/json" \
  -d '{"from": "d1", "to": "h5"}' | jq

# 2... Nc6
curl -s -X POST http://localhost:25565/games/<game-id>/move \
  -H "Authorization: Bearer <black-token>" \
  -H "Content-Type: application/json" \
  -d '{"from": "b8", "to": "c6"}' | jq

# 3. Bc4
curl -s -X POST http://localhost:25565/games/<game-id>/move \
  -H "Authorization: Bearer <white-token>" \
  -H "Content-Type: application/json" \
  -d '{"from": "f1", "to": "c4"}' | jq

# 3... Nf6
curl -s -X POST http://localhost:25565/games/<game-id>/move \
  -H "Authorization: Bearer <black-token>" \
  -H "Content-Type: application/json" \
  -d '{"from": "g8", "to": "f6"}' | jq

# 4. Qxf7#  (checkmate!)
curl -s -X POST http://localhost:25565/games/<game-id>/move \
  -H "Authorization: Bearer <white-token>" \
  -H "Content-Type: application/json" \
  -d '{"from": "h5", "to": "f7"}' | jq
```

Final response shows `"status": "checkmate"`, `"winner": "white"`.

## 6. Get Legal Moves

```bash
curl -s http://localhost:25565/games/<game-id>/moves \
  -H "Authorization: Bearer <white-token>" | jq
```

**Response:**

```json
{
  "moves": [
    { "from": "a2", "to": "a3" },
    { "from": "a2", "to": "a4" },
    { "from": "b2", "to": "b3" },
    ...
  ]
}
```

## 7. Resign

```bash
curl -s -X POST http://localhost:25565/games/<game-id>/resign \
  -H "Authorization: Bearer <white-token>" | jq
```

**Response:** `"status": "resigned"`, `"winner": "black"`.

## 8. Health Check

```bash
curl -s http://localhost:25565/health | jq
```

**Response:**

```json
{
  "status": "ok",
  "uptime": 123.45,
  "gamesActive": 2,
  "playersOnline": 4
}
```

## 9. Play Against Bot

```bash
# Create bot game as white with skill level 10
curl -s -X POST http://localhost:25565/games/bot \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"color": "white", "skillLevel": 10}' | jq
```

## 10. Logout

```bash
curl -s -X POST http://localhost:25565/auth/logout \
  -H "Authorization: Bearer <token>" | jq
```

**Response:** `{ "success": true }`

## 11. Get Leaderboard

```bash
curl -s http://localhost:25565/leaderboard | jq
```

## Full Game in One Script

The whole Scholar's Mate in a single bash pipeline, because why not:
W=$(curl -s -X POST http://localhost:25565/auth/register -H "Content-Type: application/json" -d '{"username":"w"}' | jq -r '.token')
B=$(curl -s -X POST http://localhost:25565/auth/register -H "Content-Type: application/json" -d '{"username":"b"}' | jq -r '.token')
GID=$(curl -s -X POST http://localhost:25565/games -H "Authorization: Bearer $W" | jq -r '.id')
curl -s -X POST "http://localhost:25565/games/$GID/join" -H "Authorization: Bearer $B" > /dev/null
curl -s -X POST "http://localhost:25565/games/$GID/move" -H "Authorization: Bearer $W" -H "Content-Type: application/json" -d '{"from":"e2","to":"e4"}' > /dev/null
curl -s -X POST "http://localhost:25565/games/$GID/move" -H "Authorization: Bearer $B" -H "Content-Type: application/json" -d '{"from":"e7","to":"e5"}' > /dev/null
curl -s -X POST "http://localhost:25565/games/$GID/move" -H "Authorization: Bearer $W" -H "Content-Type: application/json" -d '{"from":"d1","to":"h5"}' > /dev/null
curl -s -X POST "http://localhost:25565/games/$GID/move" -H "Authorization: Bearer $B" -H "Content-Type: application/json" -d '{"from":"b8","to":"c6"}' > /dev/null
curl -s -X POST "http://localhost:25565/games/$GID/move" -H "Authorization: Bearer $W" -H "Content-Type: application/json" -d '{"from":"f1","to":"c4"}' > /dev/null
curl -s -X POST "http://localhost:25565/games/$GID/move" -H "Authorization: Bearer $B" -H "Content-Type: application/json" -d '{"from":"g8","to":"f6"}' > /dev/null
curl -s -X POST "http://localhost:25565/games/$GID/move" -H "Authorization: Bearer $W" -H "Content-Type: application/json" -d '{"from":"h5","to":"f7"}' | jq '{status: .status, winner: .winner, lastMove: .lastMove}'

```

```
