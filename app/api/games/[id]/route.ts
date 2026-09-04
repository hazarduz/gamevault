import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isDigitalOnlyPlatform } from "@/lib/platforms";

// Returns the game only if it belongs to the signed-in user; otherwise a
// 404 (never reveal that another user's id exists).
async function ownedGame(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  const game = await prisma.game.findUnique({ where: { id } });
  if (!game || game.userId !== user.id) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { game, user };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const res = await ownedGame(params.id);
  if ("error" in res) return res.error;

  const trophies = res.game.psnNpCommunicationId
    ? await prisma.trophy.findMany({
        where: { gameId: params.id },
        orderBy: [{ groupId: "asc" }, { sortOrder: "asc" }],
      })
    : [];

  return NextResponse.json({ ...res.game, trophies });
}

// Generic partial update — the edit page sends only the fields that changed.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const res = await ownedGame(params.id);
  if ("error" in res) return res.error;

  const body = await req.json();

  // Never let the client move a game to another owner or rewrite ids.
  delete body.id;
  delete body.userId;
  delete body.createdAt;
  delete body.updatedAt;

  const dateFields = ["releaseDate", "datePurchased", "valueUpdatedAt", "hltbUpdatedAt"];
  for (const f of dateFields) {
    if (body[f]) body[f] = new Date(body[f]);
  }

  // PC is digital-only: whether the platform is being changed to PC now
  // or the game is already on PC, pin it to Digital and clear the
  // physical-only fields so an edit can't leave it inconsistent.
  const effectivePlatform =
    typeof body.platform === "string" ? body.platform : res.game.platform;
  if (isDigitalOnlyPlatform(effectivePlatform)) {
    body.format = "Digital";
    body.condition = null;
    body.valueLooseGbp = null;
    body.valueCibGbp = null;
    body.valueNewGbp = null;
    body.valueUpdatedAt = null;
    body.valueSource = null;
  }

  try {
    const game = await prisma.game.update({ where: { id: params.id }, data: body });
    return NextResponse.json(game);
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const res = await ownedGame(params.id);
  if ("error" in res) return res.error;

  await prisma.game.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
