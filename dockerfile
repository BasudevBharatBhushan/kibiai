# ===============================
# 1. Base image
# ===============================
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

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
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js build (src-based project)
RUN npm run build

# ===============================
# 4. Production image
# ===============================
FROM node:20-alpine AS runner
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

# Start the Next.js production server
CMD ["npm", "start"]
