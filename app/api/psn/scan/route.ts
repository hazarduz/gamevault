import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/psn/scan — read-only. Returns the account's earned-platinum
// titles plus a suggested collection game for each, and the full list of
// candidate games. Nothing is written; app/api/psn/apply does that after
// the user confirms. Auth is enforced by middleware.ts.
export async function POST() {
  try {
    // Imported here so a load-time failure in psn-api surfaces as a
    // catchable 502 rather than an HTML 500 for the whole route.
    const { getEarnedPlatinumTitles, suggestGameId } = await import("@/lib/psn");

    const [titles, games] = await Promise.all([
      getEarnedPlatinumTitles(),
      prisma.game.findMany({
        where: { NOT: { playStatus: "platinum" } },
        select: { id: true, title: true, platform: true },
        orderBy: { title: "asc" },
      }),
    ]);

    const proposals = titles.map((t) => ({
      psnName: t.name,
      psnPlatform: t.platform,
      suggestedGameId: suggestGameId(t.name, t.platform, games),
    }));

    return NextResponse.json({
      proposals,
      games,
      platinumCount: titles.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }
}
