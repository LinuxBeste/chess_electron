# Architecture

## Overview

chess-client is a vanilla TypeScript desktop application built on Electron. It connects to the chess-api server via both REST and WebSocket to provide a real-time multiplayer chess experience.

## Process Model

```
main process (Electron)
  ├── main.ts          — Window creation, lifecycle
  └── preload.ts       — Context bridge (minimal surface area)

renderer process (Web)
  ├── index.ts         — Entry point: mounts toast system, initializes router
  ├── store.ts         — Observable state (singleton, shared by all views)
  ├── router.ts        — Hash-based view routing with mount/unmount lifecycle
  ├── api.ts           — Typed REST client (all fetch calls)
  ├── socket.ts        — WebSocket manager with auto-reconnect
  ├── chess.ts         — Board utilities, SVG piece paths, DOM helpers
  └── views/
      ├── login.ts     — Username entry screen
      ├── lobby.ts     — Open games list + create game
      ├── game.ts      — Active chess game (board, moves, drag-drop, clocks)
      └── result.ts    — Game over modal
```

## Data Flow

```
User Input → view handler → api.ts (REST) → chess-api server
                                ↓
chess-api broadcasts → socket.ts (WS) → store subscribers → view re-renders
```

Moves are sent via REST and broadcast back via WebSocket. The game view also performs optimistic updates — the board reflects the move immediately, then reconciles with the authoritative server state.

## State Management

The store (`store.ts`) is a simple observable map. Views subscribe to keys and receive typed callbacks when values change. No external reactive framework is used.

### Store Keys

| Key            | Type               | Description                     |
|----------------|-------------------|----------------------------------|
| `token`        | `string \| null`  | Bearer token for auth            |
| `playerId`     | `string \| null`  | Current player's UUID            |
| `username`     | `string \| null`  | Display name                     |
| `currentGame`  | `GameState \| null`| Active game snapshot             |
| `wsStatus`     | `WsStatus`        | WebSocket connection state       |
| `toasts`       | `ToastMessage[]`  | Active toast notifications       |
| `currentView`  | `ViewName`        | Currently mounted route          |

## Security

- `contextIsolation: true` — renderer has no direct Node.js access
- `nodeIntegration: false` — no require() in renderer
- CSP headers restrict font loading to Google Fonts and API connections to the configured server URL
- Preload exposes `platform`, `openNewWindow`, and `serverUrl` — minimal surface area
- The `.env` file at the project root sets `CHESS_SERVER_URL` (read at runtime by the main process and preload)
- **Session validation** — On startup, a restored session is validated by calling `GET /auth/me`. If the server rejects the token (e.g. after a server restart wiped the in-memory token store), the session is cleared and the user is redirected to the login view. This prevents "Invalid token" errors on the first authenticated request.

## Routing

Hash-based routing with four views:
- `#login` — centered username card
- `#lobby` — game list + create
- `#game/<gameId>` — active board
- `#result/<gameId>` — outcome modal

Each view exports `mount(container): () => void`. The router calls unmount on the previous view before mounting the next, preventing listener leaks.

## WebSocket Protocol

Connect: `ws://localhost:3000/?token=<bearer-token>`

Messages are JSON with a `type` discriminator:
- `type: "move"` — opponent made a move (board as SerializedSquare[], turn, lastMove)
- `type: "game_over"` — game ended (includes result + reason)

Auto-reconnect: exponential backoff 1s → 2s → 4s → 8s → 10s (capped), 5 max attempts.

## Key Design Decisions

1. **No framework** — Vanilla DOM with typed helpers keeps the bundle small (34KB) and avoids dependency churn.
2. **DOM-based board** — 64 `<div>` elements in a CSS grid, not Canvas. Enables CSS transitions on pieces and smooth interaction without rasterization artifacts.
3. **Diff-based game list** — Lobby polls every 3s but only patches changed DOM nodes instead of rebuilding the entire list.
4. **Optimistic moves** — The board updates locally before the API responds. If the API rejects, the board reverts to the last known good state.
5. **Promotion dialog** — When a pawn reaches the last rank, a modal with 4 piece options appears instead of silently defaulting to queen.
