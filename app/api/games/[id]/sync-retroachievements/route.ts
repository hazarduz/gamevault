import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getUserPrefs } from "@/lib/prefs";

export const dynamic = "force-dynamic";

// POST /api/games/[id]/sync-retroachievements — refresh one game's
// RetroAchievements list. Not linked yet? Link it from Settings first.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const game = await prisma.game.findUnique({ where: { id: params.id } });
  if (!game || game.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!game.raGameId) {
    return NextResponse.json(
      { error: "Not linked to a RetroAchievements game yet — link it from Settings first." },
      { status: 400 }
    );
  }

  try {
    const prefs = await getUserPrefs(user.id);
    const creds = { raEnabled: prefs.raEnabled, raUsername: prefs.raUsername, raApiKey: prefs.raApiKey };

    const { applyRaSync } = await import("@/lib/retroachievements");
    const result = await applyRaSync(game.id, game.raGameId, creds);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }
}
