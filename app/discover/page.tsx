import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getSimilarGamesForCollection, type SimilarSuggestion } from "@/lib/igdb";
import DiscoverGrid from "@/components/DiscoverGrid";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const games = await prisma.game.findMany({
    where: { userId: user.id, igdbId: { not: null } },
    select: { igdbId: true, wishlist: true },
  });

  const owned = games.filter((g) => !g.wishlist).map((g) => g.igdbId as number);
  const exclude = new Set(games.map((g) => g.igdbId as number));

  let suggestions: SimilarSuggestion[] = [];
  let error: string | null = null;
  if (owned.length > 0) {
    try {
      suggestions = await getSimilarGamesForCollection(owned, exclude);
    } catch (e: any) {
      error = e?.message || "Couldn't load suggestions from IGDB.";
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-parchment">Discover</h1>
      <p className="mt-1 max-w-2xl text-sm text-mute">
        Games IGDB lists as similar to the ones you own, ranked by how often they
        recur. This can take a few seconds to load.
      </p>

      {error ? (
        <p className="mt-6 rounded-md border border-ink-line bg-ink-soft px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      ) : owned.length === 0 ? (
        <p className="mt-6 text-sm text-mute">
          Add a few games with IGDB data first — Discover works from your
          collection.
        </p>
      ) : suggestions.length === 0 ? (
        <p className="mt-6 text-sm text-mute">
          Not enough overlap yet. Add more games and check back.
        </p>
      ) : (
        <DiscoverGrid suggestions={suggestions} />
      )}
    </div>
  );
}
