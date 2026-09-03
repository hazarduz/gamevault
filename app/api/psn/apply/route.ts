import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/psn/apply { gameIds: string[] }
// The only write in the PSN flow: sets the chosen games to
// "Platinum Achieved". Never downgrades or touches anything else.
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body was not valid JSON" }, { status: 400 });
  }

  const gameIds: unknown = body?.gameIds;
  if (
    !Array.isArray(gameIds) ||
    gameIds.some((id) => typeof id !== "string" || !id)
  ) {
    return NextResponse.json(
      { error: "gameIds must be a non-empty array of game ids" },
      { status: 400 }
    );
  }

  const ids = Array.from(new Set(gameIds as string[]));
  if (ids.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  const result = await prisma.game.updateMany({
    where: { id: { in: ids } },
    data: { playStatus: "platinum" },
  });

  return NextResponse.json({ updated: result.count });
}
