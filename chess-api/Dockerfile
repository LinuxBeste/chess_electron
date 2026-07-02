FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@9 --activate

# Install API deps
WORKDIR /app
COPY package.json ./
RUN pnpm install --no-frozen-lockfile

# Copy admin-frontend source and install its deps
COPY admin-frontend/ ./admin-frontend/
RUN cd admin-frontend && pnpm install --no-frozen-lockfile

# Build both (admin-frontend → dist/admin/ via Vite, then API via tsc)
COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm run build

FROM node:20-alpine AS runner
RUN addgroup -S chess && adduser -S chess -G chess
# su-exec is a tiny (~5KB) C binary that execs as a given user,
# correctly becoming PID 1 for proper signal forwarding.
RUN apk add --no-cache su-exec postgresql-client
WORKDIR /app
COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
RUN corepack enable && corepack prepare pnpm@9 --activate && pnpm prune --prod
COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/bin && cat > /app/bin/chess-admin.mjs << 'SCRIPT'
#!/usr/bin/env node
const disableCli = process.env.DISABLE_CLI;
if (disableCli === 'true' || disableCli === '1') {
  console.error('chess-admin: CLI is disabled (DISABLE_CLI is set)');
  process.exit(1);
}
import { spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distCli = path.join(__dirname, '..', 'dist', 'cli.js');
if (fs.existsSync(distCli)) {
  await import(pathToFileURL(distCli).href);
} else {
  const tsxPath = path.join(__dirname, '..', 'node_modules', '.bin', 'tsx');
  if (fs.existsSync(tsxPath)) {
    const srcCli = path.join(__dirname, '..', 'src', 'cli.ts');
    const result = spawnSync(tsxPath, [srcCli, ...process.argv.slice(2)], {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
    });
    process.exit(result.status ?? 0);
  } else {
    console.error('chess-admin CLI not found. Run pnpm build first.');
    process.exit(1);
  }
}
SCRIPT
RUN ln -s /app/bin/chess-admin.mjs /usr/local/bin/chess-admin
RUN mkdir -p /app/data /app/logs /app/backups && chown chess:chess /app/data /app/logs /app/backups
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 25565
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:25565/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"
ENTRYPOINT ["/docker-entrypoint.sh"]
