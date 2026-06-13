# Chess Electron

> A multiplayer chess desktop app with a full FIDE-compliant engine, REST API, real-time WebSocket updates, Stockfish bot, tournaments, leaderboard, and friend system — built entirely from scratch in TypeScript.

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
                           PUBLIC INTERNET (optional)
                                  │
                     ┌────────────▼────────────┐
                     │  Cloudflare Tunnel        │
                     │  (cloudflared container)   │
                     │  Auto-HTTPS, no open ports │
                     └────────────┬──────────────┘
                                  │  http://chess-api:3000
+---------------------------------▼--------------------------------+
|                        chess-api (Docker)                         |
|  +------------------+  +---------------+  +--------------------+  |
|  | Express REST      |  | ws WebSocket   |  | Chess Engine      |  |
|  | :25565 (host)     |  | /chess-ws      |  | (~800 lines)      |  |
|  | or :3000 (int.)   |  |                |  | + Stockfish bot   |  |
|  +------------------+  +---------------+  +--------------------+  |
|  +------------------+  +---------------+  +--------------------+  |
|  | Admin panel       |  | SQLite (DB)   |  | In-memory games   |  |
|  | (Vite+React+TW)   |  | users/tokens  |  | (ephemeral)       |  |
|  +------------------+  +---------------+  +--------------------+  |
+---------------------------------+--------------------------------+
                                  |
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
   Electron App              Web Browser             Mobile/curl
   (port 3000 webpack)    (via tunnel URL)       (direct API)

  Development only:
  webpack-dev-server :3000 → proxy → API :25565
  HMR WebSocket at /ws (no conflict with /chess-ws)
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

### Run the app (development)

```bash
# 1. Clone the repo
git clone https://github.com/linuxbeste/chess_electron.git
cd chess-electron

# 2. Install dependencies
pnpm install

# 3. Start the API server (port 25565)
pnpm --filter chess-api dev

# 4. In another terminal, build and launch the desktop client
pnpm --filter chess-client dev
```

The webpack dev server listens on `http://localhost:3000` and proxies API calls to `http://localhost:25565`. WebSocket events go through `/chess-ws` to avoid conflicting with webpack's HMR WebSocket at `/ws`.

### Or run both at once

```bash
pnpm dev
```

### Play the game

1. Open the app — the **login** screen appears.
2. Enter a username and click **Enter** — a player account is created and the token stored locally.
3. The **lobby** shows open games and active games for spectating. Click **New Game** to create one. Toggle **Private** to share the game ID directly.
4. Open a second window (`New Window` button) to register a second player and join the game.
5. Make moves by dragging pieces or clicking source then destination. Pawn promotions show a piece-selection dialog (can be set to auto-queen in settings).
6. Finished games can be **reviewed** move-by-move using the Prev/Next buttons, or viewed in the sidebar move history.
7. Click **Settings** in the navbar to adjust sound, volume, board theme, coordinates, gameplay options, and more.

### Play against the bot

In the **lobby**, click **Play vs Bot**. Choose difficulty (1–20, where 20 is strongest), pick your color, and start.

### Tournaments

Navigate to the **Tournaments** page. Create a tournament or join an existing one. Tournaments use single-elimination brackets. Private tournaments can be joined via an 8-character share code.

### Leaderboard

The **Leaderboard** page shows all registered players ranked by Elo rating. Anonymous players are not rated.

---

## Deploy with public HTTPS (no domain / no router access)

```bash
cd chess-api
docker compose up --build -d
docker compose logs cloudflared
# Look for:  https://<random>.trycloudflare.com
```

Share that URL with anyone — they can register and play through Cloudflare's tunnel. No open firewall ports, no domain needed, TLS auto-handled by Cloudflare.

---

## Environment variables

Full documentation: [`docs/environment.md`](./docs/environment.md)

### chess-api

