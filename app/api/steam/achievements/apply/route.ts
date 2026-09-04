import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getUserPrefs } from "@/lib/prefs";
import { getSettings, getSteamApiKey } from "@/lib/settings";

export const dynamic = "force-dynamic";

interface LinkRequest {
  gameId: string;
  appId: number;
}

// POST /api/steam/achievements/apply { links: [{ gameId, appId }] }
// Links each chosen game to a Steam app and pulls its achievement list
// (definitions plus this account's earned status, if any). One call per
// link — only runs the handful the user actually picked.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const settings = await getSettings();
  if (!settings.steamImportEnabled) {
    return NextResponse.json(
      { error: "Steam integration is turned off in site settings." },
      { status: 400 }
    );
  }
  const apiKey = await getSteamApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "No Steam Web API key set by the admin." }, { status: 400 });
  }

  const prefs = await getUserPrefs(user.id);
  if (!prefs.steamId) {
    return NextResponse.json({ error: "No Steam ID set — add yours in Settings." }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body was not valid JSON" }, { status: 400 });
  }

  const links: unknown = body?.links;
  if (!Array.isArray(links) || links.length === 0) {
    return NextResponse.json({ error: "links must be a non-empty array" }, { status: 400 });
  }

  const clean: LinkRequest[] = [];
  for (const l of links as any[]) {
    const appId = Number(l?.appId);
    if (typeof l?.gameId === "string" && l.gameId && Number.isInteger(appId) && appId > 0) {
      clean.push({ gameId: l.gameId, appId });
    }
  }
  if (clean.length === 0) {
    return NextResponse.json({ error: "No valid links to apply." }, { status: 400 });
  }

  const owned = new Set(
    (
      await prisma.game.findMany({
        where: { userId: user.id, id: { in: clean.map((l) => l.gameId) } },
        select: { id: true },
      })
    ).map((g) => g.id)
  );

  const { resolveSteamId } = await import("@/lib/steam");
  const { applyAchievementSync } = await import("@/lib/steam-achievements");

  let steamId64: string;
  try {
    steamId64 = await resolveSteamId(prefs.steamId, apiKey);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }

  let linked = 0;
  const errors: { gameId: string; message: string }[] = [];

  for (const link of clean) {
    if (!owned.has(link.gameId)) {
      errors.push({ gameId: link.gameId, message: "That game isn't in your collection." });
      continue;
    }
    try {
      await applyAchievementSync(link.gameId, link.appId, steamId64, apiKey);
      linked++;
    } catch (e: any) {
      errors.push({ gameId: link.gameId, message: e?.message || String(e) });
    }
  }

  return NextResponse.json({ linked, errors });
}
