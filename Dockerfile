# Stage 1: Install dependencies
FROM oven/bun:debian AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile --ignore-scripts

# Stage 2: Production image
FROM oven/bun:debian
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./
COPY tsconfig.json ./
EXPOSE 3000
CMD ["bun", "run", "src/supervisor/index.ts"]
