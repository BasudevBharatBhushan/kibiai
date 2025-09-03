# ===============================
# 1. Base + deps stage
# ===============================
FROM node:20-bullseye AS deps
WORKDIR /app

# Copy lock files and package.json
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Install dependencies inside Linux container
RUN npm ci --legacy-peer-deps

# Upgrade npm (optional, can be done here)
RUN npm install -g npm@11.5.2

# ===============================
# 2. Build stage
# ===============================
FROM node:20-bullseye AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PRIVATE_TURBOPACK=false

# Build Next.js
RUN npm run build

# ===============================
# 3. Production image
# ===============================
FROM node:20-bullseye AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy build output and necessary files
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

# Use non-root user
USER nextjs

EXPOSE 3000
ENV PORT=3000

CMD ["npm", "start"]
