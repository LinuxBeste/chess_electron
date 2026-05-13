# Chess Electron

> A multiplayer chess desktop app with a full FIDE-compliant engine, REST API, and real-time WebSocket updates — built entirely from scratch in TypeScript.

![Electron](https://img.shields.io/badge/Electron-29-47848F?logo=electron&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/Node-20-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.18-000000?logo=express&logoColor=white)
![WebSocket](https://img.shields.io/badge/ws-8.14-000000?logo=socket.io&logoColor=white)
![Webpack](https://img.shields.io/badge/Webpack-5.90-8DD6F9?logo=webpack&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-29-C21325?logo=jest&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-24-2496ED?logo=docker&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-22c55e)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Electron App                       │
│  ┌─────────────────────────┐   IPC   ┌───────────────┐  │
│  │    Renderer Process     │◄───────►│ Main Process  │  │
│  │  (webpack / vanilla DOM)│         │ (Node + TS)   │  │
│  │                         │         │ window mgmt,  │  │
│  │  views: login, lobby,   │         │ .env loading, │  │
│  │  game, result           │         │ preload bridge│  │
│  └───────────┬─────────────┘         └───────┬───────┘  │
└──────────────┼───────────────────────────────┼──────────┘
               │ HTTP REST + WebSocket         │
  ┌────────────▼───────────────────────────────▼──────────┐
  │                     chess-api                         │
  │  ┌───────────┐  ┌───────────┐  ┌───────────────────┐  │
  │  │  Express  │  │     ws    │  │   Chess Engine    │  │
  │  │  REST API │  │  WebSocket│  │  (pure functions) │  │
  │  │  :3000    │  │  :3000    │  │  ~800 lines, FIDE │  │
  │  └───────────┘  └───────────┘  └───────────────────┘  │
  │                                                       │
  │  Stores: games (Map), players (Map), tokenIndex       │
  │  Persistence: in-memory (resets on restart)           │
  │  Container: Docker (multi-stage, node:20-alpine)      │
  └───────────────────────────────────────────────────────┘
```

---

## Prerequisites

| Tool | Min version | Install |
|------|-------------|---------|
| Node.js | 18.x | https://nodejs.org |
| pnpm | 8.x | `npm install -g pnpm` |
| Docker (optional) | 24.x | https://docs.docker.com/get-docker |

---

## Getting started

### Run the app

```bash
# 1. Clone the repo
git clone https://github.com/your-org/chess-electron.git
cd chess-electron

# 2. Install dependencies
pnpm install

# 3. Start the API server
pnpm --filter chess-api dev

# 4. In another terminal, build and launch the desktop client
pnpm --filter chess-client dev
```

The API listens on `http://localhost:3000`. The client auto-connects.

### Or run both at once

```bash
pnpm dev
```

This runs `pnpm -r dev`, starting the API and building the client concurrently.

### Play the game

1. Open the app — the **login** screen appears.
2. Enter a username and click **Enter** — a player account is created and the token stored locally.
3. The **lobby** shows open games. Click **New Game** to create one. Toggle **Private** to share the game ID directly.
4. Open a second window (`New Window` button) to register a second player and join the game.
5. Make moves by dragging pieces or clicking source then destination. Pawn promotions show a piece-selection dialog.

---

## Environment variables

The client reads `chess-client/.env` at startup (git-ignored).

| Variable | Default | Description |
|----------|---------|-------------|
| `CHESS_SERVER_URL` | `http://localhost:3000` | API base URL the Electron app connects to |

The API accepts these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP/WS server port |
| `NODE_ENV` | — | Set to `test` to skip server startup |

---

## Project structure

```
.
├── chess-api/                      # Backend server
│   ├── src/
│   │   ├── index.ts                # Express + WebSocket server bootstrap
│   │   ├── routes.ts               # Route handlers (thin layer)
│   │   ├── game.ts                 # Game/player state, WS broadcasting
│   │   ├── chess.ts                # FIDE chess engine (pure, ~800 lines)
│   │   └── types.ts                # Shared interfaces
│   ├── tests/
│   │   ├── chess.test.ts           # Chess engine unit tests
│   │   └── api.test.ts             # Integration tests (supertest)
│   ├── docs/
│   │   ├── README.md               # API docs index
│   │   ├── api.md                  # Full API reference with examples
│   │   ├── architecture.md         # Layering & design decisions
│   │   ├── chess-logic.md          # Engine internals (move gen, checkmate)
│   │   ├── deployment.md           # Docker build & deployment
│   │   └── examples.md             # curl examples with Scholar's Mate
│   ├── Dockerfile                  # Multi-stage build (node:20-alpine)
│   ├── docker-compose.yml          # Compose with health check
│   ├── jest.config.ts
│   └── tsconfig.json               # strict: true, ES2020, commonjs
│
├── chess-client/                   # Electron desktop app
│   ├── src/
│   │   ├── main/
│   │   │   ├── main.ts             # Window creation, IPC, .env loading
│   │   │   └── preload.ts          # contextBridge (serverUrl, openNewWindow)
│   │   ├── renderer/
│   │   │   ├── index.ts            # App entry: toast system, WS auto-connect
│   │   │   ├── index.html          # Shell HTML (dark theme, Inter font)
│   │   │   ├── router.ts           # Hash-based SPA router (4 views)
│   │   │   ├── store.ts            # Typed observable state store
│   │   │   ├── api.ts              # Typed REST client (bearer auth)
│   │   │   ├── socket.ts           # WebSocket manager (auto-reconnect)
│   │   │   ├── chess.ts            # Client helpers (board parse, Unicode pieces, el())
│   │   │   └── views/
│   │   │       ├── login.ts        # Username registration form
│   │   │       ├── lobby.ts        # Game list, create/join cards
│   │   │       ├── game.ts         # Board, drag-and-drop, clock, history
│   │   │       └── result.ts       # Outcome overlay (win/lose/draw)
│   │   └── types.ts                # Re-exports from chess-api, UI types
│   ├── tests/
│   │   ├── api.test.ts
│   │   ├── chess.test.ts
│   │   ├── router.test.ts
│   │   ├── socket.test.ts
│   │   └── store.test.ts
│   ├── webpack.main.config.js      # Main process bundle (ts-loader)
│   ├── webpack.renderer.config.js  # Renderer bundle + HtmlWebpackPlugin
│   ├── tsconfig.json               # Base config (noEmit, includes chess-api types)
│   ├── tsconfig.main.json          # Main process overrides
│   ├── tsconfig.renderer.json      # Renderer process overrides
│   ├── electron-builder.json       # Packaging targets (AppImage, dmg, nsis)
│   └── jest.config.js
│
├── package.json                    # Root workspace scripts
├── pnpm-workspace.yaml             # pnpm workspace definition
└── .gitignore
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies (both packages) |
| `pnpm dev` | Start API + build client concurrently |
| `pnpm build` | Compile all packages |
| `pnpm test` | Run all test suites |
| `pnpm typecheck` | Type-check all packages |
| `pnpm --filter chess-api dev` | Start API server with `ts-node` (hot reload) |
| `pnpm --filter chess-client dev` | Build webpack bundles + launch Electron |
| `pnpm --filter chess-client package` | Package platform installer via electron-builder |

---

## API overview

All authenticated endpoints require `Authorization: Bearer <token>`.

### REST endpoints

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| `GET` | `/health` | — | Server status, active games, online players |
| `POST` | `/auth/register` | — | Create player → `{ playerId, token }` |
| `GET` | `/auth/me` | ✓ | Current player identity |
| `POST` | `/games` | ✓ | Create game as white (body: `visibility`) |
| `GET` | `/games` | — | List open public games |
| `GET` | `/games/:id` | — | Full game state |
| `POST` | `/games/:id/join` | ✓ | Join as black |
| `POST` | `/games/:id/move` | ✓ | Submit move (`from`, `to`, `promotion?`) |
| `POST` | `/games/:id/resign` | ✓ | Resign from game |
| `GET` | `/games/:id/moves` | ✓ | Legal moves for current turn |

### WebSocket events

Connect to `ws://host:port/?token=<bearer-token>`.

| Event | Trigger | Payload includes |
|-------|---------|-----------------|
| `move` | Legal move submitted | `board` (serialized), `turn`, `lastMove` |
| `game_started` | Black joins | Full `GameState` |
| `game_over` | Checkmate, stalemate, or resign | `board`, `result`, `reason` |

Full request/response examples with curl are in [`chess-api/docs/examples.md`](./chess-api/docs/examples.md), including a complete Scholar's Mate walkthrough.

---

## Chess engine

The engine in [`chess-api/src/chess.ts`](./chess-api/src/chess.ts) implements every FIDE rule with **zero external dependencies**.

### Core design

- **Pure functions** — every function accepts board state and returns results. No side effects, no mutation of inputs. Testing is straightforward and bugs are obvious.
- **Clone-and-validate** — legal move filtering clones the board for each candidate via `applyMove`, then checks `isInCheck`. Slower than integrated filtering, but provably correct.
- **Outward-scanning attack detection** — `isSquareAttackedBy` scans outward from the target square using direction vectors, stopping at the first blocker. Much faster than iterating all opponent pieces.

### Implemented rules

| Rule | Implementation |
|------|---------------|
| Pawn double push | `generatePawnMoves` — sets `enPassantTarget` on 2-square advance |
| En passant | Checks destination against stored `enPassantTarget`, removes captured pawn |
| Castling | `generateKingMoves` checks empty squares + rook presence; `getLegalMoves` verifies king doesn't pass through check |
| Promotion | 4 candidate moves per promotion rank (queen/rook/bishop/knight) |
| Check / checkmate / stalemate | `getGameStatus` — legal moves exist? king in check? |
| Algebraic notation | `moveToAlgebraic` — handles disambiguation, castling `O-O`, captures, promotion `e8=Q` |

Full engine documentation: [`chess-api/docs/chess-logic.md`](./chess-api/docs/chess-logic.md)

---

## Docker

Build and run the API standalone:

```bash
docker compose -f chess-api/docker-compose.yml up --build
```

The Dockerfile uses a multi-stage build (builder → runner) on `node:20-alpine`. The compose config includes auto-restart and a health check against `/health`.

---

## Distribution

```bash
pnpm --filter chess-client package
```

Output in `chess-client/release/`:

| Platform | Format |
|----------|--------|
| Linux | `.AppImage`, `.deb` |
| macOS | `.dmg` |
| Windows | `.exe` (NSIS installer) |

The API server must be deployed separately — either via Docker or directly on a VM. The client connects to whatever `CHESS_SERVER_URL` points to.

---

## TypeScript

Three tsconfigs in `chess-client/`:

| Config | Target | Entry | Purpose |
|--------|--------|-------|---------|
| `tsconfig.json` | ES2020 + DOM | — | Base config (noEmit), shared settings |
| `tsconfig.main.json` | ES2020 | `src/main/` | Main + preload (Electron Node process) |
| `tsconfig.renderer.json` | ES2020 + DOM | `src/renderer/` | Renderer (browser context) |

The renderer tsconfig includes `chess-api/src/types.ts` so client types (`Board`, `Piece`, `Move`, etc.) are re-exported directly from the server's canonical definitions.

Full type-check:

```bash
pnpm typecheck
```

---

## Further documentation

- [`chess-api/docs/api.md`](./chess-api/docs/api.md) — API reference with request/response schemas
- [`chess-api/docs/architecture.md`](./chess-api/docs/architecture.md) — Layering, data flow, design decisions
- [`chess-api/docs/chess-logic.md`](./chess-api/docs/chess-logic.md) — Engine internals: move generation, checkmate detection
- [`chess-api/docs/deployment.md`](./chess-api/docs/deployment.md) — Docker build, environment variables, production config
- [`chess-api/docs/examples.md`](./chess-api/docs/examples.md) — curl examples with a complete Scholar's Mate game

---

## License

MIT
