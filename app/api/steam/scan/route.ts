import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getUserPrefs } from "@/lib/prefs";
import { getSettings, getSteamApiKey } from "@/lib/settings";

export const dynamic = "force-dynamic";

// POST /api/steam/scan — read-only. Resolves the user's SteamID, pulls
// their owned games, drops any already imported from Steam before, and
// returns the rest. The client then matches each title against IGDB and
// posts the confirmed rows to /api/games/import. Nothing is written here.
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const [prefs, settings] = await Promise.all([
      getUserPrefs(user.id),
      getSettings(),
    ]);

    if (!settings.steamImportEnabled) {
      return NextResponse.json(
        { error: "Steam import is turned off in site settings." },
        { status: 400 }
      );
    }
    const apiKey = await getSteamApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "No Steam Web API key set — the site admin adds it in Settings." },
        { status: 400 }
      );
    }
    if (!prefs.steamId) {
      return NextResponse.json(
        { error: "No Steam ID set — add yours in Settings above." },
        { status: 400 }
      );
    }

    // Imported here (not at module top) so any load-time problem surfaces
    // as a catchable 502 with a real message, matching lib/psn usage.
    const { resolveSteamId, getOwnedGames } = await import("@/lib/steam");

    const steamId64 = await resolveSteamId(prefs.steamId, apiKey);
    const owned = await getOwnedGames(steamId64, apiKey);

    const alreadyImported = new Set(
      (
        await prisma.game.findMany({
          where: { userId: user.id, steamAppId: { not: null } },
          select: { steamAppId: true },
        })
      ).map((g) => g.steamAppId as number)
    );

    const games = owned
      .filter((g) => !alreadyImported.has(g.appId))
      .map((g) => ({
        steamAppId: g.appId,
        name: g.name,
        playtimeMinutes: g.playtimeMinutes,
      }));

    return NextResponse.json({
      games,
      total: owned.length,
      skipped: owned.length - games.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }
}
