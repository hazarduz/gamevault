import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Every failure path in here returns JSON. The client does
// `await res.json()` before checking res.ok, so if this route ever
// responds with HTML (a 500 error page, a 404, an auth redirect body)
// the browser throws "Unexpected token '<'" and the real cause is lost.
// Wrapping the whole handler — including req.json() and the dynamic
// import of the scraper module — guarantees the actual error message
// reaches the UI.
export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Request body was not valid JSON" }, { status: 400 });
    }

    const { gameId, title } = body ?? {};
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    // Imported here rather than at module scope: if lib/hltb (or the
    // "howlongtobeat" package it pulls in) throws while loading, that
    // becomes a catchable error instead of a module-eval crash that
    // takes the whole route down with an HTML 500.
    const { searchHltb } = await import("@/lib/hltb");

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
    return NextResponse.json(
      { error: e?.message || String(e), detail: e?.stack ?? null },
      { status: 502 }
    );
  }
}
