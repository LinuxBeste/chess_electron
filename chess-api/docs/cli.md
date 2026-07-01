# CLI Reference (`chess-admin`)

The `chess-admin` CLI provides administrative access to the chess app database and server. Every command outputs human-readable formatted text by default, with `--json` available for programmatic use.

## Setup

```bash
cd chess-api
pnpm link --global    # install as global `chess-admin` command
chess-admin --help
```

Or without linking:

```bash
cd chess-api
pnpm cli --help
```

## Global Options

| Flag            | Description               |
| --------------- | ------------------------- |
| `-V, --version` | Show version (1.0.0)      |
| `-h, --help`    | Show help for any command |

## Exit Codes

| Code | Meaning                                              |
| ---- | ---------------------------------------------------- |
| `0`  | Success                                              |
| `1`  | Error (not found, connection failure, invalid input) |

## Environment Variables

The CLI reads these from the environment (or `.env` if loaded by your shell):

| Variable       | Default                                         | For Commands    |
| -------------- | ----------------------------------------------- | --------------- |
| `DATABASE_URL` | `postgresql://chess:chess@localhost:5432/chess` | all DB commands |
| `PORT`         | `25565`                                         | `health`        |

---

## `create user`

Create a new user account in the database.

```
chess-admin create user --username <username> [options]
```

| Option                      | Required | Description                                                                                        |
| --------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `-u, --username <name>`     | yes      | 2-30 chars, alphanumeric + `-` `_`                                                                 |
| `-p, --password <pwd>`      | no       | Min 8 chars, stored as SHA-256 hash. If omitted, the user cannot login (admin-created placeholder) |
| `-d, --display-name <name>` | no       | Display name (defaults to username)                                                                |
| `-r, --rating <number>`     | no       | Initial Elo rating (default: 1200)                                                                 |

**Example:**

```bash
chess-admin create user --username alice --password s3cret
chess-admin create user --username bob --display-name "Bobby" --rating 1500
```

**Output:**

```
User created:
  ID:       a1b2c3d4-e5f6-7890-abcd-ef1234567890
  Username: alice
  Name:     Alice
  Rating:   1200
  Has pwd:  true
```

**Notes:**

