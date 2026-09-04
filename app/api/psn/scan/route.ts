import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getUserPrefs } from "@/lib/prefs";

export const dynamic = "force-dynamic";

// POST /api/psn/scan — read-only. Lists every PSN title on the linked
// account (not just platinum earners — trophy sync is useful for any
// game) with a suggested collection match, skipping games already linked
// to a PSN title. Nothing is written; app/api/psn/apply does that once
// the user confirms which matches to link and sync.
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    // Imported here so a load-time failure in psn-api surfaces as a
    // catchable 502 rather than an HTML 500 for the whole route.
    const { getOwnedPsnTitles, suggestGameId } = await import("@/lib/psn");
    const prefs = await getUserPrefs(user.id);

    const [titles, games] = await Promise.all([
      getOwnedPsnTitles({
        psnEnabled: prefs.psnEnabled,
        psnOnlineId: prefs.psnOnlineId,
        psnNpsso: prefs.psnNpsso,
      }),
      prisma.game.findMany({
        where: { userId: user.id, psnNpCommunicationId: null },
        select: { id: true, title: true, platform: true },
        orderBy: { title: "asc" },
      }),
    ]);

    const linkedCount = await prisma.game.count({
      where: { userId: user.id, psnNpCommunicationId: { not: null } },
    });

    const proposals = titles.map((t) => ({
      npCommunicationId: t.npCommunicationId,
      npServiceName: t.npServiceName,
      psnName: t.name,
      psnPlatform: t.platform,
      iconUrl: t.iconUrl,
      defined: t.defined,
      earned: t.earned,
      suggestedGameId: suggestGameId(t.name, t.platform, games),
    }));

    return NextResponse.json({ proposals, games, linkedCount });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }
}
