// RetroAchievements' public Web API — no scraping. Covers classic/retro
// consoles only (SNES, NES, PS1, GBA, Genesis, ...); modern platforms
// (PS5, Xbox Series X, current PC releases) simply have no RA console
// counterpart and are skipped everywhere linking is offered.
//
// Auth is a per-account Web API key, generated at
// retroachievements.org/settings and pasted into Settings alongside the
// RA username — both are per-user (unlike Steam's instance-wide key).
// Every call appends `z={username}&y={apiKey}`.
//
// Unlike Steam, RA has no numeric-id-to-name mapping worth hardcoding:
// console ids are fetched live via API_GetConsoleIDs.php and cached
// (RaConsoleCache), then matched against GameVault's own platform names
// by normalized substring — the same approach lib/steam-achievements.ts
// uses for app names, just one level up (console instead of game). Each
// console's game list (API_GetGameList.php) is fetched and cached the
// same way Steam's app list is (RaGameCache, one row per console).
//
// NOTE: this integration was written and schema-validated without a live
// RetroAchievements account to test against (this dev environment's
// network policy blocks retroachievements.org outright) — the endpoint
// names, param shapes, and the badge-icon URL convention below are all
// from RA's public API documentation, not a verified live response. If
// something comes back empty or malformed, that's the first place to
// check with a real account.

import { prisma } from "@/lib/prisma";

const RA_API = "https://retroachievements.org/API";
const RA_MEDIA = "https://media.retroachievements.org";

export interface RaCredentials {
  raEnabled: boolean;
  raUsername: string | null;
  raApiKey: string | null;
}

function authQuery(creds: RaCredentials): string {
  if (!creds.raEnabled) {
    throw new Error("RetroAchievements sync is turned off in Settings.");
  }
  if (!creds.raUsername || !creds.raApiKey) {
    throw new Error("No RetroAchievements username/API key set — add both in Settings.");
  }
  return `z=${encodeURIComponent(creds.raUsername)}&y=${encodeURIComponent(creds.raApiKey)}`;
}

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s.`)), ms)
    ),
  ]);
}

async function raFetch<T>(path: string, creds: RaCredentials): Promise<T> {
  const url = `${RA_API}/${path}${path.includes("?") ? "&" : "?"}${authQuery(creds)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`RetroAchievements API returned ${res.status} for ${path.split("?")[0]}.`);
  }
  const data = await res.json();
  // RA returns { Error: "..." } (200 OK) rather than a non-2xx status for
  // a bad key or unknown user — surface it the same as a thrown error.
  if (data && typeof data === "object" && "Error" in data) {
    throw new Error(String((data as any).Error) || "RetroAchievements API returned an error.");
  }
  return data as T;
}

// --- Consoles: cached list, matched against GameVault's platform names --

export interface RaConsole {
  id: number;
  name: string;
}

const CONSOLE_LIST_TTL_MS = 30 * 24 * 3_600_000; // a month — this basically never changes

async function fetchConsoleList(creds: RaCredentials): Promise<RaConsole[]> {
  const raw = await raFetch<any[]>("API_GetConsoleIDs.php", creds);
  return (raw ?? [])
    .map((c) => ({ id: Number(c?.ID), name: String(c?.Name ?? "").trim() }))
    .filter((c) => Number.isInteger(c.id) && c.id > 0 && c.name);
}

export async function getRaConsoleList(
  creds: RaCredentials,
  opts: { force?: boolean } = {}
): Promise<RaConsole[]> {
  const cached = await prisma.raConsoleCache.findUnique({ where: { id: "singleton" } });
  if (cached && !opts.force && Date.now() - cached.fetchedAt.getTime() < CONSOLE_LIST_TTL_MS) {
    const payload = cached.payload as any;
    return Array.isArray(payload?.consoles) ? payload.consoles : [];
  }

  const consoles = await withTimeout(fetchConsoleList(creds), 20_000, "RetroAchievements console list fetch");
  if (consoles.length === 0) {
    throw new Error("RetroAchievements returned an empty console list.");
  }
  await prisma.raConsoleCache.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", payload: { consoles } as any, fetchedAt: new Date() },
    update: { payload: { consoles } as any, fetchedAt: new Date() },
  });
  return consoles;
}

