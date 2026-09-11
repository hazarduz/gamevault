import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getUserPrefs } from "@/lib/prefs";

export const dynamic = "force-dynamic";

const TIME_BUDGET_MS = 45_000;

// POST /api/retroachievements/sync-all — refresh every already-linked
// game. Time-budgeted like the Steam/PSN equivalents: works through as
// many as it can in ~45s and reports how many are left.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const prefs = await getUserPrefs(user.id);
  const creds = { raEnabled: prefs.raEnabled, raUsername: prefs.raUsername, raApiKey: prefs.raApiKey };
  if (!creds.raEnabled) {
    return NextResponse.json({ error: "RetroAchievements sync is turned off in Settings." }, { status: 400 });
  }
  if (!creds.raUsername || !creds.raApiKey) {
    return NextResponse.json(
      { error: "No RetroAchievements username/API key set — add both in Settings." },
      { status: 400 }
    );
  }

  const games = await prisma.game.findMany({
    where: { userId: user.id, raGameId: { not: null } },
    select: { id: true, title: true, raGameId: true, raSyncedAt: true },
    orderBy: { raSyncedAt: "asc" },
  });

  if (games.length === 0) {
    return NextResponse.json({ synced: 0, remaining: 0, errors: [] });
  }

  const { applyRaSync } = await import("@/lib/retroachievements");

  const started = Date.now();
  let synced = 0;
  let processed = 0;
  const errors: { title: string; message: string }[] = [];

  for (const g of games) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    processed++;
    if (!g.raGameId) continue;
    try {
      await applyRaSync(g.id, g.raGameId, creds);
      synced++;
    } catch (e: any) {
      errors.push({ title: g.title, message: e?.message || String(e) });
    }
  }

  return NextResponse.json({ synced, remaining: games.length - processed, errors });
}
