# ========================================
# Multi-Stage Dockerfile for KUDA Backend
# ========================================
# Stages: base, dependencies, development, builder, production
# Target stages: development (dev), production (default)

# ========================================
# Stage 1: Base Image
# ========================================
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    curl \
    ffmpeg \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev

WORKDIR /app

# ========================================
# Stage 2: Dependencies
# ========================================
FROM base AS dependencies

# Copy package files
COPY package*.json ./

# Install dependencies with clean install
RUN npm ci --only=production && \
    npm cache clean --force

# Install dev dependencies separately
RUN npm ci

# ========================================
# Stage 3: Development
# ========================================
FROM base AS development

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code
COPY . .

# Create upload and log directories
RUN mkdir -p /app/uploads /app/logs && \
    chmod 777 /app/uploads /app/logs

EXPOSE 4000

# Development command with hot reload
CMD ["npm", "run", "dev"]

# ========================================
# Stage 4: Builder (TypeScript Compilation)
# ========================================
FROM base AS builder

# Copy package files and TypeScript config
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY ./src ./src
COPY ./migrations ./migrations

# Build TypeScript
RUN npm run build

# Verify build output
RUN ls -la dist/

# ========================================
# Stage 5: Production
# ========================================
FROM base AS production

# Install curl for healthcheck
RUN apk add --no-cache curl

# Create non-root user and group
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Create required directories
RUN mkdir -p /app/uploads /app/logs && \
    chown -R nodejs:nodejs /app

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy production dependencies from dependencies stage
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy migrations for runtime migration execution
COPY --from=builder --chown=nodejs:nodejs /app/migrations ./migrations

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:4000/health || exit 1

# Production command
CMD ["node", "dist/server.js"]
