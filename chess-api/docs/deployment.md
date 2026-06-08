# Deployment

## Prerequisites

- Node.js 20 or Docker

## Local Development

```bash
# Install dependencies (from workspace root)
pnpm install

# Build (admin frontend + API server)
pnpm run build

# Run tests
pnpm test

# Start
pnpm start
```

Server listens on port 3000 by default. Override with `PORT` environment variable.

```bash
PORT=4000 pnpm start
```

## Admin Dashboard

The admin dashboard is a React SPA (Vite + TailwindCSS + lucide-react) served at `/admin/`.
It is built automatically as part of `pnpm run build` — the Vite output goes into `dist/admin/`
and is served as static files by Express.

Default credentials: `admin` / `admin` (configurable via `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars).

## Docker

### Build

```bash
docker build -t chess-api .
```

The `Dockerfile` uses a multi-stage build:

1. **builder** stage — installs all dependencies (API + admin frontend), builds the React app with Vite, compiles TypeScript
2. **runner** stage — copies only production dependencies and compiled JS

### Run

```bash
docker run -d -p 3000:3000 --name chess-api chess-api
```

### Docker Compose

```bash
docker compose up --build
```

The compose configuration includes:

- Port mapping (3000:3000)
- Auto-restart (`unless-stopped`)
- Health check (GET /health every 30s)

## Environment Variables

| Variable         | Default | Description                                                |
| ---------------- | ------- | ---------------------------------------------------------- |
| `PORT`           | `3000`  | HTTP/WS server port                                        |
| `NODE_ENV`       | —       | Set to `test` to skip server startup (used by test runner) |
| `ADMIN_USERNAME` | `admin` | Admin dashboard login username                             |
| `ADMIN_PASSWORD` | `admin` | Admin dashboard login password                             |

## Testing

```bash
pnpm test
```

Runs Jest with `--forceExit --detectOpenHandles`. The test suite:

- `chess.test.ts` — 22+ test cases covering the full chess engine
- `api.test.ts` — 70+ integration tests covering the full API surface and admin routes

Tests are designed to run outside Docker without any external services.
