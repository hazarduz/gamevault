import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getUserPrefs } from "@/lib/prefs";
import { getSteamApiKey } from "@/lib/settings";

export const dynamic = "force-dynamic";

// POST /api/games/[id]/sync-achievements — refresh one game's Steam
// achievement list. Uses steamAchievementsAppId if the game was linked
// explicitly, else falls back to steamAppId for a game pulled in via
// Steam library import (auto-linked on first sync). Neither set? Link it
// from Settings -> Steam achievements first.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const game = await prisma.game.findUnique({ where: { id: params.id } });
  if (!game || game.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const appId = game.steamAchievementsAppId ?? game.steamAppId;
  if (!appId) {
    return NextResponse.json(
      { error: "Not linked to a Steam app yet — link it from Settings first." },
      { status: 400 }
    );
  }

  try {
    const apiKey = await getSteamApiKey();
    if (!apiKey) throw new Error("No Steam Web API key set by the admin.");

    const prefs = await getUserPrefs(user.id);
    if (!prefs.steamId) throw new Error("No Steam ID set — add yours in Settings.");

    const { resolveSteamId } = await import("@/lib/steam");
    const { applyAchievementSync } = await import("@/lib/steam-achievements");

    const steamId64 = await resolveSteamId(prefs.steamId, apiKey);
    const result = await applyAchievementSync(game.id, appId, steamId64, apiKey);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }
}
