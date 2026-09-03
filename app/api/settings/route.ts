import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/session";
import { parseScoreBands, sanitizeScoreBands } from "@/lib/score-badge";
import { parseStatusColors, sanitizeStatusColors } from "@/lib/play-status";

export const dynamic = "force-dynamic";

// Shape sent to the client. The secret is never included — only whether
// one is set — and score bands are sent resolved (defaults applied) so
// the client never has to parse the stored JSON string.
function serialize(settings: Awaited<ReturnType<typeof getSettings>>) {
  return {
    igdbEnabled: settings.igdbEnabled,
    twitchClientId: settings.twitchClientId ?? "",
    hasTwitchClientSecret: !!settings.twitchClientSecret,
    psnEnabled: settings.psnEnabled,
    psnOnlineId: settings.psnOnlineId ?? "",
    hasPsnNpsso: !!settings.psnNpsso,
    hltbEnabled: settings.hltbEnabled,
    priceChartingEnabled: settings.priceChartingEnabled,
    currencyApiUrl: settings.currencyApiUrl ?? "",
    scoreBadgeEnabled: settings.scoreBadgeEnabled,
    scoreBadgeBands: parseScoreBands(settings.scoreBadgeBands),
    barcodeLookupEnabled: settings.barcodeLookupEnabled,
    barcodeApiUrl: settings.barcodeApiUrl ?? "",
    statusBadgeEnabled: settings.statusBadgeEnabled,
    dimCompleted: settings.dimCompleted,
    statusColors: parseStatusColors(settings.statusColors),
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  return NextResponse.json(serialize(await getSettings()));
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.igdbEnabled === "boolean") data.igdbEnabled = body.igdbEnabled;
  if (typeof body.hltbEnabled === "boolean") data.hltbEnabled = body.hltbEnabled;
  if (typeof body.priceChartingEnabled === "boolean")
    data.priceChartingEnabled = body.priceChartingEnabled;
  if (typeof body.twitchClientId === "string") data.twitchClientId = body.twitchClientId || null;
  // Only overwrite the secret if a new one was actually typed in —
  // an empty string means "leave it as-is", not "clear it".
  if (typeof body.twitchClientSecret === "string" && body.twitchClientSecret !== "") {
    data.twitchClientSecret = body.twitchClientSecret;
  }
  if (typeof body.currencyApiUrl === "string") data.currencyApiUrl = body.currencyApiUrl || null;

  if (typeof body.psnEnabled === "boolean") data.psnEnabled = body.psnEnabled;
  if (typeof body.psnOnlineId === "string") data.psnOnlineId = body.psnOnlineId || null;
  // Only overwrite the token if a new one was actually typed in.
  if (typeof body.psnNpsso === "string" && body.psnNpsso !== "") {
    data.psnNpsso = body.psnNpsso;
  }

  if (typeof body.scoreBadgeEnabled === "boolean")
    data.scoreBadgeEnabled = body.scoreBadgeEnabled;
  if (Array.isArray(body.scoreBadgeBands)) {
    const clean = sanitizeScoreBands(body.scoreBadgeBands);
    // Store null when it sanitises to nothing so the defaults kick back in.
    data.scoreBadgeBands = clean.length > 0 ? JSON.stringify(clean) : null;
  }

  if (typeof body.barcodeLookupEnabled === "boolean")
    data.barcodeLookupEnabled = body.barcodeLookupEnabled;
  if (typeof body.barcodeApiUrl === "string")
    data.barcodeApiUrl = body.barcodeApiUrl || null;

  if (typeof body.statusBadgeEnabled === "boolean")
    data.statusBadgeEnabled = body.statusBadgeEnabled;
  if (typeof body.dimCompleted === "boolean") data.dimCompleted = body.dimCompleted;
  if (body.statusColors && typeof body.statusColors === "object") {
    data.statusColors = JSON.stringify(sanitizeStatusColors(body.statusColors));
  }

  const updated = await updateSettings(data);
  return NextResponse.json(serialize(updated));
}
