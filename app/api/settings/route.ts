import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const settings = await getSettings();
  // Never send the actual secret back to the client — just whether one is set.
  return NextResponse.json({
    igdbEnabled: settings.igdbEnabled,
    twitchClientId: settings.twitchClientId ?? "",
    hasTwitchClientSecret: !!settings.twitchClientSecret,
    hltbEnabled: settings.hltbEnabled,
    priceChartingEnabled: settings.priceChartingEnabled,
    currencyApiUrl: settings.currencyApiUrl ?? "",
  });
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

  const updated = await updateSettings(data);
  return NextResponse.json({
    igdbEnabled: updated.igdbEnabled,
    twitchClientId: updated.twitchClientId ?? "",
    hasTwitchClientSecret: !!updated.twitchClientSecret,
    hltbEnabled: updated.hltbEnabled,
    priceChartingEnabled: updated.priceChartingEnabled,
    currencyApiUrl: updated.currencyApiUrl ?? "",
  });
}