- The ID is a random UUID v4
- Passwords are SHA-256 hashed (matching the app's login logic)
- Rating is floored at 0

---

## `delete user`

Delete a user and all associated data in a single DB transaction. Removes: tokens, friends, friend requests, tournament entries, tournament matches, chat memberships, chat messages, and the user record.

```
chess-admin delete user --id <userId>
```

| Option              | Required | Description       |
| ------------------- | -------- | ----------------- |
| `-i, --id <userId>` | yes      | User ID to delete |

**Example:**

```bash
chess-admin delete user --id a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Success output:**

```
User deleted: a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Failure output (not found):**

```
User not found: a1b2c3d4-...
[exit code 1]
```

---

## `delete game`

Delete a completed game record from the archive.

```
chess-admin delete game --id <gameId>
```

| Option              | Required | Description |
| ------------------- | -------- | ----------- |
| `-i, --id <gameId>` | yes      | Game ID     |

**Example:**

```bash
chess-admin delete game --id abc123
```

---

## `list users`

List all registered users sorted by a field (default: rating descending).

```
chess-admin list users [options]
```

| Option               | Description                                                  |
| -------------------- | ------------------------------------------------------------ |
| `--json`             | Raw JSON output                                              |
| `-l, --limit <N>`    | Max results (default: 100, max: 1000)                        |
| `-s, --sort <field>` | Sort field: `rating`, `username`, `wins` (default: `rating`) |

**Example:**

```bash
chess-admin list users --limit 5 --sort wins
```

**Output:**

```
Users (5):
+----------+--------------+--------+------+--------+-------+
| Username | Display Name | Rating | Wins | Losses | Draws |
+----------+--------------+--------+------+--------+-------+
| alice    | Alice        | 1500   | 42   | 3      | 12    |
| bob      | Bobby        | 1350   | 30   | 15     | 5     |
| ...      | ...          | ...    | ...  | ...    | ...   |
+----------+--------------+--------+------+--------+-------+
```

---

## `list games`

List completed games from the archive (newest first).

```
chess-admin list games [options]
```

| Option              | Description                         |
| ------------------- | ----------------------------------- |
| `--json`            | Raw JSON output                     |
| `-l, --limit <N>`   | Max results (default: 20, max: 200) |
| `-p, --player <id>` | Filter by player ID                 |

**Example:**

```bash
chess-admin list games --player a1b2c3d4-...
```

**Output:**

```
+----------+-------+-------+--------+------------+
| ID       | White | Black | Result | Date       |
+----------+-------+-------+--------+------------+
| abc123…  | Alice | Bob   | white  | 2024-01-15 |
| def456…  | Bob   | Alice | black  | 2024-01-14 |
+----------+-------+-------+--------+------------+
```

---

## `list bans`

List all active player and IP bans (newest first).

```
chess-admin list bans [options]
```

| Option   | Description     |
| -------- | --------------- |
| `--json` | Raw JSON output |

**Example:**

```bash
chess-admin list bans
```

**Output:**

```
+--------+--------------------------------------+----------------------------+
| Type   | Target                               | Banned At                  |
+--------+--------------------------------------+----------------------------+
| Player | a1b2c3d4-e5f6-7890-abcd-ef1234567890 | 2024-01-15T12:00:00.000Z  |
| IP     | 192.168.1.1                          | 2024-01-14T10:30:00.000Z  |
+--------+--------------------------------------+----------------------------+
```

---

## `list tournaments`

List tournaments with player counts and status.

```
chess-admin list tournaments [options]
```

| Option                  | Description                              |
| ----------------------- | ---------------------------------------- |
| `--json`                | Raw JSON output                          |
| `-s, --status <status>` | Filter: `waiting`, `active`, `completed` |

**Example:**

```bash
chess-admin list tournaments --status active
```

**Output:**

```
+------------------+--------+---------+------------+
| Name             | Status | Players | Created    |
+------------------+--------+---------+------------+
| Spring Open      | active | 8/8     | 2024-01-10 |
| Blitz Cup        | active | 5/16    | 2024-01-12 |
+------------------+--------+---------+------------+
```

---

## `show user`

Show detailed information for a single user.

```
chess-admin show user --id <userId> [options]
```

| Option              | Required | Description     |
| ------------------- | -------- | --------------- |
| `-i, --id <userId>` | yes      | User ID         |
| `--json`            | no       | Raw JSON output |

**Example:**

```bash
chess-admin show user --id a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Output:**

```
User: alice
  ID:      a1b2c3d4-e5f6-7890-abcd-ef1234567890
  Name:    Alice
  Rating:  1500
  Record:  42W / 3L / 12D
  Avatar:  https://example.com/avatar.png
  Created: 2024-01-01T12:00:00.000Z
```

---

## `show game`

Show full game details including a PGN-formatted move list.

```
chess-admin show game --id <gameId> [options]
```

| Option              | Required | Description     |
| ------------------- | -------- | --------------- |
| `-i, --id <gameId>` | yes      | Game ID         |
| `--json`            | no       | Raw JSON output |

**Example:**

```bash
chess-admin show game --id abc123
```

**Output:**

```
Game: abc123
  White:  Alice (a1b2c3d4-...)
  Black:  Bob (e5f6a7b8-...)
  Result: white (winner: white)
  Moves:  42 ply
  Time:   600+5
  Date:   2024-01-15T12:00:00.000Z
  PGN-like:
    1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6
    5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O
    ...
```

---

## `show tournament`

Show tournament details with participants and full bracket table.

```
chess-admin show tournament --id <tournamentId> [options]
```

| Option                    | Required | Description     |
| ------------------------- | -------- | --------------- |
| `-i, --id <tournamentId>` | yes      | Tournament ID   |
| `--json`                  | no       | Raw JSON output |

**Example:**

```bash
chess-admin show tournament --id abc123
```

**Output:**

```
Tournament: Spring Open
  Status:  active
  Type:    single_elimination
  Field:   8/8 players
  Winner:  a1b2c3d4-...
  Created: 2024-01-10T12:00:00.000Z

Bracket:
+-----+-----+----------+----------+----------+--------+
| Rnd | Pos | White    | Black    | Winner   | Status |
+-----+-----+----------+----------+----------+--------+
| 1   | 1   | a1b2c3d | e5f6a7b8 | a1b2c3d  | played |
| 1   | 2   | ...      | ...      | ...      | played |
| 2   | 1   | a1b2c3d | ...      | —        | pending|
+-----+-----+----------+----------+----------+--------+
```

---

## `search`

Search users by username or display name. Uses PostgreSQL ILIKE for case-insensitive partial matching. Special characters `%` and `_` are escaped.

```
chess-admin search <query> [options]
```

| Argument  | Description                             |
| --------- | --------------------------------------- |
| `<query>` | Search term (partial matches supported) |

| Option            | Description                         |
| ----------------- | ----------------------------------- |
| `--json`          | Raw JSON output                     |
| `-l, --limit <N>` | Max results (default: 20, max: 100) |

**Example:**

```bash
chess-admin search ali
chess-admin search "bobby" --json
```

**Output:**

```
Found 2 user(s):
+----------+--------------+--------+-----------+
| Username | Display Name | Rating | W/L/D     |
+----------+--------------+--------+-----------+
| alice    | Alice        | 1500   | 42/3/12   |
| alicia   | Alicia       | 1300   | 20/10/5   |
+----------+--------------+--------+-----------+
```

---

## `ban`

Ban a player by user ID. Prevents the player from logging in or creating games.

```
chess-admin ban --id <playerId> [options]
```

| Option                  | Required | Description                                      |
| ----------------------- | -------- | ------------------------------------------------ |
| `-i, --id <playerId>`   | yes      | Player ID to ban                                 |
| `-r, --reason <reason>` | no       | Ban reason (logged to console, not stored in DB) |

**Example:**

```bash
chess-admin ban --id a1b2c3d4-... --reason "Cheating / multiple accounts"
```

**Output:**

```
Player banned: a1b2c3d4-... (Cheating / multiple accounts)
```

---

## `ban-ip`

Ban an IP address (IPv4 or IPv6). Blocks all connections from that address regardless of user ID.

```
chess-admin ban-ip --address <ip> [options]
```

| Option                  | Required | Description                                      |
| ----------------------- | -------- | ------------------------------------------------ |
| `-a, --address <ip>`    | yes      | IP address (e.g. `192.168.1.1` or `2001:db8::1`) |
| `-r, --reason <reason>` | no       | Ban reason                                       |

**Example:**

```bash
chess-admin ban-ip --address 192.168.1.1
chess-admin ban-ip --address 2001:db8::1 --reason "Abuse"
```

---

## `unban`

Remove a player ban by user ID.

```
chess-admin unban --id <playerId>
```

| Option                | Required | Description        |
| --------------------- | -------- | ------------------ |
| `-i, --id <playerId>` | yes      | Player ID to unban |

**Example:**

```bash
chess-admin unban --id a1b2c3d4-...
```

**Success output:**

```
Player unbanned: a1b2c3d4-...
```

**No-ban output:**

```
No ban found for a1b2c3d4-...
```

---

## `set-rating`

Set a user's Elo rating to a specific value. This overrides the rating directly — the user only gains/loses rating from future games normally.

```
chess-admin set-rating --id <userId> --rating <number>
```

| Option              | Required | Description           |
| ------------------- | -------- | --------------------- |
| `-i, --id <userId>` | yes      | User ID               |
| `-r, --rating <N>`  | yes      | New rating value (0+) |

**Example:**

```bash
chess-admin set-rating --id a1b2c3d4-... --rating 1800
```

**Output:**

```
Rating updated for a1b2c3d4-... -> 1800
```

---

## `db backup`

Create a PostgreSQL custom-format (`.dump`) backup via `pg_dump -Fc`. Output is timestamped.

```
chess-admin db backup [options]
```

| Option             | Description                              |
| ------------------ | ---------------------------------------- |
| `-d, --dir <path>` | Output directory (default: `./backups/`) |

**Example:**

```bash
chess-admin db backup
chess-admin db backup --dir /tmp
```

**Output:**

```
Backup created: /home/user/chess-api/backups/chess-2024-01-15T12-00-00.dump
```

**Requires:** `pg_dump` on PATH, `DATABASE_URL` env var.

---

## `db restore`

Restore a database from a custom-format dump via `pg_restore`.

```
chess-admin db restore <file> [options]
```

| Argument | Description                   |
| -------- | ----------------------------- |
| `<file>` | Path to a `.dump` backup file |

| Option        | Description                                     |
| ------------- | ----------------------------------------------- |
| `-c, --clean` | Drop existing database objects before restoring |

**Example:**

```bash
chess-admin db restore backups/chess-2024-01-01.dump
chess-admin db restore /tmp/backup.dump --clean
```

**Output:**

```
Restored from: /home/user/chess-api/backups/chess-2024-01-01.dump
```

**Requires:** `pg_restore` on PATH, `DATABASE_URL` env var.

**Warning:** Restoring overwrites data. Use `--clean` to drop existing tables first (recommended for full restores).

---

## `db migrate`

Run all pending database migrations. Idempotent — safe to run multiple times. Each migration runs only if not yet applied.

Tracked migrations (1-6):

| Version | Name             | Description                                                         |
| ------- | ---------------- | ------------------------------------------------------------------- |
| 1       | `schema`         | Core tables: users, tokens, bans, friends, games, tournaments, chat |
| 2       | `jsonb-to-text`  | Convert JSONB columns to TEXT for broader compatibility             |
| 3       | `indexes`        | Performance indexes on bans, users, tournaments, tokens             |
| 4       | `chat-schema`    | Chat conversations, members, messages tables                        |
| 5       | `group-owner`    | Group chat ownership and member roles                               |
| 6       | `unread-read-at` | Unread message tracking (`last_read_at` column)                     |

**Example:**

```bash
chess-admin db migrate
```

**Output:**

```
  1 (schema)
  2 (jsonb-to-text)
  3 (indexes)
  4 (chat-schema)
  5 (group-owner)
  6 (unread-read-at)
  All 6 migrations applied
```

---

## `health`

Check server health via the `/health` HTTP endpoint. Returns status, uptime, active connections, DB/Redis state, and memory usage.

```
chess-admin health [options]
```

| Option   | Description     |
| -------- | --------------- |
| `--json` | Raw JSON output |

**Example:**

```bash
chess-admin health
```

**Output:**

```
Status: ok
  Uptime:  3600s
  Games:   5 active
  Online:  12 players
  WS:      8 connections
  DB:      connected (2ms)
  Redis:   enabled
  Memory:  128MB RSS / 64MB heap
```

**Requires:** Chess API server running on the configured `PORT` (default 25565).

---

## `stats`

Show aggregated server statistics from the database.

```
chess-admin stats [options]
```

| Option   | Description     |
| -------- | --------------- |
| `--json` | Raw JSON output |

**Example:**

```bash
chess-admin stats
```

**Output:**

```
Server statistics:
  Users:       150
  Games:       1240 total, 980 finished
  Tournaments: 3 active

Top 5 players:
+---+----------+--------+-----------+
| # | Username | Rating | W/L/D     |
+---+----------+--------+-----------+
| 1 | gm_magnus| 2850   | 42/3/12   |
| 2 | hikaru   | 2760   | 38/5/8    |
| 3 | alice    | 1500   | 20/10/5   |
| 4 | bob      | 1350   | 15/12/3   |
| 5 | carl     | 1200   | 0/0/0     |
+---+----------+--------+-----------+
```

---

## `config`

Show the current environment configuration. Secrets (env vars whose name contains `SECRET` or `PASSWORD`) are masked as `***`.

```
chess-admin config [options]
```

| Option   | Description     |
| -------- | --------------- |
| `--json` | Raw JSON output |

**Example:**

```bash
chess-admin config
```

**Output:**

```
Configuration (from environment):
  DATABASE_URL                    = postgresql://chess:chess@localhost:5432/chess
  REDIS_URL                       = (not set)
  PORT                            = 25565
  HOST                            = 0.0.0.0
  CORS_ORIGIN                     = *
  NODE_ENV                        = development
  LOG_LEVEL                       = info
  LOG_FORMAT                      = (not set)
  SENTRY_DSN                      = ***
  CAPTCHA_SECRET_KEY              = ***
  DISABLE_METRICS                 = (not set)
  DISABLE_FILE_PERSISTENCE        = (not set)
  MAX_GAMES_PER_PLAYER            = 20
  ADMIN_PASSWORD                  = ***
  STOCKFISH_THREADS               = (not set)
  STOCKFISH_HASH_SIZE             = (not set)
  CHAT_MAX_LENGTH                 = (not set)
  MAX_BODY_SIZE                   = 10kb
```
