# GameVault Mobile

A native Android (and iOS-compatible, though untested) client for
GameVault, built with Expo/React Native. It supports two independent
modes, chosen the first time the app is opened:

- **Connect to a server** — sign in with a username/password against an
  existing GameVault instance (the same Next.js app in the repo root) and
  read/write your collection through its REST API.
- **This device only** — no server at all. The collection lives in a
  SQLite database on the phone, and nothing ever leaves the device.

Mode is chosen once and persisted; switching later (Settings → Switch
mode / Disconnect) starts from that mode's own storage, so it's not a
sync between the two — they're two separate collections.

## How it's built

Every screen is written against one `DataSource` interface
(`src/data/DataSource.ts`):

```
DataSource
├── RemoteDataSource   — fetch() calls to <server>/api/games, /api/wishlist, ...
└── LocalDataSource    — expo-sqlite, a `games` table mirroring the server's schema
```

`AppModeContext` (`src/state/AppModeContext.tsx`) owns which mode is
active and hands out the right `DataSource` instance; screens never know
or care which backend they're talking to.

### Auth

The web app authenticates with an httpOnly session cookie, which native
apps can't rely on persisting across restarts. So the server now also
accepts `Authorization: Bearer <token>`, and `POST /api/auth/login`
returns that same token in its JSON body. This is an additive change to
the server (`lib/session.ts`, `middleware.ts`,
`app/api/auth/login/route.ts`) — the web app still uses the cookie as
before and ignores the token field. **You need this change deployed on
your GameVault server before "Connect to a server" mode will work.**

### What's implemented vs. roadmap

This first pass covers the core collection workflow end-to-end in both
modes: browse/search your collection, wishlist, add/edit/delete a game,
view a game's details (including trophies/achievements, read-only, when
the server has synced them), and local-mode backup export/import.

Not yet ported to mobile (all exist in the web app and are natural
follow-ups, each behind its own screen there):
- IGDB search / Game Picker / Discover / Calendar / Currently Free
- Triggering Steam achievement / PSN trophy syncs (viewing already-synced
  results works in server mode; kicking off a new scan doesn't yet)
- Multi-select bulk actions, admin/invite management, instance Settings

## Requirements

- Node.js 18+
- An Expo account (free) for building — [expo.dev](https://expo.dev)
- **No local Android SDK needed.** Builds run in Expo's cloud (EAS
  Build); you only need `npx` locally.

## Running in development

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app on an Android phone (or run an
emulator with `npm run android` if you have Android Studio installed
locally). Hot reload works as normal.

## Building an installable APK

```bash
cd mobile
npx eas login          # once, creates/links your free Expo account
npx eas build:configure # once, links this project to your Expo account
npm run build:apk       # eas build -p android --profile preview
```

This builds in Expo's cloud and gives you a direct APK download link
when it finishes (a few minutes) — no local Android SDK, emulator, or
Android Studio required. Install the APK on a device with
"Install unknown apps" allowed for your browser/file manager.

`eas.json`'s `preview` profile is set to `buildType: apk` specifically
(EAS defaults to the Play-Store `.aab` format otherwise). Use the
`production` profile instead when you're ready to publish to the Play
Store.

### Building locally instead (advanced)

If you'd rather not use EAS Build, `npx expo prebuild -p android`
generates a standard `android/` Gradle project you can build yourself
with `./gradlew assembleRelease` — but that requires a full local Android
SDK + build-tools install (Android Studio is the easiest way to get one).

## Project layout

```
mobile/
  App.tsx                    entry point
  src/
    types/game.ts             shared Game/GameInput types (mirrors prisma/schema.prisma)
    data/
      DataSource.ts            the shared interface
      RemoteDataSource.ts      REST client for a hosted server
      LocalDataSource.ts       on-device SQLite
      sqlite/schema.ts         table definition + row<->Game mapping
    state/AppModeContext.tsx   mode selection, auth token storage, active DataSource
    navigation/                React Navigation stacks/tabs
    screens/                   Welcome, ServerConnect, Collection, Wishlist,
                                GameDetail, AddEditGame, Settings
    components/                GameCard, GameGrid, EmptyState
    theme/colors.ts
```