| Variable                  | Default | Description                        |
| ------------------------- | ------- | ---------------------------------- |
| `PORT`                    | `25565` | HTTP/WS server port                |
| `CORS_ORIGIN`             | `*`     | Allowed CORS origin                |
| `WS_HEARTBEAT_INTERVAL`   | `30000` | WebSocket ping interval (ms)       |
| `LOG_LEVEL`               | `info`  | Log level                          |
| `MAX_GAMES_PER_PLAYER`    | `1`     | Max concurrent games per player    |
| `RATE_LIMIT_WINDOW_MS`    | `60000` | Rate limit window (ms)             |
| `RATE_LIMIT_MAX_REQUESTS` | `30`    | Max requests per window per player |

### chess-client (`chess-client/.env`)

| Variable           | Default                 | Description                                              |
| ------------------ | ----------------------- | -------------------------------------------------------- |
| `CHESS_SERVER_URL` | `http://localhost:3000` | API base URL (webpack proxy)                             |
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

> **Note:** The API server stores auth tokens **in-memory only**. If the server restarts, all sessions are invalidated. The client detects this on startup by validating the saved token against `GET /auth/me` and redirects to the login view if the token is stale.

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
│   │   ├── engine.ts               # Stockfish bot engine manager
│   │   ├── admin.ts                # Admin API routes
│   │   ├── db.ts                   # SQLite database (users, tokens, etc.)
│   │   └── types.ts                # Shared interfaces
│   ├── admin-frontend/             # React admin dashboard (Vite + Tailwind)
│   │   └── src/
│   │       ├── components/         # Dashboard tabs (Overview, Games, Players, etc.)
│   │       └── App.tsx             # HashRouter + auth + tab navigation
│   ├── tests/
│   │   ├── chess.test.ts           # Chess engine unit tests
│   │   ├── game.test.ts            # Game logic unit tests
│   │   └── api.test.ts             # Integration tests (supertest)
│   ├── docs/
│   │   ├── README.md               # API docs index
│   │   ├── api.md                  # Full API reference with examples
│   │   ├── architecture.md         # Layering & design decisions
│   │   ├── chess-logic.md          # Engine internals (move gen, checkmate)
│   │   ├── deployment.md           # Docker build & deployment
│   │   └── examples.md             # curl examples with Scholar's Mate
│   ├── cloudflared/                # Cloudflare Tunnel config
│   │   └── config.yml              # Named tunnel template
│   ├── Dockerfile                  # Multi-stage build (node:20-alpine)
│   ├── docker-compose.yml          # Compose with cloudflared + health check
│   ├── Caddyfile                   # Caddy config (unused, replaced by tunnel)
│   ├── start.sh                    # Orchestrator (native/Docker + tunnels)
│   ├── jest.config.ts
│   └── tsconfig.json
│
├── chess-client/                   # Electron desktop app
│   ├── src/
│   │   ├── main/
│   │   │   ├── main.ts             # Window creation, IPC, .env loading
│   │   │   └── preload.ts          # contextBridge (serverUrl, openNewWindow)
│   │   └── renderer/
│   │       ├── index.tsx           # createRoot + render <App />
│   │       ├── index.html          # Shell HTML (dark theme, Inter font)
│   │       ├── App.tsx             # HashRouter, lazy routes, env init, session restore
│   │       ├── store.ts            # Typed observable state store (singleton)
│   │       ├── api.ts              # Typed REST client (bearer auth)
│   │       ├── socket.ts           # WebSocket manager (auto-reconnect, exponential backoff)
│   │       ├── chess.ts            # Client helpers (board parse, SVG pieces)
│   │       ├── sound.ts            # Web Audio tone generator (volume control)
│   │       ├── settings.ts         # Settings persistence (localStorage, theme)
│   │       ├── types.ts            # Re-exports from chess-api + UI types
│   │       ├── hooks/
│   │       │   └── useStore.ts     # React hook bridging observable store
│   │       ├── components/
│   │       │   ├── Board.tsx       # 8×8 grid with pointer-event drag-and-drop
│   │       │   ├── Square.tsx      # Single square with piece, highlights, labels
│   │       │   ├── Navbar.tsx      # User info, WS status dot, settings/logout
│   │       │   ├── ToastContainer.tsx  # Auto-dismiss toast messages
│   │       │   ├── MoveHistory.tsx # Auto-scrolling move table
│   │       │   ├── Chat.tsx        # WebSocket chat
│   │       │   ├── PromotionDialog.tsx  # Modal piece selection
│   │       │   ├── SettingsDialog.tsx   # 4-tab settings
│   │       │   └── ErrorBoundary.tsx    # React error boundary
│   │       └── pages/
│   │           ├── LoginPage.tsx   # Username registration
│   │           ├── LobbyPage.tsx   # Open/live games, create/join, bot, match history
│   │           ├── GamePage.tsx    # Board, drag-drop, clocks, review, promotion
│   │           ├── ResultPage.tsx  # Outcome display, game ID copy
│   │           ├── LeaderboardPage.tsx   # Elo rankings
│   │           ├── ArchivePage.tsx       # Completed game history
│   │           └── TournamentsPage.tsx   # Tournament brackets
│   ├── tests/                      # 15 test suites, 154 tests
│   ├── webpack.main.config.js
│   ├── webpack.renderer.config.js  # Proxy /chess-ws + API to :25565
│   ├── tsconfig.json
│   ├── electron-builder.json
│   └── jest.config.js
│
├── docs/
│   └── environment.md              # Full env variable reference
├── package.json                    # Root workspace scripts
├── pnpm-workspace.yaml
└── .gitignore
```

---

## Scripts

| Command                              | Description                                     |
| ------------------------------------ | ----------------------------------------------- |
| `pnpm install`                       | Install all dependencies (both packages)        |
| `pnpm dev`                           | Start API + build client concurrently           |
| `pnpm build`                         | Compile all packages                            |
| `pnpm test`                          | Run all test suites (492 tests)                 |
| `pnpm typecheck`                     | Type-check all packages                         |
| `pnpm --filter chess-api dev`        | Start API server with `ts-node` (port 25565)    |
| `pnpm --filter chess-api test`       | Run API tests (338 tests)                       |
| `pnpm --filter chess-client dev`     | Build webpack bundles + launch Electron         |
| `pnpm --filter chess-client dev:web` | Webpack dev server + auto-starts API on :25565  |
| `pnpm --filter chess-client test`    | Run client tests (154 tests)                    |
| `pnpm --filter chess-client package` | Package platform installer via electron-builder |
| `pnpm format`                        | Format all source files with Prettier           |
| `pnpm format:check`                  | Check formatting without writing (CI use)       |
| `pnpm lint`                          | Lint all source files with ESLint               |
| `pnpm lint:fix`                      | Lint and auto-fix where possible                |

---

## API overview

All authenticated endpoints require `Authorization: Bearer <token>`.

Direct API access at `http://localhost:25565` (or tunnel URL in production).

