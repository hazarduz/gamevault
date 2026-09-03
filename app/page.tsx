import { prisma } from "@/lib/prisma";
import GameCard from "@/components/GameCard";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = searchParams.q?.trim();

  const games = await prisma.game.findMany({
    where: q ? { title: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { title: "asc" },
  });

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
        <form action="/" className="w-full sm:w-72">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search your collection…"
            className="field"
          />
        </form>
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
              metacriticScore={g.metacriticScore}
            />
          ))}
        </div>
      )}
    </div>
  );
}
