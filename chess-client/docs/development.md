# Development

## Prerequisites

- Node.js 20+
- pnpm
- chess-api server running on localhost:3000

## Setup

```bash
cd chess-client
pnpm install
```

## Commands

| Command               | Description                            |
|-----------------------|----------------------------------------|
| `pnpm run typecheck`  | TypeScript type checking only           |
| `pnpm run build:renderer` | Build renderer bundle              |
| `pnpm run build:main` | Build Electron main process             |
| `pnpm run build`      | Build main + renderer bundles           |
| `pnpm run build:web`  | Build renderer for standalone web       |
| `pnpm run dev:web`    | Dev server for browser (port 3000)      |
| `pnpm run dev`        | Build and launch Electron               |
| `pnpm run start`      | Launch Electron (build first)           |
| `pnpm run package`    | Build and package with electron-builder |

## Project Conventions

### Code Style

- Strict TypeScript throughout — no `any` types
- Descriptive variable names over abbreviated ones
- Comments explain *why*, not *what* — the code itself says what it does
- No banner/heading comments (`// === SECTION ===`)

### Adding a New Page

1. Create `src/renderer/pages/YourPage.tsx` exporting a default React component
2. Add a route in `src/renderer/App.tsx` inside the `<Routes>` block
3. Use lazy import for code-splitting: `const YourPage = lazy(() => import('./pages/YourPage'))`

### API Client Conventions

Every function in `api.ts`:
- Is named after the endpoint (e.g. `register`, `createGame`, `makeMove`)
- Has a JSDoc comment referencing the source file where the endpoint was confirmed
- Returns a typed promise matching the response shape
- Uses the shared `request()` helper (never raw `fetch`)

### Settings

Settings are stored in localStorage under `chess_settings`. The schema is defined in `settings.ts` with type `AppSettings`. New settings:
1. Add the field to the `AppSettings` interface and `defaultSettings` in `settings.ts`
2. Add a UI control in `SettingsDialog.tsx` in the appropriate tab
3. If it requires CSS, use a `data-*` attribute on `<html>` (see `boardStyle`, `background`, `boardTheme`)

### Web vs Electron

- The renderer targets `'web'` in webpack — same build works in browser and Electron
- `window.electronAPI` is optional (typed as `electronAPI?: {...}`) and always accessed with `?.`
- In browser: all Electron-specific features gracefully degrade
- In Electron: the preload script exposes `electronAPI` via `contextBridge`
