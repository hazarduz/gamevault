import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import type { PickerCandidate } from "@/lib/igdb";

export const dynamic = "force-dynamic";

// GET /api/picker — one random game you could play: either not in your
// collection at all, or in it with an "unplayed" status. Comes with its
// description, rating and platforms. HowLongToBeat times are fetched
// separately (GET /api/hltb) so the pick renders fast. Anything
// wishlisted, already on the play list, or owned-and-played is filtered
// out.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const rows = await prisma.game.findMany({
      where: { userId: user.id, igdbId: { not: null } },
      select: { id: true, igdbId: true, wishlist: true, playlist: true, playStatus: true },
    });

    const exclude = new Set<number>();
    const ownedUnplayed = new Map<number, string>(); // igdbId -> gameId
    for (const g of rows) {
      const id = g.igdbId as number;
      if (g.wishlist || g.playlist || g.playStatus !== "unplayed") {
        exclude.add(id);
      } else {
        // owned, in the collection, still unplayed, not on the play list
        ownedUnplayed.set(id, g.id);
      }
    }

    const { getRandomGames } = await import("@/lib/igdb");

    let picked: PickerCandidate | null = null;
    for (let attempt = 0; attempt < 5 && !picked; attempt++) {
      const batch = await getRandomGames();
      const eligible = batch.filter((c) => !exclude.has(c.igdbId));
      if (eligible.length > 0) {
        picked = eligible[Math.floor(Math.random() * eligible.length)];
      }
    }

    if (!picked) {
      return NextResponse.json({ game: null });
    }

    return NextResponse.json({
      game: picked,
      ownedGameId: ownedUnplayed.get(picked.igdbId) ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }
}
