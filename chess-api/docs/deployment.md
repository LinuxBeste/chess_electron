# Deployment

## Prerequisites

- Node.js 20 or Docker

## Local Development

```bash
# Install dependencies
npm install

# Type-check
npx tsc --noEmit

# Run tests
npm test

# Build
npm run build

# Start
npm start
```

Server listens on port 3000 by default. Override with `PORT` environment variable.

```bash
PORT=4000 npm start
```

## Docker

### Build

```bash
docker build -t chess-api .
```

The `Dockerfile` uses a multi-stage build:
1. **builder** stage — installs all dependencies, compiles TypeScript
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

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | `3000`  | HTTP/WS server port |
| `NODE_ENV` | —    | Set to `test` to skip server startup (used by test runner) |

## Testing

```bash
npm test
```

Runs Jest with `--forceExit --detectOpenHandles`. The test suite:
- `chess.test.ts` — 22+ test cases covering the full chess engine
- `api.test.ts` — 15+ integration tests covering the full API surface

Tests are designed to run outside Docker without any external services.
