# Chat System

The chat system has three conversation types: **lobby**, **private**, and **group**. Each is backed by PostgreSQL and delivered in real-time via WebSocket.

## Architecture

```
                ┌──────────────────────────────────────────┐
                │               WebSocket                   │
                │  Client → Server: chat messages           │
                │  Server → Client: broadcast to recipients │
                └──────────────────────────────────────────┘
                              │
               ┌──────────────┴──────────────┐
               │         chat.ts              │
               │  handleLobbyChat()            │
               │  handlePrivateChat()          │
               │  handleGroupChat()            │
               │  handleChatMessage() (in-game) │
               └──────────────┬──────────────┘
                              │
               ┌──────────────┴──────────────┐
               │         db.ts                │
               │  INSERT INTO chat_messages    │
               │  SELECT ... JOIN users ...    │
               └─────────────────────────────┘
```

## Environment variables

| Variable                | Default | Description                                     |
| ----------------------- | ------- | ----------------------------------------------- |
| `CHAT_MAX_LENGTH`       | 500     | Max characters per message                      |
| `CHAT_HISTORY_MAX`      | 50      | Max in-memory messages per game chat            |
| `GROUP_NAME_MAX_LENGTH` | 50      | Max group conversation name length              |
| `GROUP_HISTORY_LIMIT`   | 200     | Max messages loaded from DB per history request |

---

## Lobby Chat

The lobby is a global conversation that all connected players can see.

### ID

```
"lobby"
```

### Database

- Created on startup via `ensureLobbyConversation()`.
- A row in `chat_conversations` with `type = 'lobby'`.
- All messages persisted to `chat_messages` with `conversation_id = 'lobby'`.

### WebSocket

**Client → Server:**

```json
{ "type": "lobby_chat", "text": "Hello everyone!" }
```

**Server → All clients:**

```json
{
  "type": "lobby_chat_message",
  "conversationId": "lobby",
  "messageId": "uuid",
  "playerId": "uuid",
  "username": "player1",
  "text": "Hello everyone!",
  "timestamp": 1700000000000
}
```

**Request history:**

```json
{ "type": "get_lobby_chat_history" }
```

**Response:**

```json
{
  "type": "lobby_chat_history",
  "conversationId": "lobby",
  "messages": [
    {
      "messageId": "uuid",
      "playerId": "uuid",
      "username": "player1",
      "text": "Hello everyone!",
      "timestamp": 1700000000000
    }
  ]
}
```

### Behavior

- Every connected player receives every lobby message. No opt-out.
- History is loaded from DB (last `GROUP_HISTORY_LIMIT` messages, default 200).
- Rate limited by WS message rate (10/s).

---

## Private Chat

One-on-one conversations between two players.

### ID format

```
priv_<uuid1>_<uuid2>
```

Where UUIDs are sorted alphabetically, so `priv_a..._b...` is always the same regardless of who starts.

### Database

- Created lazily on first message via `getOrCreatePrivateConversation()`.
- Both users added to `chat_conversation_members`.
- Messages stored in `chat_messages` with `conversation_id = priv_*`.

### WebSocket

**Client → Server:**

```json
{ "type": "private_chat", "toPlayerId": "uuid", "text": "Want to play?" }
```

**Server → Both participants:**

```json
{
  "type": "private_chat_message",
  "conversationId": "priv_<id1>_<id2>",
  "messageId": "uuid",
  "playerId": "uuid",
  "username": "player1",
  "text": "Want to play?",
  "timestamp": 1700000000000
}
```

**Start a conversation (get or create):**

```json
{ "type": "start_private_conversation", "toPlayerId": "uuid" }
```

Response:

```json
{
  "type": "conversation_created",
  "conversationId": "priv_<id1>_<id2>",
  "withName": "Player2"
}
```

**Get chat history:**

```json
{ "type": "get_private_chat_history", "conversationId": "priv_<id1>_<id2>" }
```

Response:

```json
{
  "type": "private_chat_history",
  "conversationId": "priv_<id1>_<id2>",
  "messages": [ ... ]
}
```

### List all conversations

**Request:**

```json
{ "type": "get_conversations" }
```

**Response:**

```json
{
  "type": "conversations_list",
  "conversations": [
    {
      "id": "lobby",
      "type": "lobby",
      "name": "Lobby",
      "lastMessageAt": 1700000000000,
      "unread": 0
    },
    {
      "id": "priv_<id1>_<id2>",
      "type": "private",
      "name": "Player2",
      "lastMessageAt": 1700000000000,
      "unread": 0
    }
  ]
}
```

Private conversation names are resolved to the other participant's display name (favoring in-memory `players` map, falling back to DB `users.display_name`, or truncated UUID).

---

## Group Chat

Multi-user conversations with roles and ownership.

### Roles

