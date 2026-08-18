FROM node:22-slim AS builder
WORKDIR /app
COPY . .
RUN npm install -g corepack@latest && corepack pnpm install --frozen-lockfile && corepack pnpm run build
RUN corepack pnpm prune --prod

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --gid 10001 cnad32 && useradd --uid 10001 --gid cnad32 --create-home --shell /usr/sbin/nologin cnad32
COPY --from=builder --chown=cnad32:cnad32 /app/dist ./dist
COPY --from=builder --chown=cnad32:cnad32 /app/node_modules ./node_modules
COPY --from=builder --chown=cnad32:cnad32 /app/package.json ./package.json
USER cnad32
CMD ["node", "dist/index.js"]
