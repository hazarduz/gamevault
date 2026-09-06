import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import GameCard from "@/components/GameCard";

export const dynamic = "force-dynamic";

export default async function PlayListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const games = await prisma.game.findMany({
    where: { userId: user.id, playlist: true },
    orderBy: [{ dateAdded: "desc" }, { title: "asc" }],
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-parchment">Play List</h1>
      <p className="mt-1 text-sm text-mute">
        {games.length} {games.length === 1 ? "game" : "games"} you want to get
        round to playing — owned or not. Manage each from its own page.
      </p>

      {games.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-ink-line py-24 text-center">
          <p className="font-display text-lg text-parchment">
            Nothing on your play list yet.
          </p>
          <p className="mt-2 text-sm text-mute">
            Add games from the{" "}
            <Link href="/picker" className="text-amber underline">
              Game Picker
            </Link>
            , or from any game&rsquo;s own page.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:[grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
          {games.map((g) => (
            <GameCard
              key={g.id}
              id={g.id}
              title={g.title}
              platform={g.platform}
              coverUrl={g.coverUrl}
              playlist
              releaseDate={g.releaseDate ? g.releaseDate.toISOString() : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
