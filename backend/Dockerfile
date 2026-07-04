# ============================================
# Stage 1: Build TypeScript to JavaScript
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source and compile
COPY . .
RUN npm run build

# ============================================
# Stage 2: Production Runtime
# ============================================
FROM node:20-alpine AS production

# Security: add non-root user
RUN addgroup -g 1001 -S scheduler && \
    adduser -S scheduler -u 1001 -G scheduler

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy compiled application
COPY --from=builder /app/dist ./dist

# Copy database schemas for init
COPY src/database/schema.sql ./src/database/schema.sql
COPY src/database/postgres-schema.sql ./src/database/postgres-schema.sql

# Set ownership
RUN chown -R scheduler:scheduler /app

# Switch to non-root user
USER scheduler

# Expose API port
EXPOSE 5000

# Runtime environment
ENV PORT=5000
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health/liveness || exit 1

CMD ["node", "dist/index.js"]