### REST endpoints

| Method | Endpoint                          | Auth | Description                                    |
| ------ | --------------------------------- | ---- | ---------------------------------------------- |
| `GET`  | `/health`                         | —    | Server status, active games, online players    |
| `POST` | `/auth/register`                  | —    | Create player → `{ playerId, token }`          |
| `GET`  | `/auth/me`                        | ✓    | Current player identity                        |
| `POST` | `/auth/login`                     | —    | Login as registered user                       |
| `POST` | `/games`                          | ✓    | Create game as white (`visibility`)            |
| `GET`  | `/games`                          | —    | List open public games                         |
| `GET`  | `/games/active`                   | —    | List active (in-progress) games for spectating |
| `GET`  | `/games/:gameId`                  | —    | Full game state                                |
| `POST` | `/games/:id/join`                 | ✓    | Join as black                                  |
| `POST` | `/games/:id/move`                 | ✓    | Submit move (`from`, `to`, `promotion?`)       |
| `POST` | `/games/:id/resign`               | ✓    | Resign from game                               |
| `POST` | `/games/bot`                      | ✓    | Create bot game (body: `{color, skillLevel}`)  |
| `GET`  | `/players/me/active-game`         | ✓    | Get active game ID for rejoin after refresh    |
| `GET`  | `/players/:id/games`              | ✓    | Completed games for a player                   |
| `POST` | `/tournaments`                    | ✓    | Create tournament                              |
| `GET`  | `/tournaments`                    | —    | List tournaments                               |
| `GET`  | `/tournaments/join-by-code/:code` | —    | Join private tournament by code                |
| `POST` | `/games/:id/draw`                 | ✓    | Offer/accept/decline draw                      |
| `GET`  | `/leaderboard`                    | —    | Get Elo leaderboard                            |
| `GET`  | `/games/completed`                | ✓    | Get completed games (archive with pagination)  |

