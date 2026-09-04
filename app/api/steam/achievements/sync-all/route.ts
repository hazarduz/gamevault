import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getUserPrefs } from "@/lib/prefs";
import { getSettings, getSteamApiKey } from "@/lib/settings";

export const dynamic = "force-dynamic";

const TIME_BUDGET_MS = 45_000;

// POST /api/steam/achievements/sync-all — refresh every game with a
// Steam app to pull achievements from. That's any game already linked
// (steamAchievementsAppId) plus, automatically, every game pulled in via
// Steam library import (steamAppId) that hasn't been linked explicitly
// yet — no separate "link" step needed for those. Time-budgeted like the
// PSN equivalent: works through as many as it can in ~45s and reports
// how many are left.
export async function POST() {
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

  const games = await prisma.game.findMany({
    where: {
      userId: user.id,
      OR: [{ steamAchievementsAppId: { not: null } }, { steamAppId: { not: null } }],
    },
    select: { id: true, title: true, steamAchievementsAppId: true, steamAppId: true, steamAchievementsSyncedAt: true },
    orderBy: { steamAchievementsSyncedAt: "asc" },
  });

  if (games.length === 0) {
    return NextResponse.json({ synced: 0, remaining: 0, errors: [] });
  }

  const { resolveSteamId } = await import("@/lib/steam");
  const { applyAchievementSync } = await import("@/lib/steam-achievements");

  let steamId64: string;
  try {
    steamId64 = await resolveSteamId(prefs.steamId, apiKey);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }

  const started = Date.now();
  let synced = 0;
  let processed = 0;
  const errors: { title: string; message: string }[] = [];

  for (const g of games) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    processed++;
    const appId = g.steamAchievementsAppId ?? g.steamAppId;
    if (!appId) continue;
    try {
      await applyAchievementSync(g.id, appId, steamId64, apiKey);
      synced++;
    } catch (e: any) {
      errors.push({ title: g.title, message: e?.message || String(e) });
    }
  }

  return NextResponse.json({ synced, remaining: games.length - processed, errors });
}
