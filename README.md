# GameVault

A self-hosted catalogue for your video game collection — physical and digital,
across every platform. Add games, auto-fill artwork and metadata from IGDB, track
what you've played, pull in resale values and completion times, sync your earned
PlayStation platinums, keep a wishlist, browse upcoming releases, and get
recommendations based on what you already own.

It's multi-user: one admin runs the instance and invites other people, and every
account has its own completely separate collection.

## Features

- **Collection grid** with cover art, per-cover badges: an IGDB score circle
  (colour-banded), a play-status dot, a physical/digital media icon, and the
  current value. Filter by platform, sort by name / score / value / date added /
  release date / your rating / play status.
- **Play status** — Unplayed / In Progress / Completed / **Platinum Achieved**
  (with an animated silver trophy). Completed and platinum covers dim. Dot
  colours are yours to set.
- **Media** — Physical or Digital per game. Physical shows a disc or cartridge
  icon depending on the platform; digital shows a cloud. Condition and resale
  value are hidden for digital games.
- **Values** via PriceCharting (loose / CIB / new, scraped and converted to GBP),
  or typed in by hand.
- **Completion times** via HowLongToBeat.
- **PlayStation trophy sync** — point it at your PSN account with an NPSSO token
  and it finds every game where you've earned the platinum, then lets you confirm
  the match and mark them **Platinum Achieved**.
- **Steam library import** — add your Steam Web API key once (admin), then each
  user pastes their SteamID in Settings and pulls their owned games in, matched
  against IGDB for art and metadata. Games come in as Digital / PC, and a re-scan
  skips anything already imported.
- **Currently Free** — a page of free-to-keep games from the Epic Games Store and
  cross-platform giveaway round-ups (GamerPower). Cached in the database and
  refreshed on the first visit after it goes stale (interval set in Settings,
  default 3h), with a "Refresh now" button. Cards flag anything already in your
  collection or wishlist.
- **Wishlist** — games you want, kept off the main grid. "Move to collection"
  when you buy one.
- **Release Calendar** — upcoming games from IGDB, grouped by date, filtered to
  your platforms. Wishlist straight from it, choosing the platform.
- **Discover** and **Indie Discover** — recommendations aggregated from IGDB's
  "similar games" across your whole collection, ranked by recurrence. Indie
  Discover requires IGDB's Indie genre and drops the big publishers. A **Rotate**
  button cycles fresh batches.
- **Add by barcode** — on a phone, photograph a game's barcode; the browser
  decodes it on-device and looks the title up (UPCitemdb) to seed the IGDB
  search.
- **Users & invites** — the admin creates a username and gets a one-time invite
  link; the new person sets their own password and lands in an empty collection.

## Stack

- **Next.js 14** (App Router, TypeScript) — one app serves the UI and the API.
- **Prisma + PostgreSQL** — schema in `prisma/schema.prisma`, no migration files
  (`db push` on every boot).
- **Tailwind CSS** — tokens in `tailwind.config.ts`.
- **Docker Compose** — app + database together.

## Getting started

1. Copy the env template and set a real `SESSION_SECRET` (signs login cookies) —
   `openssl rand -base64 32`:

   ```bash
   cp .env.example .env
   ```

2. (Optional now, can be done later in Settings) Get free IGDB credentials for
   artwork, metadata, Discover and the calendar:
   - https://dev.twitch.tv/console/apps/create — register any app (OAuth Redirect
     URL `http://localhost`, category "Application Integration")
   - Put the **Client ID** / **Client Secret** in `.env` as `TWITCH_CLIENT_ID` /
     `TWITCH_CLIENT_SECRET`.

3. Start it:

   ```bash
   docker compose up --build
   ```

   App on http://localhost:3000. On first boot it creates the tables from the
   Prisma schema.

4. The first account you create is the **admin**. After that, new people join
   only via invite links generated from Settings.

## Users, login & settings

- **Login** — session cookie signed with `jose` (`SESSION_SECRET`), bcrypt
  password hash. No "forgot password" flow: to reset, delete the row from the
  `User` table (deleting the only user re-triggers first-run setup).
- **Invites** — Settings → *Users* (admin only): enter a username, get a link
  (copied to your clipboard), send it over. The link is single-use and expires in
  7 days; regenerate or delete users from the same list. Deleting a user removes
  all their games.
- **Personal settings** (everyone): score-badge colours & ranges, play-status dot
  colours, "dim completed" toggle, PlayStation Online ID + NPSSO token, and your
  own username/password.
