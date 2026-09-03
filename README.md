# GameVault

A self-hosted catalogue for your physical video game collection: add games,
auto-fill cover art and details from IGDB, and pull in current resale value
(PriceCharting, converted to GBP) and completion times (HowLongToBeat).
Everything is stored in your own Postgres database.

## Stack

- **Next.js 14** (App Router, TypeScript) — one app serves both the UI and
  the API routes.
- **Prisma + PostgreSQL** — schema lives in `prisma/schema.prisma`.
- **Tailwind CSS** — styling, tokens in `tailwind.config.ts`.
- **Docker Compose** — runs the app and database together.

## Getting started

1. Copy the environment template and fill it in. At minimum, set a real
   `SESSION_SECRET` (used to sign login cookies) — generate one with
   `openssl rand -base64 32`:

   ```bash
   cp .env.example .env
   ```

2. (Optional at this stage) Get free IGDB credentials — used for cover
   art, release dates, summaries, genres:
   - Go to https://dev.twitch.tv/console/apps/create
   - Register any app (name can be anything, e.g. "GameVault";
     OAuth Redirect URL can be `http://localhost`; Category "Application
     Integration")
   - Copy the **Client ID** and **Client Secret** into `.env` as
     `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` — or skip this and add
     them later from the in-app Settings page instead.

3. Start everything:

   ```bash
   docker compose up --build
   ```

   The app will be available at http://localhost:3000. On first boot it
   automatically creates the database tables from the Prisma schema.

4. The first time you open the app, you'll be asked to create an admin
   account (username + password) — this is the only account, since
   GameVault is built for a single collector. After that, every page and
   API route requires being logged in.

## Login & Settings

- **Login**: session-based, backed by a signed cookie (`SESSION_SECRET`
  in `.env`) and a bcrypt-hashed password in the database. There's no
  "forgot password" flow by design — if you lose the password, connect
  to the database directly and delete the row in the `User` table to
  trigger the first-run setup screen again.
- **Settings page** (gear-style link in the navbar): toggle IGDB,
  HowLongToBeat, and PriceCharting lookups on or off individually, edit
  the Twitch/IGDB Client ID and Secret without redeploying, override the
  currency conversion API URL, and change your username/password. Values
  entered here are stored in the database and take priority over the
  `.env` file, so `.env` just acts as the initial default.

## Using it

- **Add a game**: search by title, pick the right platform/region match
  from IGDB, and it fills in the cover art, summary, genres, developer,
  and publisher automatically. You can also skip the search and type
  everything in by hand.
- **On a game's page**: click "Fetch from PriceCharting" to pull current
  loose/complete/new prices (converted to GBP), or "Fetch from
  HowLongToBeat" to pull completion times. Both can also just be typed in
  directly — useful when a scrape doesn't find the right match, or for
  older/obscure games that aren't listed.
- **Metacritic score** is a manual field for now (Metacritic actively
  blocks scraping), but the field is there and it's exactly the kind of
  thing you can wire up yourself — see "Customising" below.

## Customising

This is intentionally simple to extend:

- **Add a field** (e.g. a "loan status" or a barcode): add it to
  `prisma/schema.prisma`, run `npm run db:push` (or `docker compose exec
  app npx prisma db push`), then surface it in `app/games/[id]/page.tsx`
  and `app/games/add/page.tsx`.
- **Add a new data source**: create a new file in `lib/` following the
  pattern in `lib/pricecharting.ts` or `lib/hltb.ts`, then add an API
  route under `app/api/enrich/` that calls it and updates the database.
- **Change the look**: colours, fonts and radii are all defined as
  tokens in `tailwind.config.ts` — change them once and the whole app
  updates.
- **Scrapers are fragile by nature**: PriceCharting and HowLongToBeat
  don't offer free public APIs, so `lib/pricecharting.ts` and
  `lib/hltb.ts` parse their public pages directly. If either site changes
  its layout, that specific lookup button will start failing — the rest
  of the app keeps working, and you can always fall back to typing the
  value in by hand. Comments in both files point to what to check first.

## Local development (without Docker)

```bash
npm install
npm run db:push     # requires DATABASE_URL to point at a running Postgres
npm run dev
```

## Project structure

```
app/
  page.tsx                  Collection grid (dashboard)
  login/page.tsx             Login / first-run admin setup
  settings/page.tsx          Scraper toggles, credentials, account
  games/add/page.tsx         Add-game form + IGDB search
  games/[id]/page.tsx        Game detail / edit / enrich
  api/games/                 CRUD for games
  api/igdb/search/           IGDB search + detail lookup
  api/enrich/price/          PriceCharting scrape -> GBP values
  api/enrich/hltb/           HowLongToBeat scrape
  api/auth/                  status / register / login / logout / change-password
  api/settings/              Get/update scraper settings
lib/
  igdb.ts                    IGDB/Twitch API client
  pricecharting.ts           PriceCharting scraper + currency conversion
  hltb.ts                    HowLongToBeat scraper
  prisma.ts                  Prisma client singleton
  auth.ts                    Password hashing + session token signing
  session.ts                 Read the logged-in user server-side
  settings.ts                Read/write the Settings row (DB-backed config)
middleware.ts                 Redirects to /login when not authenticated
prisma/schema.prisma          Database schema — edit this to add fields
```