// A handful of GameVault's platform names don't share any words with
// RA's console name ("PlayStation 1" vs RA's "PlayStation") — hinted
// aliases fill the gap; everything else matches by normalized substring.
const PLATFORM_ALIASES: Record<string, string[]> = {
  "PlayStation 1": ["playstation"],
  PSP: ["playstation portable"],
  SNES: ["super nintendo", "super famicom"],
  NES: ["nintendo entertainment system", "famicom"],
  "Nintendo 64": ["nintendo 64", "n64"],
  "Game Boy Advance": ["game boy advance", "gba"],
  "Game Boy Color": ["game boy color", "gbc"],
  "Game Boy": ["game boy"],
  "Nintendo DS": ["nintendo ds"],
  "Nintendo 3DS": ["nintendo 3ds"],
  GameCube: ["gamecube"],
  Wii: ["wii"],
  Xbox: ["xbox"],
  "Xbox 360": ["xbox 360"],
};

function normalize(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Finds the RA console that corresponds to a GameVault platform, or null
// if that platform has no RA equivalent (most modern platforms).
export function matchConsoleForPlatform(platform: string, consoles: RaConsole[]): RaConsole | null {
  const hints = PLATFORM_ALIASES[platform] ?? [normalize(platform)];
  for (const hint of hints) {
    const target = normalize(hint);
    const match = consoles.find((c) => {
      const n = normalize(c.name);
      return n === target || n.includes(target) || target.includes(n);
    });
    if (match) return match;
  }
  return null;
}

// --- Per-console game list: cached, searched locally (RA has no --------
// --- cross-console name-search endpoint) --------------------------------

export interface RaGameEntry {
  id: number;
  title: string;
  iconUrl: string | null;
}

const GAME_LIST_TTL_MS = 7 * 24 * 3_600_000; // a week

async function fetchGameList(consoleId: number, creds: RaCredentials): Promise<RaGameEntry[]> {
  const raw = await raFetch<any[]>(`API_GetGameList.php?i=${consoleId}`, creds);
  return (raw ?? [])
    .map((g) => ({
      id: Number(g?.ID),
      title: String(g?.Title ?? "").trim(),
      iconUrl: g?.ImageIcon ? `${RA_MEDIA}${g.ImageIcon}` : null,
    }))
    .filter((g) => Number.isInteger(g.id) && g.id > 0 && g.title);
}

export async function getRaGameList(
  consoleId: number,
  creds: RaCredentials,
  opts: { force?: boolean } = {}
): Promise<RaGameEntry[]> {
  const key = String(consoleId);
  const cached = await prisma.raGameCache.findUnique({ where: { consoleId: key } });
  if (cached && !opts.force && Date.now() - cached.fetchedAt.getTime() < GAME_LIST_TTL_MS) {
    const payload = cached.payload as any;
    return Array.isArray(payload?.games) ? payload.games : [];
  }

  const games = await withTimeout(
    fetchGameList(consoleId, creds),
    30_000,
    "RetroAchievements game list fetch"
  );
  await prisma.raGameCache.upsert({
    where: { consoleId: key },
    create: { consoleId: key, payload: { games } as any, fetchedAt: new Date() },
    update: { payload: { games } as any, fetchedAt: new Date() },
  });
  return games;
}

function normalizeTitleForMatch(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(EDITION_RE, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const EDITION_RE =
  /\b(?:standard|deluxe|collector'?s?|complete|definitive|ultimate|special|limited|goty|game of the year)\b(?:\s+edition)?/gi;

export interface RaGameMatch extends RaGameEntry {
  exact: boolean;
}

export function searchRaGameList(query: string, games: RaGameEntry[], limit = 8): RaGameMatch[] {
  const target = normalizeTitleForMatch(query);
  if (!target) return [];

  const exact: RaGameMatch[] = [];
  const partial: RaGameMatch[] = [];

  for (const g of games) {
    const n = normalizeTitleForMatch(g.title);
    if (!n) continue;
    if (n === target) exact.push({ ...g, exact: true });
    else if (n.length > 2 && (n.includes(target) || target.includes(n))) {
      partial.push({ ...g, exact: false });
    }
  }

  partial.sort((a, b) => a.title.length - b.title.length);
  return [...exact, ...partial].slice(0, limit);
}

// --- Syncing one game's achievement list -------------------------------

export interface RaAchievementRow {
  raAchievementId: number;
  sortOrder: number;
  name: string;
  description: string | null;
  iconUrl: string | null;
  points: number;
  earned: boolean;
  earnedAt: string | null; // ISO
  hardcore: boolean;
}

// API_GetGameInfoAndUserProgress.php returns both the achievement
// definitions AND this account's earned status/dates in one call — no
// separate schema + earned-status merge needed, unlike Steam.
async function fetchGameProgress(
  raGameId: number,
  creds: RaCredentials
): Promise<RaAchievementRow[]> {
  const data = await raFetch<any>(
    `API_GetGameInfoAndUserProgress.php?g=${raGameId}&u=${encodeURIComponent(creds.raUsername!)}`,
    creds
  );
  const achievements = data?.Achievements ?? {};

  return Object.values(achievements)
    .map((a: any): RaAchievementRow | null => {
      const raAchievementId = Number(a?.ID);
      if (!Number.isInteger(raAchievementId)) return null;
      const earnedAt = a?.DateEarnedHardcore || a?.DateEarned || null;
      const badge = a?.BadgeName ? String(a.BadgeName) : null;
      return {
        raAchievementId,
        sortOrder: Number(a?.DisplayOrder ?? 0),
        name: String(a?.Title ?? "Unknown achievement"),
        description: a?.Description ?? null,
        iconUrl: badge ? `${RA_MEDIA}/Badge/${badge}${earnedAt ? "" : "_lock"}.png` : null,
        points: Number(a?.Points ?? 0),
        earned: !!earnedAt,
        // RA gives these as "YYYY-MM-DD HH:MM:SS" (server local, no
        // timezone) — good enough for display/sort without a real offset.
        earnedAt: earnedAt ? new Date(`${earnedAt}Z`).toISOString() : null,
        hardcore: !!a?.DateEarnedHardcore,
      };
    })
    .filter((r): r is RaAchievementRow => r !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function syncRaAchievements(
  raGameId: number,
  creds: RaCredentials
): Promise<RaAchievementRow[]> {
  return withTimeout(fetchGameProgress(raGameId, creds), 30_000, "RetroAchievements sync");
}

// --- Writing a sync result to the database -----------------------------

export interface ApplyRaSyncResult {
  gameId: string;
  raGameId: number;
  achievementCount: number;
  earnedCount: number;
}

export async function applyRaSync(
  gameId: string,
  raGameId: number,
  creds: RaCredentials
): Promise<ApplyRaSyncResult> {
  const rows = await syncRaAchievements(raGameId, creds);
  const earnedCount = rows.filter((r) => r.earned).length;

  await prisma.$transaction([
    prisma.retroAchievement.deleteMany({ where: { gameId } }),
    prisma.retroAchievement.createMany({
      data: rows.map((r) => ({
        gameId,
        raAchievementId: r.raAchievementId,
        sortOrder: r.sortOrder,
        name: r.name,
        description: r.description,
        iconUrl: r.iconUrl,
        points: r.points,
        earned: r.earned,
        earnedAt: r.earnedAt ? new Date(r.earnedAt) : null,
        hardcore: r.hardcore,
      })),
    }),
    prisma.game.update({
      where: { id: gameId },
      data: { raGameId, raSyncedAt: new Date() },
    }),
  ]);

  return { gameId, raGameId, achievementCount: rows.length, earnedCount };
}

export async function unlinkRaAchievements(gameId: string): Promise<void> {
  await prisma.$transaction([
    prisma.retroAchievement.deleteMany({ where: { gameId } }),
    prisma.game.update({
      where: { id: gameId },
      data: { raGameId: null, raSyncedAt: null },
    }),
  ]);
}

// --- Account-wide summary (points/rank), shown on the Achievements page -

export interface RaUserSummary {
  totalPoints: number;
  totalTruePoints: number;
  rank: number | null;
}

export async function getRaUserSummary(creds: RaCredentials): Promise<RaUserSummary> {
  const data = await raFetch<any>(
    `API_GetUserSummary.php?u=${encodeURIComponent(creds.raUsername!)}&g=0&a=0`,
    creds
  );
  return {
    totalPoints: Number(data?.TotalPoints ?? 0),
    totalTruePoints: Number(data?.TotalTruePoints ?? 0),
    rank: data?.Rank != null ? Number(data.Rank) : null,
  };
}
