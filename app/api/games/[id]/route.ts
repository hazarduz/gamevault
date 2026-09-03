import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const game = await prisma.game.findUnique({ where: { id: params.id } });
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(game);
}

// Generic partial update — the edit page sends only the fields that changed.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();

  const dateFields = ["releaseDate", "datePurchased", "valueUpdatedAt", "hltbUpdatedAt"];
  for (const f of dateFields) {
    if (body[f]) body[f] = new Date(body[f]);
  }

  try {
    const game = await prisma.game.update({
      where: { id: params.id },
      data: body,
    });
    return NextResponse.json(game);
  } catch (e) {
    return NextResponse.json({ error: "Update failed" }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.game.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