- **Site settings** (admin only): enable/disable IGDB, HowLongToBeat,
  PriceCharting, Steam import, the Currently Free page and the barcode lookup;
  the Twitch/IGDB credentials; the Steam Web API key; the Currently Free refresh
  interval; the currency conversion API URL; the barcode API URL. These are
  instance-wide and stored in the database (taking priority over `.env`).

## How the data sources work

None of PriceCharting, HowLongToBeat, PSN or the barcode lookup offer a free
public API, so:

- **`lib/pricecharting.ts`** parses PriceCharting's product pages and converts
  USD → GBP via a keyless FX endpoint (default `open.er-api.com`).
- **`lib/hltb.ts`** calls HowLongToBeat's own search endpoint (it needs a token
  scraped from the site's frontend first).
- **`lib/psn.ts`** uses the `psn-api` package against Sony's real endpoints,
  authenticated with a per-user NPSSO token (lasts ~2 months, then re-paste it).
- **`lib/barcode.ts`** hits UPCitemdb's free tier for a product name, then feeds
  it to IGDB search.

Steam is the exception — **`lib/steam.ts`** uses the official Steam Web API
(`GetOwnedGames` / `ResolveVanityURL`). It needs a free key from
https://steamcommunity.com/dev/apikey, set in Settings or as `STEAM_API_KEY`, and
the target profile's "Game details" privacy set to Public.

- **`lib/free-games.ts`** merges **`lib/gamerpower.ts`** (GamerPower's keyless
  giveaways API) and **`lib/epic-free.ts`** (Epic's own `freeGamesPromotions`
  endpoint), caches the result in the `FreeGamesCache` table, and only refetches
  once it's older than `Settings.freeGamesTtlHours`. `/api/free-games/refresh`
  forces it.

If a site changes shape, that one button starts failing and the rest of the app
keeps working — you can always type the value in. Comments in each file point at
what to check first.

## Local development (without Docker)

```bash
npm install
npm run db:push     # DATABASE_URL must point at a running Postgres
npm run dev
```

## Project structure

```
app/
  page.tsx                   Collection grid (per-user, multi-select + bulk remove)
  free/page.tsx              Currently Free — free-to-keep games, cached feed
  wishlist/page.tsx          Wishlisted games
  calendar/page.tsx          Upcoming releases (IGDB)
  discover/ · indie/         Recommendations from IGDB similar_games
  settings/page.tsx          Personal prefs + (admin) site config & users
  login/ · invite/[token]/   Login / first-run / accept-invite
  games/add/ · games/[id]/   Add form (+ barcode) / detail / edit / enrich
  icon.svg                   The crest — served as the favicon
  api/games/                 Per-user CRUD (ownership-checked)
  api/igdb/search/           IGDB search + detail
  api/enrich/price · hltb/   PriceCharting / HowLongToBeat
  api/psn/scan · apply/      PlayStation platinum sync
  api/steam/scan/            Steam owned-games list (matched client-side)
  api/free-games/refresh/    Force-refresh the Currently Free feed
  api/wishlist/ · platforms/ Wishlist add / owned-platform list
  api/prefs/ · settings/     Per-user prefs / instance settings (admin PATCH)
  api/admin/users/           Invite / regenerate / delete users
  api/auth/                  status / register / login / logout / invite / change-password
lib/
  igdb.ts                    IGDB client — search, detail, upcoming, similar
  pricecharting.ts hltb.ts   Value & completion-time lookups
  psn.ts steam.ts barcode.ts PSN trophies / Steam library / barcode -> name
  free-games.ts gamerpower.ts epic-free.ts   Currently Free feed + its sources
  score-badge.ts play-status.ts media.ts   Badge / status / media helpers
  tenant.ts prefs.ts         Multi-user bootstrap + per-user preferences
  session.ts settings.ts     Current user / instance config
  prisma.ts                  Prisma client singleton
components/                   Sidebar, GameCard, CalendarView, DiscoverGrid, Logo, …
middleware.ts                 Auth gate (redirects to /login; /invite/* is public)
prisma/schema.prisma          Database schema — edit and rebuild to add fields
```

## Customising

- **Add a field**: add it to `prisma/schema.prisma`, rebuild (the container runs
  `prisma db push` on start), then surface it in `app/games/[id]/page.tsx` and
  `app/games/add/page.tsx`.
- **Change the look**: colours, fonts and radii are tokens in
  `tailwind.config.ts`.
- **New data source**: add a `lib/` module following `lib/hltb.ts`, then an API
  route that calls it and writes to the database (ownership-check the game
  against the current user).
