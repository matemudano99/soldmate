# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/next/package.json ./apps/next/
COPY packages/app/package.json ./packages/app/

RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:28080
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Build the Next.js app
RUN npm run build -w soldmate-next

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ARG NEXT_PUBLIC_API_URL=http://localhost:28080
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY --from=builder /app/apps/next/next.config.mjs ./
COPY --from=builder /app/apps/next/public ./apps/next/public
COPY --from=builder /app/apps/next/.next/standalone ./
COPY --from=builder /app/apps/next/.next/static ./apps/next/.next/static

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "apps/next/server.js"]
