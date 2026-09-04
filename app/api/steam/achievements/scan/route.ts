import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// POST /api/steam/achievements/scan — read-only. For every collection
// game that isn't already linked to a Steam app (and wasn't itself
// pulled in from the Steam library, which auto-links), searches Steam's
// cached app list for name matches. Works for any platform — this is how
// a PS4/PS5 game gets cross-linked to its Steam release for a reference
// achievement list. Games already Steam-imported don't need this: "Sync
// achievements" links them automatically.
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const settings = await getSettings();
    if (!settings.steamImportEnabled) {
      return NextResponse.json(
        { error: "Steam integration is turned off in site settings." },
        { status: 400 }
      );
    }

    const games = await prisma.game.findMany({
      where: { userId: user.id, steamAchievementsAppId: null, steamAppId: null },
      select: { id: true, title: true, platform: true },
      orderBy: { title: "asc" },
    });

    const { getSteamAppList, searchSteamAppList } = await import("@/lib/steam-achievements");
    const apps = await getSteamAppList();

    const proposals = games
      .map((g) => ({
        gameId: g.id,
        title: g.title,
        platform: g.platform,
        matches: searchSteamAppList(g.title, apps, 6),
      }))
      .filter((p) => p.matches.length > 0);

    const autoLinkable = await prisma.game.count({
      where: { userId: user.id, steamAppId: { not: null }, steamAchievementsAppId: null },
    });

    return NextResponse.json({ proposals, autoLinkable });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }
}
