// Per-platform summary stats shown above the collection grid when it's
// filtered to a single platform:
//
//  - PlayStation 4 / PlayStation 5 -> account-wide PSN trophy totals
//    (bronze/silver/gold/platinum + level), from Sony's own trophy-
//    summary endpoint via lib/psn.ts. Cached on UserPrefs for a few
//    hours; refetched on visit once stale, or on demand.
//
//  - PC -> Steam achievement totals aggregated from the PC games already
//    in the collection (their achievements come from the Steam Web API
//    via the per-game sync). No extra API calls here — it just tallies
//    the Achievement rows already stored.

import { prisma } from "@/lib/prisma";
import { isDigitalOnlyPlatform } from "@/lib/platforms";
import { getUserPrefs } from "@/lib/prefs";
import { getPsnTrophySummary, type PsnTrophySummary } from "@/lib/psn";

export const PSN_STATS_PLATFORMS = ["PlayStation 4", "PlayStation 5"];

export function platformStatsKind(
  platform: string | undefined
): "psn" | "steam" | null {
  if (!platform) return null;
  if (PSN_STATS_PLATFORMS.includes(platform)) return "psn";
  if (isDigitalOnlyPlatform(platform)) return "steam";
  return null;
}

const PSN_TTL_MS = 6 * 60 * 60 * 1000;

export interface PsnStats extends PsnTrophySummary {
  fetchedAt: string | null;
  stale: boolean; // true when the cached copy is being shown after a failed refresh
}

// Reads the cached PSN summary, refetching from Sony if it's missing or
// older than the TTL (or when `force`). A failed refresh falls back to
// the last good copy rather than erroring the whole page.
export async function getPsnStats(
  userId: string,
  opts: { force?: boolean } = {}
): Promise<PsnStats | null> {
  const prefs = await getUserPrefs(userId);
  if (!prefs.psnEnabled || !prefs.psnNpsso) return null;

  const cached = prefs.psnTrophySummary as PsnTrophySummary | null;
  const cachedAt = prefs.psnTrophySummaryAt;
  const fresh =
    !opts.force &&
    cached &&
    cachedAt &&
    Date.now() - new Date(cachedAt).getTime() < PSN_TTL_MS;

  if (fresh) {
    return { ...(cached as PsnTrophySummary), fetchedAt: cachedAt!.toISOString(), stale: false };
  }

  try {
    const summary = await getPsnTrophySummary({
      psnEnabled: prefs.psnEnabled,
      psnOnlineId: prefs.psnOnlineId,
      psnNpsso: prefs.psnNpsso,
    });
    const now = new Date();
    await prisma.userPrefs.update({
      where: { userId },
      data: { psnTrophySummary: summary as any, psnTrophySummaryAt: now },
    });
    return { ...summary, fetchedAt: now.toISOString(), stale: false };
  } catch {
    if (cached) {
      return {
        ...(cached as PsnTrophySummary),
        fetchedAt: cachedAt ? cachedAt.toISOString() : null,
        stale: true,
      };
    }
    return null;
  }
}

export interface SteamStats {
  unlocked: number; // achievements earned
  available: number; // achievements defined across the tracked games
  perfectGames: number; // games with every achievement unlocked
  gamesTracked: number; // PC games that have achievement data
  pcGames: number; // PC games in the collection
}

// Tallies the Achievement rows for the collection's PC games. Nothing is
// fetched — a game only counts once its achievements have been synced (on
// its own page, or via "sync all").
export async function getSteamStats(userId: string): Promise<SteamStats> {
  const games = await prisma.game.findMany({
    where: { userId, wishlist: false },
    select: { id: true, platform: true },
  });
  const pcIds = games.filter((g) => isDigitalOnlyPlatform(g.platform)).map((g) => g.id);

  const empty: SteamStats = {
    unlocked: 0,
    available: 0,
    perfectGames: 0,
    gamesTracked: 0,
    pcGames: pcIds.length,
  };
  if (pcIds.length === 0) return empty;

  const rows = await prisma.achievement.groupBy({
    by: ["gameId", "earned"],
    where: { gameId: { in: pcIds } },
    _count: { _all: true },
  });

  const perGame = new Map<string, { earned: number; total: number }>();
  for (const r of rows as { gameId: string; earned: boolean; _count: { _all: number } }[]) {
    const g = perGame.get(r.gameId) ?? { earned: 0, total: 0 };
    g.total += r._count._all;
    if (r.earned) g.earned += r._count._all;
    perGame.set(r.gameId, g);
  }

  let unlocked = 0;
  let available = 0;
  let perfectGames = 0;
  for (const g of perGame.values()) {
    unlocked += g.earned;
    available += g.total;
    if (g.total > 0 && g.earned === g.total) perfectGames++;
  }

  return {
    unlocked,
    available,
    perfectGames,
    gamesTracked: perGame.size,
    pcGames: pcIds.length,
  };
}
