import { NextRequest, NextResponse } from "next/server";
import { searchHltb } from "@/lib/hltb";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { gameId, title } = await req.json();

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  try {
    const results = await searchHltb(title);
    if (results.length === 0) {
      return NextResponse.json({ error: "No HowLongToBeat match found" }, { status: 404 });
    }

    const best = results[0];

    if (gameId) {
      await prisma.game.update({
        where: { id: gameId },
        data: {
          hltbMainHours: best.mainHours,
          hltbMainExtraHours: best.mainExtraHours,
          hltbCompletionistHours: best.completionistHours,
          hltbUpdatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ matched: best, alternatives: results.slice(1, 5) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
