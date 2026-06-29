# Contributing

## Prerequisites

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- PostgreSQL 17+ (for tests)
- Docker (optional, for containerized deployment)

## Setup

```bash
git clone <repo>
cd chess-electron
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
pnpm --filter chess-api dev    # API server on :25565
pnpm --filter chess-client dev:web  # webpack dev server on :3000
```

## Project Structure

```
chess-api/          Backend (Express + WebSocket + Postgres)
chess-client/       Electron desktop app
docs/               Shared documentation
```

## Code Style

- TypeScript strict mode everywhere
- 2-space indent, single quotes, trailing commas, 120 print width
- No semicolons (Prettier handles this)
- Prefer `Map` over objects for dynamic dictionaries
- Pure functions in the chess engine (no I/O, no side effects)

Run the formatter and linter before committing:

```bash
pnpm format
pnpm lint
pnpm typecheck
```

## Testing

```bash
pnpm test                     # All tests (API + client)
pnpm --filter chess-api test  # API tests only (828 tests)
pnpm --filter chess-client test  # Client tests only (232 tests)
```

The test database is configured via `DATABASE_URL` (defaults to `postgresql://chess:chess@localhost:5432/chess_test`). Tests create and tear down tables automatically.

## Pull Requests

1. Make sure all tests pass (`pnpm test`)
2. Run `pnpm format && pnpm lint && pnpm typecheck` — CI will reject if any fail
3. Keep changes focused — one feature/fix per PR
4. Update docs if adding or changing environment variables

## Adding Environment Variables

1. Add the `process.env` read with a sensible default in the relevant source file
2. Add the variable to `chess-api/.env.example` with a comment
3. Add it to `docs/environment.md` with default, type, and description
4. If it's user-facing, add a note in the root `README.md`
