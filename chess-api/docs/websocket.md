# WebSocket Protocol Reference

## Connection

```
ws://<host>:<port>/chess-ws?token=<bearer-token>
```

- Token obtained from `POST /auth/register` or `POST /auth/login`.
- Missing or invalid token → connection immediately closed (1008).
- Max 5 connections per IP (`WS_MAX_CONNECTIONS_PER_IP`).
- Heartbeat: server pings every 30s (`WS_HEARTBEAT_INTERVAL`), expects pong within 10s (`WS_PONG_TIMEOUT`).
- Rate limit: max 10 messages/second per connection. Excess dropped with `{"type":"error","error":"Rate limited — slow down"}`.

---

## Server → Client events

### Game events

#### `move`

```json
{
  "type": "move",
  "gameId": "uuid",
  "move": "e4", // algebraic notation
  "from": "e2",
  "to": "e4",
  "board": "...", // serialized board (8x8 array)
  "turn": "black",
  "lastMove": { "from": "e2", "to": "e4" },
  "moveCount": 1,
  "inCheck": false,
  "legalMoves": ["d5", "e5", "c5"],
  "enPassantTarget": null,
  "pgn": "1. e4",
  "clocks": { "white": 590000, "black": 600000 }
}
```

Sent to both players and all spectators after a legal move.

#### `game_started`

```json
{
  "type": "game_started",
  "gameId": "uuid",
  "players": { "white": "playerId", "black": "playerId" },
  "board": "...",
  "turn": "white",
  "clocks": { "white": 600000, "black": 600000 }
}
```

Sent when black joins a game (or white joins their own game in bot mode).

#### `game_over`

```json
{
  "type": "game_over",
  "gameId": "uuid",
  "result": "1-0", // "1-0" white wins, "0-1" black wins, "1/2-1/2" draw
  "reason": "checkmate", // "checkmate", "stalemate", "resign", "draw", "timeout", "aborted"
  "board": "...",
  "winner": "white", // or "black" or null
  "pgn": "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. Nbd2 Bb7 12. Bc2 Re8 13. Nf1 Bf8 14. Ng3 g6 15. Bg5 h6 16. Bd2 Bg7 17. a4 c5 18. d5 c4 19. Bb4 Nc5 20. Bxc5 dxc5 21. Qd2 Qd7 22. Qe3 Rad8 23. Qxc5 Qd6 24. Qxd6 Rxd6 25. a5 Red8 26. e5 Rxd5 27. Rxd5 Rxd5 28. Nf5 Bf8 29. Nxg7 Kxg7 30. Be4 Rd2 31. Bxb7 Rxb2 32. Bc6 Nxc6 33. Nf5+ Kg8 34. Ne7+ Kg7 35. Nf5+ Kg8 36. Ne7+ Kg7 1/2-1/2"
}
```

#### `draw_offered`

```json
{ "type": "draw_offered", "gameId": "uuid", "fromPlayerId": "uuid" }
```

#### `draw_accepted`

```json
{ "type": "draw_accepted", "gameId": "uuid" }
```

#### `draw_declined`

```json
{ "type": "draw_declined", "gameId": "uuid" }
```

#### `rematch_offer`

```json
{ "type": "rematch_offer", "gameId": "uuid", "fromPlayerId": "uuid" }
```

#### `rematch_accept`

```json
{ "type": "rematch_accept", "gameId": "uuid", "newGameId": "uuid" }
```

### Connection events

#### `opponent_disconnected`

```json
{ "type": "opponent_disconnected", "gameId": "uuid" }
```

Opponent's WebSocket closed (not yet resigned — they have `OPPONENT_TIMEOUT_MS` to reconnect).

#### `opponent_reconnected`

```json
{ "type": "opponent_reconnected", "gameId": "uuid" }
```

Opponent reconnected within the timeout window.

### Spectator events

#### `spectate_ok`

```json
{ "type": "spectate_ok", "gameId": "uuid" }
```

Sent in response to a `spectate` message if the registration succeeded.

#### `spectate_error`

```json
{ "type": "spectate_error", "error": "Game not found, not active, or invalid spectate code" }
```

Sent if the game doesn't exist, is not active, or requires a code.

#### `spectator_count`

```json
{ "type": "spectator_count", "gameId": "uuid", "count": 3 }
```

Sent when a spectator joins or leaves.

### Challenge events

#### `challenge`

```json
{
  "type": "challenge",
  "gameId": "uuid",
  "fromPlayerId": "uuid",
  "fromUsername": "player1",
  "fromDisplayName": "Player One"
}
```

Sent to the target player when someone challenges them.

#### `challenge_accept`

```json
{ "type": "challenge_accept", "gameId": "uuid", "fromPlayerId": "uuid" }
```

Sent to the challenger.

#### `challenge_decline`

```json
{ "type": "challenge_decline", "gameId": "uuid", "fromPlayerId": "uuid" }
```

Sent to the challenger.

### Game list events

#### `game_list_update`

```json
{
  "type": "game_list_update",
  "openGames": [
    {
      "id": "uuid",
      "whitePlayerId": "uuid",
      "whiteDisplayName": "Player1",
      "timeControl": { "initial": 600000, "increment": 5000 },
      "spectateMode": "public",
      "createdAt": 1700000000000
    }
  ],
  "activeGames": [
    {
      "id": "uuid",
      "whitePlayerId": "uuid",
      "blackPlayerId": "uuid",
      "whiteDisplayName": "Player1",
      "blackDisplayName": "Player2",
      "turn": "white",
      "spectateMode": "public",
      "spectatorCount": 2
    }
  ]
}
```

Broadcast to all connected clients when the game list changes (game created, joined, completed, aborted).

### Chat events

See [chat.md](./chat.md) for all chat-related event types.

---

## Client → Server messages

### Gameplay

| Type             | Fields                            | Description                   |
| ---------------- | --------------------------------- | ----------------------------- |
| `spectate`       | `gameId: string`, `code?: string` | Start spectating a game       |
| `unspectate`     | (none)                            | Stop spectating current game  |
| `offer_draw`     | `gameId: string`                  | Offer a draw to opponent      |
| `accept_draw`    | `gameId: string`                  | Accept opponent's draw offer  |
| `decline_draw`   | `gameId: string`                  | Decline opponent's draw offer |
| `rematch_offer`  | `gameId: string`                  | Offer a rematch               |
| `rematch_accept` | `gameId: string`                  | Accept rematch offer          |

### Challenges

| Type                | Fields                                 | Description                  |
| ------------------- | -------------------------------------- | ---------------------------- |
| `challenge`         | `toPlayerId: string`, `gameId: string` | Challenge a player to a game |
| `challenge_accept`  | `toPlayerId: string`, `gameId: string` | Accept a challenge           |
| `challenge_decline` | `toPlayerId: string`, `gameId: string` | Decline a challenge          |

### Chat

See [chat.md](./chat.md) for all chat client-to-server messages.

### Conversations

| Type                         | Fields               | Description                      |
| ---------------------------- | -------------------- | -------------------------------- |
| `get_conversations`          | (none)               | Get list of user's conversations |
| `start_private_conversation` | `toPlayerId: string` | Create or get private chat       |
| `create_group`               | `name: string`       | Create a group conversation      |

---

## Error responses

All errors follow this shape:

```json
{ "type": "error", "error": "Descriptive message" }
```

Triggers:

- Rate limited (>10 msg/s)
- Malformed JSON message
- Invalid spectate code
- Group operation authorization failure
- Failed to create group (e.g. duplicate name)
