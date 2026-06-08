# Chess API

Production-ready multiplayer chess REST API server with WebSocket real-time updates. Self-contained chess engine — no external chess libraries.

## Documentation

- [API Reference](api.md) — Endpoints, authentication, request/response formats
- [Architecture](architecture.md) — Layering, data flow, design decisions
- [Chess Logic](chess-logic.md) — How the engine works internally (move gen, check/checkmate, special moves)
- [Deployment](deployment.md) — Docker build, docker-compose, environment variables

## Quick Start

```bash
cd chess-api
pnpm install
pnpm run build
pnpm start        # starts on port 3000
```

Access the admin dashboard at [http://localhost:3000/admin](http://localhost:3000/admin)
(default login: `admin` / `admin`).

### With Docker

```bash
docker compose up --build
```

## Stack

- **Runtime:** Node.js 20 + TypeScript (strict mode)
- **HTTP:** Express 4
- **WebSocket:** ws (token-authenticated)
- **Auth:** Bearer tokens (UUID v4)
- **Admin dashboard:** React 19 + Vite + TailwindCSS + lucide-react
- **Storage:** In-memory (ephemeral) + SQLite (registered users)
- **Tests:** Jest + supertest
- **Container:** Multi-stage Docker build on node:20-alpine

## Project Layout

```
chess-api/
  admin-frontend/   React SPA (Vite + TailwindCSS + lucide-react)
    src/            Components (LoginPage, Dashboard, OverviewTab, GamesTab, PlayersTab, AccountsTab)
  src/
    types.ts        Shared interfaces (Piece, Board, Move, GameState, etc.)
    chess.ts        Complete chess engine (~600 lines)
    game.ts         Game orchestration, auth, WebSocket broadcasting
    routes.ts       Express route handlers (player API)
    admin.ts        Admin API route handlers (dashboard, accounts CRUD)
    index.ts        App setup, server start, WebSocket server
  tests/
    chess.test.ts   Unit tests for chess engine
    api.test.ts     Integration tests for full API surface + admin routes
  docs/             This documentation
```
