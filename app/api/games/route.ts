import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

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

  const body = await req.json();

  if (!body.title || !body.platform) {
    return NextResponse.json(
      { error: "title and platform are required" },
      { status: 400 }
    );
  }

  const game = await prisma.game.create({
    data: {
      userId: user.id,
      title: body.title,
      platform: body.platform,
      region: body.region ?? null,
      condition: body.condition ?? null,
      format: body.format ?? "Physical",
      playStatus: body.playStatus ?? "unplayed",
      notes: body.notes ?? null,
      igdbId: body.igdbId ?? null,
      coverUrl: body.coverUrl ?? null,
      releaseDate: body.releaseDate ? new Date(body.releaseDate) : null,
      summary: body.summary ?? null,
      genres: body.genres ?? [],
      developer: body.developer ?? null,
      publisher: body.publisher ?? null,
      aggregatedRating: body.aggregatedRating ?? null,
    },
  });

  return NextResponse.json(game, { status: 201 });
}
