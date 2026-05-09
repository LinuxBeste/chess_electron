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
npm install
npm run build
npm start        # starts on port 3000
```

### With Docker

```bash
docker compose up --build
```

## Stack

- **Runtime:** Node.js 20 + TypeScript (strict mode)
- **HTTP:** Express 4
- **WebSocket:** ws (token-authenticated)
- **Auth:** Bearer tokens (UUID v4)
- **Storage:** In-memory (ephemeral)
- **Tests:** Jest + supertest
- **Container:** Multi-stage Docker build on node:20-alpine

## Project Layout

```
chess-api/
  src/
    types.ts     Shared interfaces (Piece, Board, Move, GameState, etc.)
    chess.ts     Complete chess engine (~600 lines)
    game.ts      Game orchestration, auth, WebSocket broadcasting
    routes.ts    Express route handlers
    index.ts     App setup, server start, WebSocket server
  tests/
    chess.test.ts    Unit tests for chess engine
    api.test.ts      Integration tests for full API surface
  docs/              This documentation
```
