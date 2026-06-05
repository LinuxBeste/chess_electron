# Architecture

## Overview

chess-client is a React + TypeScript application built on Electron. It connects to the chess-api server via both REST and WebSocket to provide real-time multiplayer chess. The same renderer build also runs standalone in a browser.

## Process Model

```
main process (Electron)
  ├── main.ts          — Window creation, lifecycle
  └── preload.ts       — Context bridge (exposes electronAPI)

renderer process (Web / React SPA)
  ├── index.tsx        — Entry: mounts <App /> inside <HashRouter>
  ├── App.tsx          — Routes, session restore, env config
  ├── store.ts         — Observable state (singleton, shared by all components)
  ├── api.ts           — Typed REST client (all fetch calls)
  ├── socket.ts        — WebSocket manager with auto-reconnect
  ├── chess.ts         — Board utilities, algebraic notation helpers
  ├── settings.ts      — Settings schema, persistence, CSS variable application
  ├── sound.ts         — Sound effect playback
  ├── pages/           — Route-level page components
  │   ├── LoginPage.tsx
  │   ├── LobbyPage.tsx
  │   ├── GamePage.tsx
  │   ├── ResultPage.tsx
  │   └── LocalGamePage.tsx (offline 1v1)
  ├── components/      — Reusable UI components
  │   ├── Navbar.tsx
  │   ├── Board.tsx / Square.tsx
  │   ├── MoveHistory.tsx
  │   ├── PromotionDialog.tsx
  │   ├── SettingsDialog.tsx
  │   └── ...
  └── hooks/           — Custom React hooks
```

## Data Flow (Online)

```
User Input → React handler → api.ts (REST) → chess-api server
                                ↓
chess-api broadcasts → socket.ts (WS) → store subscribers → React re-render
```

Moves are sent via REST and broadcast back via WebSocket. The game view also performs optimistic updates — the board reflects the move immediately, then reconciles with the authoritative server state.

### Local 1v1 (Offline)

The local game mode runs entirely client-side with no server:
- Board logic uses functions from `chess.ts` (cloneBoard, createInitialBoard, squareToIndices)
- Move generation, check/checkmate/stalemate detection are self-contained in `LocalGamePage.tsx`
- No WebSocket, no API calls, no server dependency

## State Management

The store (`store.ts`) is a simple observable map. Components subscribe to keys and receive typed callbacks when values change.

### Store Keys

| Key            | Type               | Description                     |
|----------------|--------------------|----------------------------------|
| `token`        | `string \| null`   | Bearer token for auth            |
| `playerId`     | `string \| null`   | Current player's UUID            |
| `username`     | `string \| null`   | Display name                     |
| `currentGame`  | `GameState \| null` | Active game snapshot            |
| `wsStatus`     | `WsStatus`         | WebSocket connection state       |
| `toasts`       | `ToastMessage[]`   | Active toast notifications       |

## Settings

All settings are persisted to localStorage under `chess_settings`:

| Key                  | Type                                             | Default    |
|----------------------|--------------------------------------------------|------------|
| soundEnabled         | `boolean`                                        | `true`     |
| soundVolume          | `number` (0-100)                                 | `100`      |
| animationsEnabled    | `boolean`                                        | `true`     |
| boardTheme           | `'default' \| 'classic' \| 'blue' \| 'green' \| 'gray' \| 'amber'` | `'default'` |
| boardStyle           | `'default' \| 'rounded' \| 'framed'`             | `'default'` |
| background           | `'default' \| 'dots' \| 'grid' \| 'none'`        | `'default'` |
| pieceAnimation       | `'none' \| 'slide' \| 'pop'`                     | `'slide'`   |
| alwaysWhiteBottom    | `boolean`                                        | `false`    |
| showLegalHints       | `boolean`                                        | `true`     |
| showCoordinates      | `boolean`                                        | `true`     |
| highlightLastMove    | `boolean`                                        | `true`     |
| autoPromoteQueen     | `boolean`                                        | `false`    |
| moveAnimationSpeed   | `'fast' \| 'normal' \| 'slow'`                   | `'normal'` |
| confirmResign        | `boolean`                                        | `true`     |
| confirmDraw          | `boolean`                                        | `false`    |
| pieceSet             | `'emoji' \| 'svg'`                               | `'svg'`    |

CSS variables are applied via `data-theme`, `data-board-style`, and `data-background` attributes on `<html>`.

## Security

- `contextIsolation: true` — renderer has no direct Node.js access
- `nodeIntegration: false` — no require() in renderer
- CSP headers restrict font loading to Google Fonts and API connections to the configured server URL
- Preload exposes minimal surface area: `platform`, `openNewWindow`, `serverUrl`, `wsUrl`, `defaultUsername`, `autoConnect`, `defaultTheme`, `defaultSound`, `defaultHints`
- In browser mode, `window.electronAPI` is `undefined` — all access is guarded with `?.`

## Routing

Hash-based routing with React Router (`<HashRouter>`):

| Route              | Component        | Description                     |
|--------------------|------------------|----------------------------------|
| `/login`           | `LoginPage`      | Username entry screen            |
| `/lobby`           | `LobbyPage`      | Game list + create game          |
| `/game/:gameId`    | `GamePage`       | Active chess game                |
| `/result/:gameId`  | `ResultPage`     | Game over screen                 |
| `/local`           | `LocalGamePage`  | Offline 1v1 hotseat              |

All pages are lazy-loaded with `React.lazy()` for code-splitting.

## WebSocket Protocol

Connect: `ws://localhost:3000/?token=<bearer-token>`

Messages are JSON with a `type` discriminator:
- `type: "move"` — opponent made a move
- `type: "game_over"` — game ended
- `type: "game_started"` — game started for white
- `type: "chat_message"` — chat message received

Auto-reconnect: exponential backoff 1s → 2s → 4s → 8s → 10s (capped), 5 max attempts.

## Key Design Decisions

1. **React + TypeScript** — Component-based architecture with strict typing throughout.
2. **CSS-in-HTML** — All styles are in `index.html` `<style>` block (no CSS modules, no preprocessors). CSS variables for theming.
3. **DOM-based board** — 64 `<div>` elements in an absolute-positioned grid, not Canvas. Enables CSS transitions and smooth interaction.
4. **Lazy routes** — Each page is code-split via `React.lazy()` for smaller initial bundle.
5. **Settings via data-attributes** — Theme, board style, and background are applied as `data-*` attributes on `<html>`, consumed by CSS selectors.
6. **Offline local mode** — Full chess rules (moves, check, checkmate, stalemate, promotion, timers) run client-side with no server.
7. **Same build for web + Electron** — The renderer targets `'web'`. `window.electronAPI` is optional. No compile-time branching.
