import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getUserPrefs } from "@/lib/prefs";

export const dynamic = "force-dynamic";

// POST /api/games/[id]/relink-psn { npCommunicationId, npServiceName, psnName }
// Points this game at a different (or first) PSN title and re-syncs its
// trophies — the fix for a wrong auto-match. Search candidates come from
// GET /api/psn/search-titles.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const game = await prisma.game.findUnique({ where: { id: params.id } });
  if (!game || game.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body was not valid JSON" }, { status: 400 });
  }

  const npCommunicationId = typeof body?.npCommunicationId === "string" ? body.npCommunicationId : "";
  const npServiceName = body?.npServiceName === "trophy" || body?.npServiceName === "trophy2"
    ? body.npServiceName
    : null;
  const psnName = typeof body?.psnName === "string" ? body.psnName.trim() : "";
  if (!npCommunicationId || !npServiceName) {
    return NextResponse.json(
      { error: "npCommunicationId and npServiceName are required" },
      { status: 400 }
    );
  }

  try {
    const prefs = await getUserPrefs(user.id);
    const { applyTrophySync } = await import("@/lib/psn");
    const result = await applyTrophySync(
      { psnEnabled: prefs.psnEnabled, psnOnlineId: prefs.psnOnlineId, psnNpsso: prefs.psnNpsso },
      game.id,
      npCommunicationId,
      npServiceName,
      psnName || "Untitled"
    );
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }
}

// DELETE /api/games/[id]/relink-psn — unlink without picking a new title.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const game = await prisma.game.findUnique({ where: { id: params.id } });
  if (!game || game.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { unlinkTrophies } = await import("@/lib/psn");
  await unlinkTrophies(game.id);
  return NextResponse.json({ ok: true });
}