### WebSocket events

Connect to `ws://host:port/chess-ws?token=<bearer-token>`.

| Event                   | Trigger                         | Payload includes                         |
| ----------------------- | ------------------------------- | ---------------------------------------- |
| `move`                  | Legal move submitted            | `board` (serialized), `turn`, `lastMove` |
| `game_started`          | Black joins                     | Full `GameState`                         |
| `game_over`             | Checkmate, stalemate, or resign | `board`, `result`, `reason`              |
| `chat_message`          | Player or spectator sends chat  | `playerId`, `username`, `text`           |
| `opponent_disconnected` | Opponent loses connection       | `gameId`                                 |
| `opponent_reconnected`  | Opponent reconnects             | `gameId`                                 |
| `draw_offered`          | Player offers draw              | `gameId`, `fromPlayerId`                 |

Client-to-server events: `spectate`, `unspectate`, `chat_message`, `offer_draw`, `accept_draw`, `decline_draw`, `rematch_offer`, `rematch_accept`, `challenge`, `challenge_accept`, `challenge_decline`, `get_chat_history`.

Full request/response examples with curl are in [`chess-api/docs/examples.md`](./chess-api/docs/examples.md).

---

## Chess engine

The engine in [`chess-api/src/chess.ts`](./chess-api/src/chess.ts) implements every FIDE rule with **zero external dependencies**.

### Core design

- **Pure functions** — every function accepts board state and returns results. No side effects, no mutation of inputs.
- **Clone-and-validate** — legal move filtering clones the board for each candidate via `applyMove`, then checks `isInCheck`.
- **Outward-scanning attack detection** — `isSquareAttackedBy` scans outward from the target square using direction vectors, stopping at the first blocker.

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

## Docker + Cloudflare Tunnel

Build and run the API stack:

```bash
cd chess-api
docker compose up --build -d
```

The stack includes:

- `chess-api` — HTTP server (internal-only, `expose: 3000`)
- `cloudflared` — Cloudflare Tunnel for public HTTPS access

Get your public URL:

```bash
docker compose logs cloudflared
# → https://<random>.trycloudflare.com
```

No open firewall ports. TLS handled by Cloudflare. Anyone can play via that URL.

### Named tunnel (permanent URL)

Set up on [Cloudflare Zero Trust](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/), then uncomment the named tunnel section in `docker-compose.yml`.

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

## Code quality

| Command             | Description                               |
| ------------------- | ----------------------------------------- |
| `pnpm format`       | Format all source files with Prettier     |
| `pnpm format:check` | Check formatting only (used in CI)        |
| `pnpm lint`         | Lint with ESLint (recommended rules + TS) |
| `pnpm lint:fix`     | Lint and auto-fix where possible          |

Configuration:

- **Prettier**: `.prettierrc` (2-space indent, single quotes, trailing commas, 120 print width)
- **ESLint**: `eslint.config.mjs` (flat config, `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-config-prettier`)

---

## Further documentation

- [`chess-api/docs/api.md`](./chess-api/docs/api.md) — API reference with request/response schemas
- [`chess-api/docs/architecture.md`](./chess-api/docs/architecture.md) — Layering, data flow, design decisions
- [`chess-api/docs/chess-logic.md`](./chess-api/docs/chess-logic.md) — Engine internals: move generation, checkmate detection
- [`chess-api/docs/deployment.md`](./chess-api/docs/deployment.md) — Docker build, environment variables, Cloudflare Tunnel
- [`chess-api/docs/examples.md`](./chess-api/docs/examples.md) — curl examples with a complete Scholar's Mate game
- [`docs/environment.md`](./docs/environment.md) — Full environment variable reference for both packages

---

## License

MIT
