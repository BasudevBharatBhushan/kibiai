# ===============================
# 1. Base image
# ===============================
FROM node:20-bullseye AS base
WORKDIR /app
ENV NODE_ENV=production

# Upgrade npm to latest stable version
RUN npm install -g npm@11.5.2

# ===============================
# 2. Install dependencies
# ===============================
FROM base AS deps
COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN npm ci --legacy-peer-deps

# ===============================
# 3. Build stage
# ===============================
FROM base AS builder
# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Turbopack to avoid internal build errors
ENV NEXT_PRIVATE_TURBOPACK=false

# Run Next.js build
RUN npm run build --webpack

# ===============================
# 4. Production image
# ===============================
FROM node:20-bullseye AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy build output and necessary files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src ./src

# Expose Next.js port
EXPOSE 3000

# Run as non-root for safety
USER node

# Start Next.js production server
CMD ["npm", "start"]
