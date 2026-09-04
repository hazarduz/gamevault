import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getUserPrefs } from "@/lib/prefs";

export const dynamic = "force-dynamic";

// GET /api/psn/search-titles?q=batman — read-only. Searches every PSN
// title on the linked account by name, including ones already linked to
// a game (unlike /api/psn/scan) — this is what backs "re-match" on a
// game's page, for fixing a fuzzy match that picked the wrong title
// (e.g. a new LEGO game matched to an old Telltale one).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ error: "Type at least 2 characters." }, { status: 400 });
  }

  try {
    const { getOwnedPsnTitles, normalizeTitleForMatch } = await import("@/lib/psn");
    const prefs = await getUserPrefs(user.id);

    const titles = await getOwnedPsnTitles({
      psnEnabled: prefs.psnEnabled,
      psnOnlineId: prefs.psnOnlineId,
      psnNpsso: prefs.psnNpsso,
    });

    const target = normalizeTitleForMatch(q);
    const matches = titles
      .filter((t) => normalizeTitleForMatch(t.name).includes(target))
      .slice(0, 25)
      .map((t) => ({
        npCommunicationId: t.npCommunicationId,
        npServiceName: t.npServiceName,
        name: t.name,
        platform: t.platform,
        defined: t.defined,
        earned: t.earned,
      }));

    return NextResponse.json({ matches });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 502 });
  }
}
