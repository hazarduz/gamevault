import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getUserPrefs } from "@/lib/prefs";
import { parseScoreBands } from "@/lib/score-badge";
import { parseStatusColors, isPlayStatus } from "@/lib/play-status";
import { sortGames, DEFAULT_SORT, isSortValue, type SortValue } from "@/lib/sort-games";
import GameCard from "@/components/GameCard";
import SortSelect from "@/components/SortSelect";
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

  // Preserved across the search form.
  const keep: Record<string, string> = {};
  if (sort !== DEFAULT_SORT) keep.sort = sort;
  if (platform) keep.platform = platform;
  if (status) keep.status = status;
  if (media) keep.media = media;

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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:[grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
          {games.map((g) => (
            <GameCard
              key={g.id}
              id={g.id}
              title={g.title}
              platform={g.platform}
              coverUrl={g.coverUrl}
              valueCibGbp={g.valueCibGbp ? Number(g.valueCibGbp) : null}
              valueLooseGbp={g.valueLooseGbp ? Number(g.valueLooseGbp) : null}
              score={g.aggregatedRating}
              scoreBadgeEnabled={prefs.scoreBadgeEnabled}
              scoreBands={scoreBands}
              playStatus={g.playStatus}
              statusBadgeEnabled={prefs.statusBadgeEnabled}
              statusColors={statusColors}
              dimCompleted={prefs.dimCompleted}
              dimStrength={prefs.dimStrength}
              format={g.format}
            />
          ))}
        </div>
      )}
    </div>
  );
}
