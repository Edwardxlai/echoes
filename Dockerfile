# syntax=docker/dockerfile:1

FROM node:22-slim AS deps
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app/web
COPY --from=deps /app/web/node_modules ./node_modules
COPY web/ ./
RUN npm run build

FROM node:22-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip python-is-python3 \
  && pip install --break-system-packages --no-cache-dir f2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app/web
COPY --from=build /app/web/.next/standalone ./
COPY --from=build /app/web/.next/static ./.next/static
COPY --from=build /app/web/public ./public
COPY scripts/mix_enum.py /app/scripts/mix_enum.py
RUN mkdir -p /app/eval /app/web/data

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
