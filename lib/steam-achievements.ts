// Steam achievement lists and per-account progress, via the official
// Steam Web API — same key already used for library import
// (lib/steam.ts), same per-user SteamID (UserPrefs.steamId).
//
// Unlike PSN, achievement *definitions* are public per app: no play
// history required. That means any game can be linked here — including a
// PS4/PS5 game in the collection, cross-referenced to its Steam release,
// to see what achievements exist even before (or instead of) syncing real
// PSN trophy data. Earned status only comes through if this Steam account
// has actually played that app; otherwise everything shows as not earned,
// which is simply true.
//
// Three endpoints, merged by achievement apiname:
//   ISteamUserStats/GetSchemaForGame       — definitions (name, icon, ...)
//   ISteamUserStats/GetPlayerAchievements  — this account's earned/unlock time
//   ISteamUserStats/GetGlobalAchievementPercentagesForApp — rarity, keyless
// Games with no achievements at all just come back with an empty list —
// not an error.

import { prisma } from "@/lib/prisma";

const STEAM_API = "https://api.steampowered.com";

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s.`)), ms)
    ),
  ]);
}

// --- Searching Steam's app list (for linking a non-Steam-imported game) --

export interface SteamAppEntry {
  appid: number;
  name: string;
}

const APP_LIST_TTL_MS = 7 * 24 * 3_600_000; // a week — the list barely moves

async function fetchAppListFromSteam(): Promise<SteamAppEntry[]> {
  const res = await fetch(`${STEAM_API}/ISteamApps/GetAppList/v2/`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Steam GetAppList returned ${res.status}.`);
  const data: any = await res.json();
  const apps: any[] = data?.applist?.apps ?? [];
  return apps
    .map((a) => ({ appid: Number(a?.appid), name: String(a?.name ?? "").trim() }))
    .filter((a) => Number.isInteger(a.appid) && a.appid > 0 && a.name);
}

export async function getSteamAppList(opts: { force?: boolean } = {}): Promise<SteamAppEntry[]> {
  const cached = await prisma.steamAppCache.findUnique({ where: { id: "singleton" } });
  if (cached && !opts.force && Date.now() - cached.fetchedAt.getTime() < APP_LIST_TTL_MS) {
    const payload = cached.payload as any;
    return Array.isArray(payload?.apps) ? payload.apps : [];
  }

  const apps = await withTimeout(fetchAppListFromSteam(), 30_000, "Steam app list fetch");
  await prisma.steamAppCache.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", payload: { apps } as any, fetchedAt: new Date() },
    update: { payload: { apps } as any, fetchedAt: new Date() },
  });
  return apps;
}

function normalizeAppName(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[™®©]/g, "")
    .replace(/\bthe\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export interface SteamAppMatch extends SteamAppEntry {
  exact: boolean;
}

// Best-effort local search over the cached app list — Steam has no
// name-search endpoint. Exact normalized matches first, then substrings,
// shortest name first (closest to the query, not a bundle/soundtrack).
export function searchSteamAppList(
  query: string,
  apps: SteamAppEntry[],
  limit = 12
): SteamAppMatch[] {
  const target = normalizeAppName(query);
  if (!target) return [];

  const exact: SteamAppMatch[] = [];
  const partial: SteamAppMatch[] = [];

  for (const app of apps) {
    const n = normalizeAppName(app.name);
    if (!n) continue;
    if (n === target) exact.push({ ...app, exact: true });
    else if (n.length > 2 && (n.includes(target) || target.includes(n))) {
      partial.push({ ...app, exact: false });
    }
  }

  partial.sort((a, b) => a.name.length - b.name.length);
  return [...exact, ...partial].slice(0, limit);
}

// --- Syncing one app's achievement list -------------------------------

export interface AchievementRow {
  apiName: string;
  sortOrder: number;
  name: string;
  description: string | null;
  iconUrl: string | null;
  iconGrayUrl: string | null;
  globalPct: number | null;
  earned: boolean;
  earnedAt: string | null; // ISO
}

async function fetchSchema(
  appId: number,
  apiKey: string
): Promise<{ apiName: string; sortOrder: number; name: string; description: string | null; iconUrl: string | null; iconGrayUrl: string | null }[]> {
  const url =
    `${STEAM_API}/ISteamUserStats/GetSchemaForGame/v2/?key=${encodeURIComponent(apiKey)}` +
    `&appid=${appId}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Steam GetSchemaForGame returned ${res.status}.`);
  const data: any = await res.json();
  const list: any[] = data?.game?.availableGameStats?.achievements ?? [];
  return list.map((a, i) => ({
    apiName: String(a?.name ?? "").trim(),
    sortOrder: i,
    name: String(a?.displayName ?? a?.name ?? "Unknown achievement"),
    description: a?.description ?? null,
    iconUrl: a?.icon ?? null,
    iconGrayUrl: a?.icongray ?? null,
  }));
}

