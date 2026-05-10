# Development

## Prerequisites

- Node.js 20+
- chess-api server running on localhost:3000

## Setup

```bash
cd chess-client
npm install
```

## Commands

| Command               | Description                        |
|-----------------------|------------------------------------|
| `npm run typecheck`   | TypeScript type checking only      |
| `npm run build`       | Build main + renderer bundles      |
| `npm run dev`         | Build and launch Electron          |
| `npm run start`       | Launch Electron (build first)      |
| `npm run package`     | Build and package with electron-builder |

## Project Conventions

### Code Style

- Strict TypeScript throughout — no `any` types
- Descriptive variable names over abbreviated ones
- Comments explain *why*, not *what* — the code itself says what it does
- No banner/heading comments (`// === SECTION ===`)
- Inline comments document API confirmations (which source file + line number)

### Adding a New View

1. Create `src/renderer/views/your-view.ts` exporting `{ mount(container): () => void }`
2. Register it in `src/renderer/index.ts` by importing and passing to `initRouter`
3. Add the route pattern in `src/renderer/router.ts` `getViewFromHash()`
4. Add the view name to the `ViewName` type in `src/types.ts`

### API Client Conventions

Every function in `api.ts`:
- Is named after the endpoint (e.g. `register`, `createGame`, `makeMove`)
- Has a JSDoc comment referencing the source file where the endpoint was confirmed
- Returns a typed promise matching the response shape
- Uses the shared `request()` helper (never raw `fetch`)

### WebSocket Message Types

Add new message types to `socket.ts`:
1. Define the interface extending `{ type: string }`
2. Add it to the `WsMessage` union
3. Add a handler set and a subscription method
4. Dispatch in the `onmessage` switch
