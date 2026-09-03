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
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm run start"]
