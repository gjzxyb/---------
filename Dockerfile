FROM node:22-bookworm-slim AS deps

WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmmirror.com

ENV NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_REGISTRY=${NPM_REGISTRY} \
    NPM_CONFIG_UPDATE_NOTIFIER=false

COPY package.json package-lock.json ./
RUN npm install -g npm@10.9.2 --registry=${NPM_REGISTRY} \
    && npm ci --no-audit --no-fund --registry=${NPM_REGISTRY} \
    && npm cache clean --force

FROM node:22-bookworm-slim AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://postgres:postgres@postgres:5432/teaching_evaluation?schema=public"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV NEXTAUTH_SECRET="build-time-placeholder-change-in-production"

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN ./node_modules/.bin/prisma generate
RUN ./node_modules/.bin/next build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start"]
