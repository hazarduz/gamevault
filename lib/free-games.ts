// Aggregates "currently free to keep" games for the /free page.
//
// Sources: GamerPower (cross-platform giveaway aggregator) + the Epic
// Games Store promotions endpoint directly. Both are keyless. Coverage
// is only as good as those two — Steam free-to-keep promos, GOG limited
// giveaways, Xbox Games with Gold, PS Plus monthly and Nintendo eShop
// sales show up only when GamerPower happens to list them.
//
// The merged list is cached in the FreeGamesCache table and only
// refetched when it's older than Settings.freeGamesTtlHours, or when
// something forces it (the "Refresh now" button -> /api/free-games/refresh).

import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export type FreeStore =
  | "Steam"
  | "Epic Games"
  | "GOG"
  | "itch.io"
  | "Xbox"
  | "PlayStation"
  | "Nintendo"
  | "Amazon Prime"
  | "Other";

export interface FreeGame {
  id: string;
  title: string;
  store: FreeStore;
  platformsLabel: string; // raw platform text from the source, for display
  url: string; // where to claim it
  imageUrl: string | null;
  description: string | null;
  worth: string | null; // original price text, e.g. "$19.99"
  startsAt: string | null; // ISO — set for upcoming
  endsAt: string | null; // ISO — when the promo ends (null = unknown)
  type: "game" | "dlc" | "loot" | "other";
  status: "live" | "upcoming";
  source: "gamerpower" | "epic";
}

export interface FreeGamesResult {
  items: FreeGame[];
  fetchedAt: string; // ISO
  stale: boolean; // true when a refresh failed and we served the old cache
  sourceErrors: { source: string; message: string }[];
}

const DEFAULT_TTL_HOURS = 3;
const CACHE_ID = "singleton";

function ttlHours(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_TTL_HOURS;
  return Math.min(168, Math.max(1, Math.round(n)));
}

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[™®©]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Epic-sourced rows win over GamerPower rows for the same Epic game.
function dedupe(items: FreeGame[]): FreeGame[] {
  const seen = new Map<string, FreeGame>();
  for (const item of items) {
    const key = `${item.store}|${normalizeTitle(item.title)}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, item);
      continue;
    }
    if (existing.source !== "epic" && item.source === "epic") {
      seen.set(key, item);
    }
  }
  return [...seen.values()];
}

function sortItems(items: FreeGame[]): FreeGame[] {
  const rank = (i: FreeGame) => (i.status === "live" ? 0 : 1);
  return [...items].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    // Soonest to end first; unknown end dates last.
    const ae = a.endsAt ? Date.parse(a.endsAt) : Infinity;
    const be = b.endsAt ? Date.parse(b.endsAt) : Infinity;
    if (ae !== be) return ae - be;
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  });
}

function fromCache(row: { payload: unknown; fetchedAt: Date }, stale: boolean): FreeGamesResult {
  const payload = (row.payload ?? {}) as {
    items?: FreeGame[];
    sourceErrors?: { source: string; message: string }[];
  };
  return {
    items: Array.isArray(payload.items) ? payload.items : [],
    fetchedAt: row.fetchedAt.toISOString(),
    stale,
    sourceErrors: payload.sourceErrors ?? [],
  };
}

export async function getFreeGames(
  opts: { force?: boolean } = {}
): Promise<FreeGamesResult> {
  const settings = await getSettings();
  if (!settings.freeGamesEnabled) {
    throw new Error("The Currently Free page is turned off in Settings.");
  }

  const ttlMs = ttlHours(settings.freeGamesTtlHours) * 3_600_000;
  const cached = await prisma.freeGamesCache.findUnique({ where: { id: CACHE_ID } });

  if (
    cached &&
    !opts.force &&
    Date.now() - cached.fetchedAt.getTime() < ttlMs
  ) {
    return fromCache(cached, false);
  }

  const { fetchGamerPowerFree } = await import("@/lib/gamerpower");
  const { fetchEpicFree } = await import("@/lib/epic-free");

  const [gp, epic] = await Promise.allSettled([
    fetchGamerPowerFree(),
    fetchEpicFree(),
  ]);

  const items: FreeGame[] = [];
  const sourceErrors: { source: string; message: string }[] = [];

  if (gp.status === "fulfilled") items.push(...gp.value);
  else sourceErrors.push({ source: "GamerPower", message: errText(gp.reason) });

  if (epic.status === "fulfilled") items.push(...epic.value);
  else sourceErrors.push({ source: "Epic Games Store", message: errText(epic.reason) });

  // Total wipeout — keep serving the last good list if we have one.
  if (items.length === 0 && sourceErrors.length > 0 && cached) {
    return { ...fromCache(cached, true), sourceErrors };
  }

  const merged = sortItems(dedupe(items));
  const payload = { items: merged, sourceErrors };
  const now = new Date();

  await prisma.freeGamesCache.upsert({
    where: { id: CACHE_ID },
    create: { id: CACHE_ID, payload: payload as any, fetchedAt: now },
    update: { payload: payload as any, fetchedAt: now },
  });

  return {
    items: merged,
    fetchedAt: now.toISOString(),
    stale: false,
    sourceErrors,
  };
}

function errText(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  return String(reason);
}