| Role     | Permissions                                                                   |
| -------- | ----------------------------------------------------------------------------- |
| `owner`  | Full control: add/remove members, promote/demote, transfer ownership, disband |
| `admin`  | Add members only                                                              |
| `member` | Read and write messages                                                       |

### Database

- Created via `createGroupConversation(ownerId, name)`.
- Owner auto-added as member with `role = 'owner'`.
- Rows in `chat_conversations` (type `group`), `chat_conversation_members`, `chat_messages`.

### WebSocket

**Create group:**

```json
{ "type": "create_group", "name": "Chess Club" }
```

Response:

```json
{ "type": "group_created", "conversationId": "uuid", "name": "Chess Club" }
```

**Send message:**

```json
{ "type": "group_chat", "conversationId": "uuid", "text": "Good game everyone!" }
```

Broadcast to all members:

```json
{
  "type": "group_chat_message",
  "conversationId": "uuid",
  "messageId": "uuid",
  "playerId": "uuid",
  "username": "player1",
  "text": "Good game everyone!",
  "timestamp": 1700000000000
}
```

**Get history:**

```json
{ "type": "get_group_chat_history", "conversationId": "uuid" }
```

Response includes both messages and current member list:

```json
{
  "type": "group_chat_history",
  "conversationId": "uuid",
  "messages": [ ... ],
  "members": [
    { "playerId": "uuid", "username": "player1", "displayName": "Player1", "role": "owner" },
    { "playerId": "uuid", "username": "player2", "displayName": "Player2", "role": "member" }
  ]
}
```

### Group management

All management operations require the sender to be the `owner` unless specified:

| Action                 | Message type               | Required fields              | Auth                   |
| ---------------------- | -------------------------- | ---------------------------- | ---------------------- |
| Add member             | `group_add_member`         | `conversationId`, `playerId` | Owner or admin         |
| Add member by username | `group_add_member_by_name` | `conversationId`, `username` | Owner or admin         |
| Remove member          | `group_remove_member`      | `conversationId`, `playerId` | Owner only             |
| Promote to admin       | `group_promote_member`     | `conversationId`, `playerId` | Owner only             |
| Demote from admin      | `group_demote_member`      | `conversationId`, `playerId` | Owner only             |
| Transfer ownership     | `group_transfer_ownership` | `conversationId`, `playerId` | Owner only             |
| Leave group            | `group_leave`              | `conversationId`             | Any member (not owner) |
| Disband group          | `group_disband`            | `conversationId`             | Owner only             |

**Broadcast events** (sent to all group members):

- `group_member_added` — `{ conversationId, playerId, username, displayName, role }`
- `group_member_removed` — `{ conversationId, playerId }` (also sent to removed member)
- `group_member_promoted` — `{ conversationId, playerId, role: "admin" }`
- `group_member_demoted` — `{ conversationId, playerId, role: "member" }`
- `group_ownership_transferred` — `{ conversationId, newOwnerId }`
- `group_member_left` — `{ conversationId, playerId }`
- `group_disbanded` — `{ conversationId }` (sent to all except requester)

**Error responses:**

```json
{ "type": "error", "error": "Only the group owner can remove members" }
```

```json
{ "type": "error", "error": "Cannot remove the group owner" }
```

```json
{ "type": "error", "error": "User not found" }
```

---

## In-Game Chat

Game-specific chat between players and spectators. Not persisted to DB — stored in-memory only.

### Scope

- Players (white and black) see all game chat messages.
- Spectators of the game see all game chat messages.
- Messages are limited to `CHAT_HISTORY_MAX` (default 50) in-memory per game.

### WebSocket

**Client → Server:**

```json
{ "type": "chat_message", "gameId": "uuid", "text": "Good luck!" }
```

**Server → Players + Spectators:**

```json
{
  "type": "chat_message",
  "gameId": "uuid",
  "playerId": "uuid",
  "username": "player1",
  "text": "Good luck!",
  "timestamp": 1700000000000
}
```

**Get game chat history:**

```json
{ "type": "get_chat_history", "gameId": "uuid" }
```

**Response:**

```json
{
  "type": "chat_history",
  "gameId": "uuid",
  "messages": [{ "playerId": "uuid", "username": "player1", "text": "Good luck!", "timestamp": 1700000000000 }]
}
```

### Data flow

1. `handleChatMessage()` in `chat.ts` validates: player exists, game exists, sender is player or spectator.
2. Message appended to in-memory `chatHistory` Map (keyed by gameId).
3. Sent to white, black, and all spectators via WebSocket.

---

## Conversation listing

`getConversationsForUser(userId)` in `chat.ts` returns all conversations the user is a member of (excluding `game` type). Results ordered by `last_message_at DESC`.

- **Lobby**: always shown, named "Lobby"
- **Private**: named after the other participant's display name
- **Group**: named by the `name` field in `chat_conversations`

The `unread` field is currently always 0 (unread tracking not implemented).
