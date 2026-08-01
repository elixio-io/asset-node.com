

FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
  chromium \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  dbus \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /tmp/.chromium

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package.json package-lock.json ./

ENV NODE_ENV=development
RUN npm ci

COPY . .

RUN npx vite build && npx tsx scripts/prerender.ts



FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache curl

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

COPY src/server ./src/server
COPY src/db ./src/db
COPY src/models ./src/models
COPY src/lib ./src/lib
COPY src/shared ./src/shared
COPY src/scripts ./src/scripts
COPY scripts/seed-super-admin.ts ./scripts/seed-super-admin.ts
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001


CMD ["npx", "tsx", "src/scripts/entrypoint.ts"]
