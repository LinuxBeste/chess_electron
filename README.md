# Chess Electron

> A multiplayer chess desktop app with a full FIDE-compliant engine, REST API, and real-time WebSocket updates — built entirely from scratch in TypeScript.

![Electron](https://img.shields.io/badge/Electron-29-47848F?logo=electron&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/Node-20-339933?logo=node.js&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-9-F69220?logo=pnpm&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.18-000000?logo=express&logoColor=white)
![WebSocket](https://img.shields.io/badge/ws-8.14-000000?logo=socket.io&logoColor=white)
![Webpack](https://img.shields.io/badge/Webpack-5.90-8DD6F9?logo=webpack&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-29-C21325?logo=jest&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-24-2496ED?logo=docker&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-22c55e)

---

## Architecture

```
+---------------------------------------+
|           Electron App                |
|  +-----------------+   IPC   +------+ |
|  | Renderer Process |<------>| Main | |
|  | (React 18)       |        | Proc | |
|  |                  |        |      | |
|  | react-router     |        | .env | |
|  | lazy routes      |        |preld | |
|  +--------+---------+        +--+---+ |
+-----------+---------------------+-----+
            | HTTP + WebSocket    |
      +-----+---------------------+----+
      |           chess-api            |
      | +--------+ +--------+ +------+ |
      | | Express| |   ws   | |Chess | |
      | | REST   | |WebSock | |Engine| |
      | | :3000  | | :3000  | |~800L | |
      | +--------+ +--------+ +------+ |
      |                                |
      | in-memory (resets on restart)  |
      | Docker (node:20-alpine)        |
      +--------------------------------+
```

---

## Prerequisites

| Tool              | Min version | Install                            |
| ----------------- | ----------- | ---------------------------------- |
| Node.js           | 18.x        | https://nodejs.org                 |
| pnpm              | 8.x         | `npm install -g pnpm`              |
| Docker (optional) | 24.x        | https://docs.docker.com/get-docker |

---

## Getting started

### Run the app

```bash
# 1. Clone the repo
git clone https://github.com/linuxbeste/chess_electron.git
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
3. The **lobby** shows open games and active games for spectating. Click **New Game** to create one. Toggle **Private** to share the game ID directly.
4. Open a second window (`New Window` button) to register a second player and join the game.
5. Make moves by dragging pieces or clicking source then destination. Pawn promotions show a piece-selection dialog (can be set to auto-queen in settings).
6. Finished games can be **reviewed** move-by-move using the Prev/Next buttons, or viewed in the sidebar move history.
7. Click **Settings** in the navbar to adjust sound, volume, board theme, coordinates, gameplay options, and more.

> **Note:** The API server stores auth tokens **in-memory only**. If the server restarts, all sessions are invalidated. The client detects this on startup by validating the saved token against `GET /auth/me` and redirects to the login view if the token is stale.

---

## Environment variables

Full documentation: [`docs/environment.md`](./docs/environment.md)

### chess-client (`chess-client/.env`)

| Variable           | Default                 | Description                                              |
| ------------------ | ----------------------- | -------------------------------------------------------- |
| `CHESS_SERVER_URL` | `http://localhost:3000` | API base URL                                             |
| `CHESS_WS_URL`     | _(same as server)_      | WebSocket URL override                                   |
| `DEFAULT_USERNAME` | _(empty)_               | Pre-fills login; auto-submits if set                     |
| `AUTO_CONNECT`     | `true`                  | Auto-connect WebSocket on startup                        |
| `THEME`            | `default`               | Board theme (default, classic, blue, green, gray, amber) |
| `SOUND_ENABLED`    | `true`                  | Enable sound by default                                  |
| `SHOW_LEGAL_HINTS` | `true`                  | Show legal move hints by default                         |
| `DEVTOOLS`         | `false`                 | Open DevTools on window creation                         |
| `WINDOW_TITLE`     | `Chess`                 | Window title                                             |
| `WINDOW_WIDTH`     | `1280`                  | Default window width                                     |
| `WINDOW_HEIGHT`    | `900`                   | Default window height                                    |

### chess-api

| Variable                  | Default | Description                        |
| ------------------------- | ------- | ---------------------------------- |
| `PORT`                    | `3000`  | HTTP/WS server port                |
| `CORS_ORIGIN`             | `*`     | Allowed CORS origin                |
| `WS_HEARTBEAT_INTERVAL`   | `30000` | WebSocket ping interval (ms)       |
| `LOG_LEVEL`               | `info`  | Log level                          |
| `MAX_GAMES_PER_PLAYER`    | `1`     | Max concurrent games per player    |
| `RATE_LIMIT_WINDOW_MS`    | `60000` | Rate limit window (ms)             |
| `RATE_LIMIT_MAX_REQUESTS` | `30`    | Max requests per window per player |

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
│   │   │   ├── index.tsx           # createRoot + render <App />
│   │   │   ├── index.html          # Shell HTML (dark theme, Inter font, CSS)
│   │   │   ├── App.tsx             # HashRouter, lazy routes, env init, session restore
│   │   │   ├── store.ts            # Typed observable state store (singleton)
│   │   │   ├── api.ts              # Typed REST client (bearer auth)
│   │   │   ├── socket.ts           # WebSocket manager (auto-reconnect, exponential backoff)
│   │   │   ├── chess.ts            # Client helpers (board parse, SVG pieces)
│   │   │   ├── sound.ts            # Web Audio tone generator (volume control)
│   │   │   ├── settings.ts         # Settings persistence (localStorage, theme)
│   │   │   ├── types.ts            # Re-exports from chess-api + UI types
│   │   │   ├── hooks/
│   │   │   │   └── useStore.ts     # React hook bridging observable store
│   │   │   ├── components/
│   │   │   │   ├── Board.tsx        # 8×8 grid with pointer-event drag-and-drop
│   │   │   │   ├── Square.tsx      # Single square with piece, highlights, labels
│   │   │   │   ├── Navbar.tsx      # User info, WS status dot, settings/logout
│   │   │   │   ├── ToastContainer.tsx  # Auto-dismiss toast messages
│   │   │   │   ├── MoveHistory.tsx  # Auto-scrolling move table
│   │   │   │   ├── Chat.tsx         # WebSocket chat
│   │   │   │   ├── PromotionDialog.tsx  # Modal piece selection
│   │   │   │   ├── SettingsDialog.tsx   # 4-tab settings (General/Board/Display/Gameplay)
│   │   │   │   └── ErrorBoundary.tsx    # React error boundary
│   │   │   └── pages/
│   │   │       ├── LoginPage.tsx    # Username registration
│   │   │       ├── LobbyPage.tsx    # Open/live games, create/join, match history
│   │   │       ├── GamePage.tsx     # Board, drag-drop, clocks, review, promotion
│   │   │       └── ResultPage.tsx   # Outcome display, game ID copy
│   ├── tests/
│   │   ├── api.test.ts             # REST client pure-logic tests
│   │   ├── chess.test.ts           # Board helpers (createInitialBoard, etc.)
│   │   ├── result.test.ts          # Outcome derivation (won/lost/draw)
│   │   ├── router.test.ts          # Route parsing
│   │   ├── settings.test.ts        # Color functions, defaults, persistence
│   │   ├── socket.test.ts          # WS URL construction, reconnect
│   │   ├── sound.test.ts           # Tone parameters per sound function
│   │   ├── store.test.ts           # Session persistence
│   │   ├── setup.ts                # localStorage mock for Node test env
│   │   ├── ErrorBoundary.test.tsx  # Error catch + fallback UI
│   │   ├── SettingsDialog.test.tsx # All 4 tabs, close, overlay, toggles
│   │   └── ToastContainer.test.tsx # Toast render, auto-removal
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

| Command                                     | Description                                     |
| ------------------------------------------- | ----------------------------------------------- |
| `pnpm install`                              | Install all dependencies (both packages)        |
| `pnpm dev`                                  | Start API + build client concurrently           |
| `pnpm build`                                | Compile all packages                            |
| `pnpm test`                                 | Run all test suites                             |
| `pnpm typecheck`                            | Type-check all packages                         |
| `pnpm --filter chess-api dev`               | Start API server with `ts-node` (hot reload)    |
| `pnpm --filter chess-client dev`            | Build webpack bundles + launch Electron         |
| `pnpm --filter chess-client package`        | Package platform installer via electron-builder |
| `pnpm --filter chess-client build:renderer` | Webpack build (renderer only)                   |
| `pnpm --filter chess-client build:main`     | Webpack build (main process only)               |
| `pnpm format`                               | Format all source files with Prettier           |
| `pnpm format:check`                         | Check formatting without writing (CI use)       |
| `pnpm lint`                                 | Lint all source files with ESLint               |
| `pnpm lint:fix`                             | Lint and auto-fix where possible                |

---

## API overview

All authenticated endpoints require `Authorization: Bearer <token>`.

### REST endpoints

| Method | Endpoint             | Auth | Description                                    |
| ------ | -------------------- | ---- | ---------------------------------------------- |
| `GET`  | `/health`            | —    | Server status, active games, online players    |
| `POST` | `/auth/register`     | —    | Create player → `{ playerId, token }`          |
| `GET`  | `/auth/me`           | ✓    | Current player identity                        |
| `POST` | `/games`             | ✓    | Create game as white (body: `visibility`)      |
| `GET`  | `/games`             | —    | List open public games                         |
| `GET`  | `/games/active`      | —    | List active (in-progress) games for spectating |
| `GET`  | `/games/:id`         | —    | Full game state                                |
| `POST` | `/games/:id/join`    | ✓    | Join as black                                  |
| `POST` | `/games/:id/move`    | ✓    | Submit move (`from`, `to`, `promotion?`)       |
| `POST` | `/games/:id/resign`  | ✓    | Resign from game                               |
| `GET`  | `/games/:id/moves`   | ✓    | Legal moves for current turn                   |
| `GET`  | `/players/:id/games` | ✓    | Completed games for a player                   |

### WebSocket events

Connect to `ws://host:port/?token=<bearer-token>`.

| Event          | Trigger                         | Payload includes                         |
| -------------- | ------------------------------- | ---------------------------------------- |
| `move`         | Legal move submitted            | `board` (serialized), `turn`, `lastMove` |
| `game_started` | Black joins                     | Full `GameState`                         |
| `game_over`    | Checkmate, stalemate, or resign | `board`, `result`, `reason`              |
| `chat_message` | Player or spectator sends chat  | `playerId`, `username`, `text`           |

Client-to-server events: `spectate`, `unspectate`, `chat_message`.

Full request/response examples with curl are in [`chess-api/docs/examples.md`](./chess-api/docs/examples.md), including a complete Scholar's Mate walkthrough.

---

## Chess engine

The engine in [`chess-api/src/chess.ts`](./chess-api/src/chess.ts) implements every FIDE rule with **zero external dependencies**.

### Core design

- **Pure functions** — every function accepts board state and returns results. No side effects, no mutation of inputs. Testing is straightforward and bugs are obvious.
- **Clone-and-validate** — legal move filtering clones the board for each candidate via `applyMove`, then checks `isInCheck`. Slower than integrated filtering, but provably correct.
- **Outward-scanning attack detection** — `isSquareAttackedBy` scans outward from the target square using direction vectors, stopping at the first blocker. Much faster than iterating all opponent pieces.

### Implemented rules

| Rule                          | Implementation                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Pawn double push              | `generatePawnMoves` — sets `enPassantTarget` on 2-square advance                                                   |
| En passant                    | Checks destination against stored `enPassantTarget`, removes captured pawn                                         |
| Castling                      | `generateKingMoves` checks empty squares + rook presence; `getLegalMoves` verifies king doesn't pass through check |
| Promotion                     | 4 candidate moves per promotion rank (queen/rook/bishop/knight)                                                    |
| Check / checkmate / stalemate | `getGameStatus` — legal moves exist? king in check?                                                                |
| Algebraic notation            | `moveToAlgebraic` — handles disambiguation, castling `O-O`, captures, promotion `e8=Q`                             |

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

| Platform | Format                  |
| -------- | ----------------------- |
| Linux    | `.AppImage`, `.deb`     |
| macOS    | `.dmg`                  |
| Windows  | `.exe` (NSIS installer) |

The API server must be deployed separately — either via Docker or directly on a VM. The client connects to whatever `CHESS_SERVER_URL` points to.

---

## TypeScript

Two tsconfigs in `chess-client/`:

| Config               | Target       | Entry       | JSX         | Purpose                                         |
| -------------------- | ------------ | ----------- | ----------- | ----------------------------------------------- |
| `tsconfig.json`      | ES2020 + DOM | —           | `react-jsx` | Base config (noEmit), includes renderer + types |
| `tsconfig.main.json` | ES2020       | `src/main/` | —           | Main + preload (Electron Node process)          |

`tsconfig.json` includes `chess-api/src/types.ts` so client types (`Board`, `Piece`, `Move`, etc.) are re-exported directly from the server's canonical definitions.

Full type-check:

```bash
pnpm typecheck
```

---

## Code quality

The project uses **Prettier** for automatic code formatting and **ESLint** with `typescript-eslint` for static analysis, both configured at the monorepo root.

| Command             | Description                               |
| ------------------- | ----------------------------------------- |
| `pnpm format`       | Format all source files with Prettier     |
| `pnpm format:check` | Check formatting only (used in CI)        |
| `pnpm lint`         | Lint with ESLint (recommended rules + TS) |
| `pnpm lint:fix`     | Lint and auto-fix where possible          |

Run both before committing:

```bash
pnpm format && pnpm lint
```

Configuration:

- **Prettier**: `.prettierrc` (2-space indent, single quotes, trailing commas, 120 print width)
- **ESLint**: `eslint.config.mjs` (flat config, `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-config-prettier`)

---

## Further documentation

## Further documentation

- [`chess-api/docs/api.md`](./chess-api/docs/api.md) — API reference with request/response schemas
- [`chess-api/docs/architecture.md`](./chess-api/docs/architecture.md) — Layering, data flow, design decisions
- [`chess-api/docs/chess-logic.md`](./chess-api/docs/chess-logic.md) — Engine internals: move generation, checkmate detection
- [`chess-api/docs/deployment.md`](./chess-api/docs/deployment.md) — Docker build, environment variables, production config
- [`chess-api/docs/examples.md`](./chess-api/docs/examples.md) — curl examples with a complete Scholar's Mate game
- [`docs/environment.md`](./docs/environment.md) — Full environment variable reference for both packages

---

## License

MIT
