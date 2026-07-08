# Contributing

## Prerequisites

- Node.js 22+ (see `.nvmrc` — `nvm use` to switch automatically)
- pnpm 9+ (`npm install -g pnpm`)
- PostgreSQL 17+ (for tests)
- Docker (optional, for containerized deployment)

## Setup

```bash
git clone <repo>
cd chess-electron
nvm use                  # switch to project Node version (see .nvmrc)
pnpm install
pnpm --filter chess-api build
pnpm test
```

## Development

Start the API and client in dev mode:

```bash
pnpm dev
```

Or separately:

```bash
pnpm --filter chess-api dev            # API server on :25565
pnpm --filter chess-client dev:web     # webpack dev server on :3000
```

Or use the `start.sh` orchestrator script:

```bash
cd chess-api
./start.sh --native                   # pnpm dev on :25565
./start.sh --native --redis           # native + Redis
./start.sh                            # Docker mode
```

The webpack dev server proxies API calls to `:25565` and WebSocket connections to `/chess-ws`.

## Project Structure

```
chess-api/           Backend (Express + WebSocket + Postgres + Redis)
  src/               TypeScript source
    index.ts         Express app + WebSocket server bootstrap
    routes.ts        Player API route handlers
    admin.ts         Admin API route handlers
    game.ts          Game orchestration, auth, WS broadcasting, per-game mutex
    chess.ts         Pure chess engine (FIDE rules, ~715 lines)
    engine.ts        Stockfish engine manager (child process spawn + UCI)
    state.ts         In-memory state maps + Redis/file write-through
    db.ts            PostgreSQL helpers (pool, migrations, queries)
    redis.ts         Redis client for cross-instance state + pub/sub
    chat.ts          Chat logic (lobby, private, group)
    friends.ts       Friend request/management
    player.ts        Player state, token management, login lockout
    elo.ts           Elo rating calculation
    bans.ts          Ban system (player + IP)
    validation.ts    Zod schemas
    types.ts         Shared interfaces
    logger.ts        File + console logger with rotation
  admin-frontend/    React admin dashboard (Vite + TailwindCSS + lucide-react)
  tests/             Jest test suites
  docs/              API documentation
chess-client/        Electron desktop app (React + Webpack)
  src/
    main/            Electron main process (window, IPC, .env)
    renderer/        React app (pages, components, store, socket, api)
  tests/             Jest test suites (232 tests)
  docs/              Client documentation
website/             Public marketing site (React + Vite + Tailwind v4)
docs/                Shared documentation (environment variables)
```

## Code Style

- TypeScript strict mode everywhere
- `noUnusedLocals` and `noUnusedParameters` enforced across all packages
- 2-space indent, single quotes, trailing commas, 120 print width
- No semicolons (Prettier handles this)
- Prefer `Map` over objects for dynamic dictionaries
- Pure functions in the chess engine (no I/O, no side effects)

Run before committing:

```bash
pnpm format
pnpm lint:typecheck      # lint + tsc --noEmit on all packages
```

or

```bash
pnpm format
pnpm lint
pnpm typecheck
```

## Testing

```bash
pnpm test                          # All tests (837 API + 232 client = 1069)
pnpm --filter chess-api test       # API tests only
pnpm --filter chess-client test    # Client tests only
```

### Test suites (chess-api)

| Test file                | Count | What it covers                                   |
| ------------------------ | ----- | ------------------------------------------------ |
| `api.test.ts`            | 186   | Integration tests via supertest                  |
| `chess.test.ts`          | 191   | Chess engine unit tests (pure functions, no I/O) |
| `game.test.ts`           | 126   | Game logic state transitions, validation         |
| `validation.test.ts`     | 41    | Zod schemas                                      |
| `db.test.ts`             | 39    | Database helpers                                 |
| `state.test.ts`          | 37    | State management, file persistence               |
| `chat.test.ts`           | 38    | Chat logic                                       |
| `player.test.ts`         | 32    | Player management, tokens                        |
| `engine.test.ts`         | 28    | Stockfish engine                                 |
| `redis.test.ts`          | 23    | Redis integration                                |
| `friends.test.ts`        | 21    | Friend system                                    |
| `ws.test.ts`             | 20    | WebSocket end-to-end                             |
| `bans.test.ts`           | 17    | Ban system                                       |
| `redis-disabled.test.ts` | 17    | Redis fallback                                   |
| `elo.test.ts`            | 11    | Elo rating                                       |
| `logger.test.ts`         | 10    | Logger                                           |

The test database is configured via `DATABASE_URL` (defaults to `postgresql://chess:chess@localhost:5432/chess_test`). Tests create and tear down tables automatically via `setupAfterEnv.ts`.

## Pull Requests

1. Make sure all tests pass (`pnpm test`)
2. Run `pnpm lint:typecheck` — CI will reject if any fail
3. Update `.env.example` and `docs/environment.md` if adding or changing env vars
4. Keep changes focused — one feature/fix per PR
5. If adding a new state-mutating game function, wrap it with `withGameLock` in `game.ts`

## Adding Environment Variables

1. Add the `process.env` read with a sensible default in the relevant source file
2. Add the variable to the relevant `.env.example` file with a comment
3. Add it to `docs/environment.md` with default, type, and description
4. If it's user-facing, add a note in the root `README.md`

## Adding Tests

- **Chess engine**: add to `tests/chess.test.ts` using `boardFromFenLike` helper and existing test patterns
- **Game logic**: add to `tests/game.test.ts` using the register/create/join/move pattern
- **API integration**: add to `tests/api.test.ts` using supertest
- **WebSocket**: add to `tests/ws.test.ts` using the WS test helpers

## Race Conditions

Game-state-mutating functions must be serialized per game. Use the `withGameLock(gameId, async () => { ... })` wrapper from `game.ts`. This ensures that concurrent requests for the same game execute sequentially. Currently wrapped functions:

- `makeMove`
- `resignGame`
- `joinGame`
- `abortGame`
- `acceptDraw`
- `declineDraw`
- `acceptRematch`
- `offerRematch`
- `offerDrawSafe`

If you add a new function that reads + writes game state, wrap it with `withGameLock`.
