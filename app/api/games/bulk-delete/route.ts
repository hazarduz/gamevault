import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// POST /api/games/bulk-delete { ids: string[] }
// Permanently deletes the given games — but only the ones owned by the
// signed-in user, so a stray id in the list can't touch anyone else's
// collection. Backs the home-page multi-select "Remove" action.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body was not valid JSON" }, { status: 400 });
  }

  const ids: unknown = body?.ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !id)) {
    return NextResponse.json(
      { error: "ids must be a non-empty array of game ids" },
      { status: 400 }
    );
  }

  const unique = Array.from(new Set(ids as string[]));
  if (unique.length === 0) return NextResponse.json({ deleted: 0 });

  const result = await prisma.game.deleteMany({
    where: { id: { in: unique }, userId: user.id },
  });

  return NextResponse.json({ deleted: result.count });
}
