import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getUserPrefs } from "@/lib/prefs";

export const dynamic = "force-dynamic";

interface LinkRequest {
  npCommunicationId: string;
  npServiceName: "trophy" | "trophy2";
  psnName: string;
  gameId: string;
}

// POST /api/psn/apply { links: [{ npCommunicationId, npServiceName, psnName, gameId }] }
// Links each chosen PSN title to its collection game and pulls its full
// trophy list (definitions + this account's earned status/dates). Two
// PSN calls per link, done sequentially — this only runs the handful the
// user actually ticked in the review table, not the whole library.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

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
    if (
      typeof l?.npCommunicationId === "string" &&
      l.npCommunicationId &&
      (l?.npServiceName === "trophy" || l?.npServiceName === "trophy2") &&
      typeof l?.gameId === "string" &&
      l.gameId
    ) {
      clean.push({
        npCommunicationId: l.npCommunicationId,
        npServiceName: l.npServiceName,
        psnName: String(l?.psnName ?? "").trim() || "Untitled",
        gameId: l.gameId,
      });
    }
  }
  if (clean.length === 0) {
    return NextResponse.json({ error: "No valid links to apply." }, { status: 400 });
  }

  // Ownership check — only touch games that actually belong to this user.
  const owned = new Set(
    (
      await prisma.game.findMany({
        where: { userId: user.id, id: { in: clean.map((l) => l.gameId) } },
        select: { id: true },
      })
    ).map((g) => g.id)
  );

  const prefs = await getUserPrefs(user.id);
  const creds = {
    psnEnabled: prefs.psnEnabled,
    psnOnlineId: prefs.psnOnlineId,
    psnNpsso: prefs.psnNpsso,
  };

  const { applyTrophySync } = await import("@/lib/psn");

  let linked = 0;
  let platinums = 0;
  const errors: { psnName: string; message: string }[] = [];

  for (const link of clean) {
    if (!owned.has(link.gameId)) {
      errors.push({ psnName: link.psnName, message: "That game isn't in your collection." });
      continue;
    }
    try {
      const result = await applyTrophySync(
        creds,
        link.gameId,
        link.npCommunicationId,
        link.npServiceName,
        link.psnName
      );
      linked++;
      if (result.platinumEarned) platinums++;
    } catch (e: any) {
      errors.push({ psnName: link.psnName, message: e?.message || String(e) });
    }
  }

  return NextResponse.json({ linked, platinums, errors });
}
