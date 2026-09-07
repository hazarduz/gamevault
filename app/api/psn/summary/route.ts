import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getPsnStats } from "@/lib/platform-stats";

export const dynamic = "force-dynamic";

// POST /api/psn/summary — force a refetch of the account-wide PSN trophy
// totals (bronze/silver/gold/platinum + level) and return the fresh copy.
// Backs the "Refresh" button on the PlayStation platform pages.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const stats = await getPsnStats(user.id, { force: true });
  if (!stats) {
    return NextResponse.json(
      { error: "PlayStation sync isn't set up, or Sony rejected the token. Check Settings." },
      { status: 400 }
    );
  }
  return NextResponse.json(stats);
}
