import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getUserPrefs } from "@/lib/prefs";

export const dynamic = "force-dynamic";

// POST /api/psn/scan — read-only. Returns the user's earned-platinum PSN
// titles plus a suggested collection game for each, and the candidate
// game list. Nothing is written; app/api/psn/apply does that.
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    // Imported here so a load-time failure in psn-api surfaces as a
    // catchable 502 rather than an HTML 500 for the whole route.
    const { getEarnedPlatinumTitles, suggestGameId } = await import("@/lib/psn");
    const prefs = await getUserPrefs(user.id);

    const [titles, games] = await Promise.all([
      getEarnedPlatinumTitles({
        psnEnabled: prefs.psnEnabled,
        psnOnlineId: prefs.psnOnlineId,
        psnNpsso: prefs.psnNpsso,
      }),
      prisma.game.findMany({
        where: { userId: user.id, NOT: { playStatus: "platinum" } },
        select: { id: true, title: true, platform: true },
        orderBy: { title: "asc" },
      }),
    ]);

    const proposals = titles.map((t) => ({
      psnName: t.name,
      psnPlatform: t.platform,
      suggestedGameId: suggestGameId(t.name, t.platform, games),
    }));

    return NextResponse.json({ proposals, games, platinumCount: titles.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }
}
