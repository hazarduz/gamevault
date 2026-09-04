import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getUserPrefs } from "@/lib/prefs";

export const dynamic = "force-dynamic";

// POST /api/games/[id]/sync-trophies — refresh one already-linked game's
// trophy list. Backs the "Refresh trophies" button on the game detail
// page. Not linked yet? Link it from Settings -> PlayStation trophies
// first (that flow does the fuzzy title matching this route skips).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const game = await prisma.game.findUnique({ where: { id: params.id } });
  if (!game || game.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!game.psnNpCommunicationId) {
    return NextResponse.json(
      { error: "Not linked to a PSN title yet — link it from Settings first." },
      { status: 400 }
    );
  }

  try {
    const prefs = await getUserPrefs(user.id);
    const { applyTrophySync } = await import("@/lib/psn");
    const result = await applyTrophySync(
      {
        psnEnabled: prefs.psnEnabled,
        psnOnlineId: prefs.psnOnlineId,
        psnNpsso: prefs.psnNpsso,
      },
      game.id,
      game.psnNpCommunicationId,
      (game.psnNpServiceName as "trophy" | "trophy2") ?? "trophy",
      game.title
    );
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }
}
