# PrintForge API Dockerfile
FROM node:20-alpine AS base

# Install dependencies
RUN apk add --no-cache libc6-compat openssl

# Install PrusaSlicer for slicing functionality
RUN apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/edge/testing prusa-slicer

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source code
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY tsconfig.base.json ./

# Build shared package
RUN cd packages/shared && pnpm build

# Create slicer profiles directory
RUN mkdir -p /app/slicer-profiles

# Expose port
EXPOSE 3001

# Start development server
CMD ["pnpm", "--filter", "@printforge/api", "dev"]
