import Link from "next/link";
import { prisma } from "@/lib/prisma";
import GameCard from "@/components/GameCard";

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const games = await prisma.game.findMany({
    where: { wishlist: true },
    orderBy: [{ releaseDate: "asc" }, { title: "asc" }],
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-parchment">Wishlist</h1>
      <p className="mt-1 text-sm text-mute">
        {games.length} {games.length === 1 ? "game" : "games"} you want. These stay
        off the main collection.
      </p>

      {games.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-ink-line py-24 text-center">
          <p className="font-display text-lg text-parchment">Nothing wishlisted yet.</p>
          <p className="mt-2 text-sm text-mute">
            Add games from{" "}
            <Link href="/calendar" className="text-amber underline">
              the Release Calendar
            </Link>{" "}
            or{" "}
            <Link href="/discover" className="text-amber underline">
              Discover
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {games.map((g) => (
            <GameCard
              key={g.id}
              id={g.id}
              title={g.title}
              platform={g.platform}
              coverUrl={g.coverUrl}
              wishlist
              releaseDate={g.releaseDate ? g.releaseDate.toISOString() : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
