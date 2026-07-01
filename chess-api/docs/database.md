# Database Schema

PostgreSQL is the primary data store. Connection is managed via the `pg` pool in `src/db.ts`.

## Connection

| Variable                        | Default                                         | Description                  |
| ------------------------------- | ----------------------------------------------- | ---------------------------- |
| `DATABASE_URL`                  | `postgresql://chess:chess@localhost:5432/chess` | Connection string            |
| `DB_POOL_MAX`                   | 20                                              | Max concurrent connections   |
| `DB_POOL_IDLE_TIMEOUT_MS`       | 30000                                           | Close idle connections after |
| `DB_POOL_CONNECTION_TIMEOUT_MS` | 5000                                            | Connection attempt timeout   |

The pool is lazily initialized on the first query. `INT8` and `NUMERIC` types are auto-parsed to JS numbers.

---

## Migrations

Migrations are tracked in a `_migrations` table:

```sql
CREATE TABLE _migrations (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Migrations run in order on startup via `initDb()`. There are 5 versions:

| Version | Changes                                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1       | Core tables: users, user_tokens, bans, friend_requests, friends, completed_games, tournaments, tournament_participants, tournament_matches |
| 2       | Change move_history and board_history from JSONB to TEXT                                                                                   |
| 3       | Performance indexes on bans, users(rating), tournaments(join_code), tournament_participants(player_id), user_tokens(created_at)            |
| 4       | Chat tables: chat_conversations, chat_conversation_members, chat_messages                                                                  |
| 5       | Add owner_id to chat_conversations, role to chat_conversation_members                                                                      |

---

## Tables

### `users`

| Column          | Type    | Constraints           | Description                       |
| --------------- | ------- | --------------------- | --------------------------------- |
| `id`            | TEXT    | PK                    | UUID v4                           |
| `username`      | TEXT    | NOT NULL, UNIQUE      | Login name, lowercased            |
| `password_hash` | TEXT    | nullable              | PBKDF2 hash or NULL for anonymous |
| `display_name`  | TEXT    | NOT NULL              | Shown in UI                       |
| `created_at`    | BIGINT  | NOT NULL              | Unix ms                           |
| `wins`          | INTEGER | NOT NULL DEFAULT 0    | Lifetime wins                     |
| `losses`        | INTEGER | NOT NULL DEFAULT 0    | Lifetime losses                   |
| `draws`         | INTEGER | NOT NULL DEFAULT 0    | Lifetime draws                    |
| `avatar_url`    | TEXT    | DEFAULT NULL          | Avatar image path                 |
| `rating`        | INTEGER | NOT NULL DEFAULT 1200 | Current Elo rating                |

Indexes: `idx_users_rating` on `(rating)`

Query patterns:

- `SELECT * FROM users WHERE username = $1` — login
- `SELECT * FROM users WHERE id = $1` — profile
- `SELECT id, username, display_name, ... FROM users ORDER BY rating DESC LIMIT N OFFSET M` — leaderboard
- `SELECT * FROM users WHERE username ILIKE $1 OR display_name ILIKE $1 LIMIT 10` — search

### `user_tokens`

| Column       | Type   | Constraints              | Description            |
| ------------ | ------ | ------------------------ | ---------------------- |
| `token`      | TEXT   | PK                       | Bearer token (UUID v4) |
| `user_id`    | TEXT   | NOT NULL, FK → users(id) | Token owner            |
| `created_at` | BIGINT | NOT NULL                 | Unix ms                |

Indexes:

- `idx_user_tokens_user_id` on `(user_id)` — revoke all tokens for user
- `idx_user_tokens_created_at` on `(created_at)` — cleanup expired

Query patterns:

- `SELECT user_id FROM user_tokens WHERE token = $1` — authenticate
- `DELETE FROM user_tokens WHERE user_id = $1` — revoke all
- `DELETE FROM user_tokens WHERE created_at < $1` — cleanup expired (30d)

### `bans`

| Column      | Type   | Constraints | Description                            |
| ----------- | ------ | ----------- | -------------------------------------- |
| `id`        | TEXT   | PK          | UUID v4                                |
| `player_id` | TEXT   | nullable    | Banned player, or NULL for IP-only ban |
| `ip`        | TEXT   | nullable    | Banned IP, or NULL for player-only ban |
| `banned_at` | BIGINT | NOT NULL    | Unix ms                                |

Indexes: `idx_bans_player_id` on `(player_id)`, `idx_bans_ip` on `(ip)`

### `friend_requests`

| Column         | Type   | Constraints                | Description                                    |
| -------------- | ------ | -------------------------- | ---------------------------------------------- |
| `id`           | TEXT   | PK                         | UUID v4                                        |
| `from_user_id` | TEXT   | NOT NULL, FK → users(id)   | Requester                                      |
| `to_user_id`   | TEXT   | NOT NULL, FK → users(id)   | Target                                         |
| `status`       | TEXT   | NOT NULL DEFAULT 'pending' | `pending`, `accepted`, `declined`, `cancelled` |
| `created_at`   | BIGINT | NOT NULL                   | Unix ms                                        |
| `updated_at`   | BIGINT | NOT NULL                   | Unix ms                                        |

Indexes:

- `idx_friend_requests_to_status` on `(to_user_id, status)` — incoming
- `idx_friend_requests_from_status` on `(from_user_id, status)` — outgoing
- `idx_friend_requests_both_status` on `(from_user_id, to_user_id, status)` — bidirectional check

### `friends`

| Column       | Type   | Constraints              | Description   |
| ------------ | ------ | ------------------------ | ------------- |
| `user_id`    | TEXT   | NOT NULL, FK → users(id) | First friend  |
| `friend_id`  | TEXT   | NOT NULL, FK → users(id) | Second friend |
| `created_at` | BIGINT | NOT NULL                 | Unix ms       |

Composite PK: `(user_id, friend_id)` — each friendship stored twice (bidirectional).

### `completed_games`

| Column               | Type   | Constraints           | Description                                                      |
| -------------------- | ------ | --------------------- | ---------------------------------------------------------------- |
| `id`                 | TEXT   | PK                    | Game UUID                                                        |
| `white_player_id`    | TEXT   | nullable              | White player UUID                                                |
| `black_player_id`    | TEXT   | nullable              | Black player UUID                                                |
| `white_display_name` | TEXT   | NOT NULL DEFAULT ''   | Denormalized for archive                                         |
| `black_display_name` | TEXT   | NOT NULL DEFAULT ''   | Denormalized for archive                                         |
| `winner`             | TEXT   | nullable              | `white`, `black`, or null for draw                               |
| `status`             | TEXT   | NOT NULL              | e.g. `completed`, `aborted`                                      |
| `result`             | TEXT   | NOT NULL              | `1-0`, `0-1`, `1/2-1/2`                                          |
| `reason`             | TEXT   | nullable              | `checkmate`, `resign`, `stalemate`, `draw`, `timeout`, `aborted` |
| `move_history`       | TEXT   | NOT NULL DEFAULT '[]' | JSON array of algebraic moves                                    |
| `board_history`      | TEXT   | NOT NULL DEFAULT '[]' | JSON array of board snapshots                                    |
| `pgn`                | TEXT   | nullable              | Full PGN string                                                  |
| `played_at`          | BIGINT | NOT NULL              | Unix ms                                                          |
| `time_control`       | TEXT   | NOT NULL DEFAULT ''   | e.g. `600000+5000`                                               |

Indexes:

- `idx_completed_games_played_at` on `(played_at)` — archive listing
- `idx_completed_games_white` on `(white_player_id)` — player history
- `idx_completed_games_black` on `(black_player_id)` — player history

### `tournaments`

| Column             | Type    | Constraints                           | Description                                   |
| ------------------ | ------- | ------------------------------------- | --------------------------------------------- |
| `id`               | TEXT    | PK                                    | UUID v4                                       |
| `name`             | TEXT    | NOT NULL                              | Tournament name                               |
| `status`           | TEXT    | NOT NULL DEFAULT 'waiting'            | `waiting`, `active`, `completed`, `cancelled` |
| `created_by`       | TEXT    | NOT NULL, FK → users(id)              | Creator                                       |
| `max_players`      | INTEGER | NOT NULL DEFAULT 8                    | Player cap                                    |
| `is_private`       | BOOLEAN | NOT NULL DEFAULT false                | Hidden from public list                       |
| `join_code`        | TEXT    | nullable                              | 8-char code for private tournaments           |
| `created_at`       | BIGINT  | NOT NULL                              | Unix ms                                       |
| `started_at`       | BIGINT  | nullable                              | Unix ms                                       |
| `completed_at`     | BIGINT  | nullable                              | Unix ms                                       |
| `winner_id`        | TEXT    | nullable, FK → users(id)              | Winner                                        |
| `type`             | TEXT    | NOT NULL DEFAULT 'single_elimination' | Tournament type                               |
| `participant_data` | JSONB   | NOT NULL DEFAULT '[]'                 | Denormalized participant list                 |
| `match_data`       | JSONB   | NOT NULL DEFAULT '[]'                 | Denormalized match list                       |

Index: `idx_tournaments_join_code` on `(join_code)`

### `tournament_participants`

| Column          | Type    | Constraints                    | Description              |
| --------------- | ------- | ------------------------------ | ------------------------ |
| `id`            | TEXT    | PK                             | UUID v4                  |
| `tournament_id` | TEXT    | NOT NULL, FK → tournaments(id) | Parent tournament        |
| `player_id`     | TEXT    | NOT NULL, FK → users(id)       | Participant              |
| `display_name`  | TEXT    | NOT NULL DEFAULT ''            | Denormalized             |
| `seed`          | INTEGER | NOT NULL DEFAULT 0             | Bracket seeding position |
| `created_at`    | BIGINT  | NOT NULL                       | Unix ms                  |

Indexes:

- `idx_tournament_participants_tournament` on `(tournament_id)` — load participants
- `idx_tournament_participants_player` on `(player_id)` — player's tournaments

### `tournament_matches`

| Column            | Type    | Constraints                    | Description                      |
| ----------------- | ------- | ------------------------------ | -------------------------------- |
| `id`              | TEXT    | PK                             | UUID v4                          |
| `tournament_id`   | TEXT    | NOT NULL, FK → tournaments(id) | Parent tournament                |
| `round`           | INTEGER | NOT NULL                       | Round number (1=first)           |
| `position`        | INTEGER | NOT NULL                       | Position within round            |
| `white_player_id` | TEXT    | nullable                       | White player UUID                |
| `black_player_id` | TEXT    | nullable                       | Black player UUID                |
| `game_id`         | TEXT    | nullable                       | Game UUID once match starts      |
| `winner_id`       | TEXT    | nullable                       | Winner UUID                      |
| `status`          | TEXT    | NOT NULL DEFAULT 'pending'     | `pending`, `active`, `completed` |

Index: `idx_tournament_matches_tournament` on `(tournament_id)`

### `chat_conversations`

| Column            | Type   | Constraints                                            | Description                                     |
| ----------------- | ------ | ------------------------------------------------------ | ----------------------------------------------- |
| `id`              | TEXT   | PK                                                     | `lobby`, `priv_<id1>_<id2>`, or UUID for groups |
| `type`            | TEXT   | NOT NULL, CHECK(IN ('lobby','private','group','game')) | Conversation type                               |
| `name`            | TEXT   | nullable                                               | Display name (groups)                           |
| `owner_id`        | TEXT   | nullable, FK → users(id)                               | Group owner                                     |
| `created_at`      | BIGINT | NOT NULL                                               | Unix ms                                         |
| `last_message_at` | BIGINT | NOT NULL DEFAULT 0                                     | Unix ms, used for ordering                      |

### `chat_conversation_members`

| Column            | Type   | Constraints                                                     | Description  |
| ----------------- | ------ | --------------------------------------------------------------- | ------------ |
| `conversation_id` | TEXT   | NOT NULL, FK → chat_conversations(id)                           | Conversation |
| `user_id`         | TEXT   | NOT NULL, FK → users(id)                                        | Member       |
| `role`            | TEXT   | NOT NULL DEFAULT 'member', CHECK(IN ('owner','admin','member')) | Role         |
| `joined_at`       | BIGINT | NOT NULL                                                        | Unix ms      |

Composite PK: `(conversation_id, user_id)`
Index: `idx_conv_members_user` on `(user_id)`

### `chat_messages`

| Column            | Type   | Constraints                           | Description    |
| ----------------- | ------ | ------------------------------------- | -------------- |
| `id`              | TEXT   | PK                                    | UUID v4        |
| `conversation_id` | TEXT   | NOT NULL, FK → chat_conversations(id) | Conversation   |
| `sender_id`       | TEXT   | NOT NULL, FK → users(id)              | Message author |
| `text`            | TEXT   | NOT NULL                              | Content        |
| `created_at`      | BIGINT | NOT NULL                              | Unix ms        |

Index: `idx_chat_messages_conv` on `(conversation_id, created_at)` — load history

---

## Transactions

Use `transaction()` from `db.ts` for multi-step operations:

```typescript
import { transaction } from './db.js';

await transaction(async (client) => {
  await client.query('INSERT INTO ...');
  await client.query('UPDATE ...');
  // auto COMMIT on success, ROLLBACK on throw
});
```

Used in: addFriendRelationship, deleteTournament.

---

## Backup

Backups are created via `pg_dump`:

```bash
pg_dump --dbname="$DATABASE_URL" -Fc -f backups/chess-<timestamp>.dump
```

Configuration:

- Interval: `DB_BACKUP_INTERVAL_MS` (default 6h, set 0 to disable)
- Retention: 7 days (auto-pruned)
- Location: `chess-api/backups/`
- Requires `pg_dump` on PATH

Restore:

```bash
pg_restore --dbname="$DATABASE_URL" -Fc -c backups/chess-<timestamp>.dump
```
