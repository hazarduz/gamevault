import { Suspense } from "react";
import type { Game } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { parseScoreBands } from "@/lib/score-badge";
import GameCard from "@/components/GameCard";
import SortSelect, { DEFAULT_SORT, isSortValue, type SortValue } from "@/components/SortSelect";
import Link from "next/link";

export const dynamic = "force-dynamic";

type GameRow = Game;

function currentValue(g: GameRow): number | null {
  const v = g.valueCibGbp ?? g.valueLooseGbp ?? g.valueNewGbp;
  return v == null ? null : Number(v);
}

function sortGames(games: GameRow[], sort: SortValue): GameRow[] {
  const byName = (a: GameRow, b: GameRow) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" });

  // Highest first, with missing values pushed to the end and ties broken
  // by title.
  const desc =
    (get: (g: GameRow) => number | null) => (a: GameRow, b: GameRow) => {
      const av = get(a);
      const bv = get(b);
      if (av == null && bv == null) return byName(a, b);
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv - av || byName(a, b);
    };

  const sorted = [...games];
  switch (sort) {
    case "name-desc":
      return sorted.sort((a, b) => byName(b, a));
    case "score-desc":
      return sorted.sort(desc((g) => g.aggregatedRating));
    case "value-desc":
      return sorted.sort(desc(currentValue));
    case "added-desc":
      return sorted.sort(desc((g) => g.dateAdded?.getTime() ?? null));
    case "released-desc":
      return sorted.sort(desc((g) => g.releaseDate?.getTime() ?? null));
    case "rating-desc":
      return sorted.sort(desc((g) => g.personalRating));
    case "name":
    default:
      return sorted.sort(byName);
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string };
}) {
  const q = searchParams.q?.trim();
  const sort: SortValue = isSortValue(searchParams.sort) ? searchParams.sort : DEFAULT_SORT;

  const settings = await getSettings();
  const scoreBands = parseScoreBands(settings.scoreBadgeBands);

  const games = sortGames(
    await prisma.game.findMany({
      where: q ? { title: { contains: q, mode: "insensitive" } } : undefined,
    }),
    sort
  );

  const totalValue = games.reduce((sum, g) => {
    const v = g.valueCibGbp ?? g.valueLooseGbp;
    return sum + (v ? Number(v) : 0);
  }, 0);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Suspense fallback={null}>
            <SortSelect current={sort} />
          </Suspense>
          <form action="/" className="w-full sm:w-72">
            {sort !== DEFAULT_SORT && <input type="hidden" name="sort" value={sort} />}
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
            {q ? "No games match that search." : "Your shelf is empty."}
          </p>
          <p className="mt-2 text-sm text-mute">
            {q ? "Try a different title." : "Start by adding your first game."}
          </p>
          {!q && (
            <Link href="/games/add" className="btn-primary mt-6 inline-block">
              Add a game
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
              scoreBadgeEnabled={settings.scoreBadgeEnabled}
              scoreBands={scoreBands}
            />
          ))}
        </div>
      )}
    </div>
  );
}
