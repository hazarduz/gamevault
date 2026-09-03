import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/wishlist { igdbId, platform }
// Creates a wishlist Game row from IGDB detail. Used by the Calendar and
// Discover "Wishlist" buttons.
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body was not valid JSON" }, { status: 400 });
  }

  const igdbId = Number(body?.igdbId);
  const platform = typeof body?.platform === "string" ? body.platform.trim() : "";
  if (!Number.isInteger(igdbId) || igdbId <= 0 || !platform) {
    return NextResponse.json(
      { error: "igdbId (number) and platform (string) are required" },
      { status: 400 }
    );
  }

  const existing = await prisma.game.findUnique({ where: { igdbId } });
  if (existing) {
    return NextResponse.json(
      {
        error: existing.wishlist
          ? "That game is already on your wishlist."
          : "That game is already in your collection.",
      },
      { status: 409 }
    );
  }

  try {
    const { getIgdbGameDetail } = await import("@/lib/igdb");
    const detail = await getIgdbGameDetail(igdbId);

    const game = await prisma.game.create({
      data: {
        title: detail.title,
        platform,
        wishlist: true,
        igdbId: detail.igdbId,
        coverUrl: detail.coverUrl,
        releaseDate: detail.releaseDate ? new Date(detail.releaseDate) : null,
        summary: detail.summary,
        genres: detail.genres,
        developer: detail.developer,
        publisher: detail.publisher,
        aggregatedRating: detail.aggregatedRating,
      },
    });

    return NextResponse.json({ id: game.id, title: game.title }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }
}
