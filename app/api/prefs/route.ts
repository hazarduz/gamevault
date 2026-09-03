import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getUserPrefs, updateUserPrefs } from "@/lib/prefs";
import { parseScoreBands, sanitizeScoreBands } from "@/lib/score-badge";
import { parseStatusColors, sanitizeStatusColors } from "@/lib/play-status";

export const dynamic = "force-dynamic";

function serialize(p: Awaited<ReturnType<typeof getUserPrefs>>) {
  return {
    scoreBadgeEnabled: p.scoreBadgeEnabled,
    scoreBadgeBands: parseScoreBands(p.scoreBadgeBands),
    statusBadgeEnabled: p.statusBadgeEnabled,
    dimCompleted: p.dimCompleted,
    statusColors: parseStatusColors(p.statusColors),
    psnEnabled: p.psnEnabled,
    psnOnlineId: p.psnOnlineId ?? "",
    hasPsnNpsso: !!p.psnNpsso,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  return NextResponse.json(serialize(await getUserPrefs(user.id)));
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.scoreBadgeEnabled === "boolean")
    data.scoreBadgeEnabled = body.scoreBadgeEnabled;
  if (Array.isArray(body.scoreBadgeBands)) {
    const clean = sanitizeScoreBands(body.scoreBadgeBands);
    data.scoreBadgeBands = clean.length > 0 ? JSON.stringify(clean) : null;
  }

  if (typeof body.statusBadgeEnabled === "boolean")
    data.statusBadgeEnabled = body.statusBadgeEnabled;
  if (typeof body.dimCompleted === "boolean") data.dimCompleted = body.dimCompleted;
  if (body.statusColors && typeof body.statusColors === "object") {
    data.statusColors = JSON.stringify(sanitizeStatusColors(body.statusColors));
  }

  if (typeof body.psnEnabled === "boolean") data.psnEnabled = body.psnEnabled;
  if (typeof body.psnOnlineId === "string") data.psnOnlineId = body.psnOnlineId || null;
  // Only overwrite the token if a new one was actually typed in.
  if (typeof body.psnNpsso === "string" && body.psnNpsso !== "") {
    data.psnNpsso = body.psnNpsso;
  }

  const updated = await updateUserPrefs(user.id, data);
  return NextResponse.json(serialize(updated));
}