async function fetchEarned(
  appId: number,
  steamId64: string,
  apiKey: string
): Promise<Map<string, { achieved: boolean; unlocktime: number }>> {
  const url =
    `${STEAM_API}/ISteamUserStats/GetPlayerAchievements/v1/?key=${encodeURIComponent(apiKey)}` +
    `&steamid=${encodeURIComponent(steamId64)}&appid=${appId}`;
  const map = new Map<string, { achieved: boolean; unlocktime: number }>();
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return map; // e.g. 400 for a game with no stats at all
    const data: any = await res.json();
    if (!data?.playerstats?.success) return map; // never played / private profile
    for (const a of (data.playerstats.achievements ?? []) as any[]) {
      const apiName = String(a?.apiname ?? "").trim();
      if (apiName) {
        map.set(apiName, { achieved: !!a?.achieved, unlocktime: Number(a?.unlocktime ?? 0) });
      }
    }
  } catch {
    // Best-effort — an unlinked/never-played app is a normal case, not a
    // sync failure. The achievement list still comes from the schema call.
  }
  return map;
}

async function fetchGlobalPct(appId: number): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const res = await fetch(
      `${STEAM_API}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${appId}`,
      { cache: "no-store" }
    );
    if (!res.ok) return map;
    const data: any = await res.json();
    for (const a of (data?.achievementpercentages?.achievements ?? []) as any[]) {
      const name = String(a?.name ?? "").trim();
      const pct = Number(a?.percent);
      if (name && Number.isFinite(pct)) map.set(name, pct);
    }
  } catch {
    // Rarity is a nice-to-have; never block a sync on it.
  }
  return map;
}

async function fetchAchievements(
  appId: number,
  steamId64: string,
  apiKey: string
): Promise<AchievementRow[]> {
  const [schema, earned, globalPct] = await Promise.all([
    fetchSchema(appId, apiKey),
    fetchEarned(appId, steamId64, apiKey),
    fetchGlobalPct(appId),
  ]);

  return schema.map((s) => {
    const e = earned.get(s.apiName);
    return {
      ...s,
      globalPct: globalPct.get(s.apiName) ?? null,
      earned: !!e?.achieved,
      earnedAt: e?.achieved && e.unlocktime > 0 ? new Date(e.unlocktime * 1000).toISOString() : null,
    };
  });
}

export function syncSteamAchievements(
  appId: number,
  steamId64: string,
  apiKey: string
): Promise<AchievementRow[]> {
  return withTimeout(fetchAchievements(appId, steamId64, apiKey), 30_000, "Steam achievement sync");
}

// --- Writing a sync result to the database -----------------------------

export interface ApplyAchievementResult {
  gameId: string;
  appId: number;
  achievementCount: number;
  earnedCount: number;
}

// Links `gameId` to Steam app `appId` (if not already) and replaces its
// achievement list with a fresh sync.
export async function applyAchievementSync(
  gameId: string,
  appId: number,
  steamId64: string,
  apiKey: string
): Promise<ApplyAchievementResult> {
  const rows = await syncSteamAchievements(appId, steamId64, apiKey);
  const earnedCount = rows.filter((r) => r.earned).length;

  await prisma.$transaction([
    prisma.achievement.deleteMany({ where: { gameId } }),
    prisma.achievement.createMany({
      data: rows.map((r) => ({
        gameId,
        steamApiName: r.apiName,
        sortOrder: r.sortOrder,
        name: r.name,
        description: r.description,
        iconUrl: r.iconUrl,
        iconGrayUrl: r.iconGrayUrl,
        globalPct: r.globalPct,
        earned: r.earned,
        earnedAt: r.earnedAt ? new Date(r.earnedAt) : null,
      })),
    }),
    prisma.game.update({
      where: { id: gameId },
      data: { steamAchievementsAppId: appId, steamAchievementsSyncedAt: new Date() },
    }),
  ]);

  return { gameId, appId, achievementCount: rows.length, earnedCount };
}
