import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { formatForPlatform } from "@/lib/platforms";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q");

  const games = await prisma.game.findMany({
    where: {
      userId: user.id,
      wishlist: false,
      ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { title: "asc" },
  });

  return NextResponse.json(games);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body was not valid JSON" }, { status: 400 });
  }

  if (!body.title || !body.platform) {
    return NextResponse.json(
      { error: "title and platform are required" },
      { status: 400 }
    );
  }

  // PC is digital-only — force it regardless of what the client sent.
  const format = formatForPlatform(body.platform, body.format);
  const igdbId = body.igdbId ?? null;

  const data = {
    title: body.title,
    platform: body.platform,
    region: body.region ?? null,
    condition: format === "Digital" ? null : body.condition || null,
    format,
    playStatus: body.playStatus ?? "unplayed",
    notes: body.notes ?? null,
    igdbId,
    coverUrl: body.coverUrl ?? null,
    releaseDate: body.releaseDate ? new Date(body.releaseDate) : null,
    summary: body.summary ?? null,
    genres: body.genres ?? [],
    developer: body.developer ?? null,
    publisher: body.publisher ?? null,
    aggregatedRating: body.aggregatedRating ?? null,
  };

  try {
    // A game picked from IGDB search can already have a row for this
    // user — most often a wishlist entry added earlier from Discover,
    // the Calendar, or the Game Picker. "Add a game" with that same
    // title is really "I wishlisted this, now I own it": graduate the
    // existing row into a full collection entry (with whatever the form
    // just submitted) instead of hitting the (userId, igdbId) unique
    // constraint. An already-owned copy is left alone — overwriting it
    // here could clobber trophies/notes on an unrelated entry.
    const existing = igdbId
      ? await prisma.game.findFirst({ where: { userId: user.id, igdbId } })
      : null;

    if (existing) {
      if (!existing.wishlist) {
        return NextResponse.json(
          { error: "That game is already in your collection." },
          { status: 409 }
        );
      }
      const game = await prisma.game.update({
        where: { id: existing.id },
        data: { ...data, wishlist: false },
      });
      return NextResponse.json(game);
    }

    const game = await prisma.game.create({ data: { ...data, userId: user.id } });
    return NextResponse.json(game, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
