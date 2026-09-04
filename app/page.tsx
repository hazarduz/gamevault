import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getUserPrefs } from "@/lib/prefs";
import { parseScoreBands } from "@/lib/score-badge";
import { parseStatusColors, isPlayStatus } from "@/lib/play-status";
import { sortGames, DEFAULT_SORT, isSortValue, type SortValue } from "@/lib/sort-games";
import { DEFAULT_VIEW, isViewMode, type ViewMode } from "@/lib/view-mode";
import CollectionGrid from "@/components/CollectionGrid";
import SortSelect from "@/components/SortSelect";
import ViewSelect from "@/components/ViewSelect";
import FilterBar from "@/components/FilterBar";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    sort?: string;
    platform?: string;
    status?: string;
    media?: string;
    view?: string;
  };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const q = searchParams.q?.trim();
  const platform = searchParams.platform?.trim() || undefined;
  const status = isPlayStatus(searchParams.status?.trim())
    ? searchParams.status!.trim()
    : undefined;
  const media =
    searchParams.media === "Physical" || searchParams.media === "Digital"
      ? searchParams.media
      : undefined;
  const sort: SortValue = isSortValue(searchParams.sort) ? searchParams.sort : DEFAULT_SORT;
  const view: ViewMode = isViewMode(searchParams.view) ? searchParams.view : DEFAULT_VIEW;
  const filtered = !!(q || platform || status || media);

  const prefs = await getUserPrefs(user.id);
  const scoreBands = parseScoreBands(prefs.scoreBadgeBands);
  const statusColors = parseStatusColors(prefs.statusColors);

  const [games, platformRows] = await Promise.all([
    prisma.game
      .findMany({
        where: {
          userId: user.id,
          wishlist: false,
          ...(platform ? { platform } : {}),
          ...(status ? { playStatus: status } : {}),
          ...(media ? { format: media } : {}),
          ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
        },
      })
      .then((rows) => sortGames(rows, sort)),
    prisma.game.findMany({
      where: { userId: user.id, wishlist: false },
      select: { platform: true },
      distinct: ["platform"],
      orderBy: { platform: "asc" },
    }),
  ]);

  // Earned/total per linked game, for the badge on each card. Grouped
  // rather than included per-game so collections with no PSN/Steam links
  // (the common case) skip both tables entirely. PSN trophies win when a
  // game has both (e.g. a PS5 game cross-linked to Steam for reference) —
  // they're the game's actual platform, not a reference list.
  async function groupCounts(
    model: "trophy" | "achievement",
    ids: string[]
  ): Promise<Record<string, { earned: number; total: number }>> {
    const out: Record<string, { earned: number; total: number }> = {};
    if (ids.length === 0) return out;
    const rows = await (prisma[model] as any).groupBy({
      by: ["gameId", "earned"],
      where: { gameId: { in: ids } },
      _count: { _all: true },
    });
    for (const r of rows as { gameId: string; earned: boolean; _count: { _all: number } }[]) {
      const c = out[r.gameId] ?? (out[r.gameId] = { earned: 0, total: 0 });
      c.total += r._count._all;
      if (r.earned) c.earned += r._count._all;
    }
    return out;
  }

  const trophyCounts = await groupCounts(
    "trophy",
    games.filter((g) => g.psnNpCommunicationId).map((g) => g.id)
  );
  const achievementCounts = await groupCounts(
    "achievement",
    games.filter((g) => g.steamAchievementsAppId || g.steamAppId).map((g) => g.id)
  );

  // Preserved across the search form.
  const keep: Record<string, string> = {};
  if (sort !== DEFAULT_SORT) keep.sort = sort;
  if (platform) keep.platform = platform;
  if (status) keep.status = status;
  if (media) keep.media = media;
  if (view !== DEFAULT_VIEW) keep.view = view;

  const totalValue = games.reduce((sum, g) => {
    if (g.format === "Digital") return sum;
    const v = g.valueCibGbp ?? g.valueLooseGbp;
    return sum + (v ? Number(v) : 0);
  }, 0);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-parchment">
            Your collection
          </h1>
          <p className="mt-1 text-sm text-mute">
            {games.length} {games.length === 1 ? "game" : "games"} · worth an
            estimated{" "}
            <span className="text-amber">£{totalValue.toFixed(2)}</span>
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Suspense fallback={null}>
              <FilterBar platforms={platformRows.map((r) => r.platform)} />
            </Suspense>
            <Suspense fallback={null}>
              <SortSelect current={sort} />
            </Suspense>
            <Suspense fallback={null}>
              <ViewSelect current={view} />
            </Suspense>
          </div>
          <form action="/" className="w-full sm:w-72">
            {Object.entries(keep).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search your collection…"
              className="field"
            />
          </form>
        </div>
      </div>

      {games.length === 0 ? (
        <div className="rounded-card border border-dashed border-ink-line py-24 text-center">
          <p className="font-display text-lg text-parchment">
            {filtered ? "Nothing matches those filters." : "Your shelf is empty."}
          </p>
          <p className="mt-2 text-sm text-mute">
            {filtered
              ? "Loosen a filter or clear the search."
              : "Start by adding your first game."}
          </p>
          {!filtered && (
            <Link href="/games/add" className="btn-primary mt-6 inline-block">
              Add a game
            </Link>
          )}
        </div>
      ) : (
        <CollectionGrid
          games={games.map((g) => ({
            id: g.id,
            title: g.title,
            platform: g.platform,
            coverUrl: g.coverUrl,
            valueCibGbp: g.valueCibGbp ? Number(g.valueCibGbp) : null,
            valueLooseGbp: g.valueLooseGbp ? Number(g.valueLooseGbp) : null,
            score: g.aggregatedRating,
            playStatus: g.playStatus,
            format: g.format,
            trophies: trophyCounts[g.id] ?? achievementCounts[g.id] ?? null,
            hltbMainHours: g.hltbMainHours,
            hltbCompletionistHours: g.hltbCompletionistHours,
          }))}
          prefs={{
            scoreBadgeEnabled: prefs.scoreBadgeEnabled,
            scoreBands,
            statusBadgeEnabled: prefs.statusBadgeEnabled,
            statusColors,
            dimCompleted: prefs.dimCompleted,
            dimPlayedPreviously: prefs.dimPlayedPreviously,
            dimStrength: prefs.dimStrength,
          }}
          view={view}
        />
      )}
    </div>
  );
}
