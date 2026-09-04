import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getUserPrefs } from "@/lib/prefs";

export const dynamic = "force-dynamic";

const TIME_BUDGET_MS = 45_000;

// POST /api/psn/sync-all — refresh every game already linked to a PSN
// title (oldest sync first), so previously-linked games pick up newly
// earned trophies without going through the review table again. Time-
// budgeted rather than capped by count: it works through as many as it
// can in ~45s and reports how many are left, so pressing the button
// again on a big library just continues where it left off.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const prefs = await getUserPrefs(user.id);
  const creds = {
    psnEnabled: prefs.psnEnabled,
    psnOnlineId: prefs.psnOnlineId,
    psnNpsso: prefs.psnNpsso,
  };

  const linked = await prisma.game.findMany({
    where: { userId: user.id, psnNpCommunicationId: { not: null } },
    select: { id: true, title: true, psnNpCommunicationId: true, psnNpServiceName: true },
    orderBy: { trophiesSyncedAt: "asc" },
  });

  if (linked.length === 0) {
    return NextResponse.json({ synced: 0, remaining: 0, errors: [] });
  }

  const { applyTrophySync } = await import("@/lib/psn");

  const started = Date.now();
  let synced = 0;
  const errors: { title: string; message: string }[] = [];
  let processed = 0;

  for (const g of linked) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    processed++;
    try {
      await applyTrophySync(
        creds,
        g.id,
        g.psnNpCommunicationId as string,
        (g.psnNpServiceName as "trophy" | "trophy2") ?? "trophy",
        g.title
      );
      synced++;
    } catch (e: any) {
      errors.push({ title: g.title, message: e?.message || String(e) });
    }
  }

  return NextResponse.json({ synced, remaining: linked.length - processed, errors });
}
