FROM node:20-bookworm-slim AS base
WORKDIR /app

# Prisma's OpenSSL auto-detection is far more reliable on Debian (glibc)
# than on Alpine (musl) — this avoids the whole binary-target guessing
# game entirely.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY prisma ./prisma
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000
# This project deliberately has no migration files (see prisma/schema.prisma).
# `db push` refuses non-interactively whenever a change *could* lose data —
# which includes swapping an index (e.g. igdbId's unique -> the per-user
# compound unique in the multi-user change). --accept-data-loss lets those
# through. Rebuilds here are always deliberate, so this is safe; just review
# schema changes before deploying.
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && npm run start"]
