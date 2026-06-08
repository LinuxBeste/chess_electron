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
WORKDIR /app
COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
RUN corepack enable && corepack prepare pnpm@9 --activate && pnpm prune --prod
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
