# Development Guide

## Prerequisites

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- PostgreSQL 17+ running on `localhost:5432`
- Stockfish (optional, for bot support)
  - On Debian/Ubuntu: `apt install stockfish`
  - On Alpine: `apk add stockfish`
  - On macOS: `brew install stockfish`
  - npm package `stockfish` included as dependency (fallback)

## Initial setup

```bash
git clone <repo>
cd chess-electron
pnpm install
pnpm --filter chess-api build
pnpm test
```

### Setting up the database

```bash
# Create the database and user
sudo -u postgres createuser chess --pwprompt
sudo -u postgres createdb -O chess chess
sudo -u postgres createdb -O chess chess_test
```

Then create `chess-api/.env` (copy from `.env.example`):

```
DATABASE_URL=postgresql://chess:chess@localhost:5432/chess
```

The server auto-creates tables via migrations on startup.

## Project structure

```
chess-api/src/
  index.ts        Express app bootstrap, WS server, startup sequence
  routes.ts       Player API route handlers (auth, games, tournaments)
  admin.ts        Admin API routes
  game.ts         Game orchestration, WS broadcasting, per-game mutex
  chess.ts        FIDE chess engine (pure functions, ~715 lines)
  engine.ts       Stockfish engine manager (UCI child process)
  state.ts        In-memory state maps, Redis/file write-through
  db.ts           PostgreSQL pool, migrations, queries
  redis.ts        Redis client for cross-instance state
  chat.ts         Lobby/private/group chat logic
  friends.ts      Friend request/management routes
  player.ts       Player state, token management, login lockout
  elo.ts          Elo rating calculation
  bans.ts         Player + IP ban system
  validation.ts   Zod schemas for request bodies
  types.ts        Shared TypeScript interfaces
  logger.ts       Structured file + console logger with rotation

chess-api/admin-frontend/src/
  App.tsx         HashRouter with auth + tab navigation
  components/     Dashboard tabs (stats, games, players, etc.)

chess-client/src/
  main/main.ts       Electron main process (window, IPC)
  main/preload.ts    contextBridge (serverUrl, clipboard)
  renderer/          React app (pages, components, store)
```

## Running in development

### Full stack

```bash
pnpm dev
```

Starts API (`tsx src/index.ts` on :25565) and webpack dev server (:3000) concurrently.

### API only

```bash
pnpm --filter chess-api dev
```

### Client only

```bash
pnpm --filter chess-client dev:web
# Or for Electron: pnpm --filter chess-client dev
```

## Hot reload

- **API**: Uses `tsx` (TypeScript execute) — no build step. Edit `src/*.ts` and the server auto-restarts.
- **Client (web)**: webpack-dev-server with HMR. Edits reflect instantly without full reload.
- **Client (Electron)**: webpack rebuilds on save. Use `Ctrl+R` or `Cmd+R` to reload the renderer.

## Testing

```bash
pnpm test                          # All 1069 tests
pnpm --filter chess-api test       # 837 API tests
pnpm --filter chess-client test    # 232 client tests
pnpm --filter chess-api test:coverage  # With coverage report
```

The test suite uses a separate DB specified by `DATABASE_URL` (default `postgresql://chess:chess@localhost:5432/chess_test`). Tables are created and torn down automatically.

Run a single test file:

```bash
pnpm --filter chess-api exec jest --forceExit --runInBand tests/chess.test.ts
```

Run tests matching a pattern:

```bash
pnpm --filter chess-api exec jest --forceExit --runInBand -t "promotion"
```

## Debugging

### Server logs

Log level: `LOG_LEVEL=debug` for verbose output (default: `info`).

```
LOG_LEVEL=debug pnpm --filter chess-api dev
```

### WebSocket traffic

Enable morgan for HTTP: `ENABLE_MORGAN=true` (default).
For WS debugging, set `LOG_LEVEL=debug` — all WS events are logged.

### Node.js inspector

```bash
node --inspect node_modules/.bin/tsx src/index.ts
# Chrome DevTools → chrome://inspect
```

### Electron DevTools

Set `DEVTOOLS=true` in `chess-client/.env` to auto-open DevTools on launch.

### Test debug

```bash
NODE_OPTIONS='--experimental-vm-modules --inspect' node_modules/.bin/jest --forceExit --runInBand
```

## Common development tasks

### Adding a new API endpoint

1. Add the route handler in `routes.ts` or `admin.ts`
2. Add Zod validation schema in `validation.ts`
3. Add DB query in `db.ts` if needed
4. Add tests in the appropriate test file
5. Add to the API reference in `docs/api.md`

### Adding a new game state mutation

1. Implement the function in `game.ts`
2. Wrap it with `withGameLock(gameId, async () => { ... })` to serialize concurrent access
3. Add the WS handler in `index.ts` if it's a WS operation
4. Add a REST route in `routes.ts` if it's an HTTP operation

### Adding a new environment variable

1. Read it with `process.env.VAR_NAME ?? 'default'` in the relevant source file
2. Add to `.env.example` with a comment describing the variable
3. Add to `docs/environment.md` with default, type, and description
4. If user-facing, add to the README env var table

### Adding a new DB migration

```typescript
// in db.ts, add to the MIGRATIONS array:
{
  version: 6,
  sql: `
    ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL;
    CREATE INDEX IF NOT EXISTS idx_users_bio ON users(bio);
  `,
},
```

Migrations are idempotent (use `IF NOT EXISTS` / `IF EXISTS`).

## Code quality

```bash
pnpm format              # Prettier (2-space, single quotes, trailing commas, 120 width)
pnpm format:check        # CI check
pnpm lint                # ESLint (flat config, @eslint/js + typescript-eslint + prettier)
pnpm typecheck           # tsc --noEmit on all packages
pnpm lint:fix            # Auto-fix where possible
```

CI will reject PRs that fail any of these checks.

## Docker development

```bash
cd chess-api
docker compose up --build -d
docker compose logs -f
```

The Docker Compose stack:

- `chess-api` — HTTP server on :25565 (expose only, no published port)
- `cloudflared` — Cloudflare Tunnel for public HTTPS

For local testing without Cloudflare:

```bash
docker compose run --rm -p 25565:25565 chess-api
```

## Release

```bash
pnpm --filter chess-client package
```

Output in `chess-client/release/`:

- Linux: `.AppImage`, `.deb`
- macOS: `.dmg`
- Windows: `.exe` (NSIS)

The API server is deployed separately via Docker.

## Standard queries (reference)

### Health check

```
GET /health
```

Returns `{ status: "ok", activeGames: N, onlinePlayers: N, uptime: N }`.

### Create a game (REST)

```bash
curl -X POST http://localhost:25565/games \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"timeControl":{"initial":600000,"increment":5000}}'
```

### Join a game (REST)

```bash
curl -X POST http://localhost:25565/games/<gameId>/join \
  -H "Authorization: Bearer <token>"
```

### Make a move (REST)

```bash
curl -X POST http://localhost:25565/games/<gameId>/move \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"from":"e2","to":"e4"}'
```

For pawn promotion, include `"promotion":"queen"` (or `rook`, `bishop`, `knight`).
