# PrintForge Admin Dashboard Dockerfile
FROM node:20-alpine AS base

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/admin/package.json apps/admin/
COPY packages/shared/package.json packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source code
COPY packages/shared packages/shared
COPY apps/admin apps/admin
COPY tsconfig.base.json ./

# Build shared package
RUN cd packages/shared && pnpm build

# Expose port
EXPOSE 3002

# Start development server
CMD ["pnpm", "--filter", "@printforge/admin", "dev"]
