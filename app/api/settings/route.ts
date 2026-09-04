import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Instance-wide integration settings (admin-only to change). The
// score/status/PSN preferences live per-user in /api/prefs now.
function serialize(
  settings: Awaited<ReturnType<typeof getSettings>>,
  admin: boolean
) {
  return {
    isAdmin: admin,
    igdbEnabled: settings.igdbEnabled,
    twitchClientId: settings.twitchClientId ?? "",
    hasTwitchClientSecret: !!settings.twitchClientSecret,
    hltbEnabled: settings.hltbEnabled,
    freeGamesEnabled: settings.freeGamesEnabled,
    freeGamesTtlHours: settings.freeGamesTtlHours,
    steamImportEnabled: settings.steamImportEnabled,
    hasSteamApiKey: !!(settings.steamApiKey || process.env.STEAM_API_KEY),
    priceChartingEnabled: settings.priceChartingEnabled,
    currencyApiUrl: settings.currencyApiUrl ?? "",
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  return NextResponse.json(serialize(await getSettings(), isAdmin(user)));
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!isAdmin(user)) {
    return NextResponse.json(
      { error: "Only the admin can change instance settings." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.igdbEnabled === "boolean") data.igdbEnabled = body.igdbEnabled;
  if (typeof body.hltbEnabled === "boolean") data.hltbEnabled = body.hltbEnabled;
  if (typeof body.freeGamesEnabled === "boolean")
    data.freeGamesEnabled = body.freeGamesEnabled;
  if (typeof body.freeGamesTtlHours === "number" && Number.isFinite(body.freeGamesTtlHours)) {
    data.freeGamesTtlHours = Math.min(168, Math.max(1, Math.round(body.freeGamesTtlHours)));
  }
  if (typeof body.steamImportEnabled === "boolean")
    data.steamImportEnabled = body.steamImportEnabled;
  // Only overwrite the key if a new one was actually typed in — an empty
  // string means "leave it as-is", not "clear it".
  if (typeof body.steamApiKey === "string" && body.steamApiKey !== "") {
    data.steamApiKey = body.steamApiKey.trim();
  }
  if (typeof body.priceChartingEnabled === "boolean")
    data.priceChartingEnabled = body.priceChartingEnabled;
  if (typeof body.twitchClientId === "string")
    data.twitchClientId = body.twitchClientId || null;
  // Only overwrite the secret if a new one was actually typed in —
  // an empty string means "leave it as-is", not "clear it".
  if (typeof body.twitchClientSecret === "string" && body.twitchClientSecret !== "") {
    data.twitchClientSecret = body.twitchClientSecret;
  }
  if (typeof body.currencyApiUrl === "string")
    data.currencyApiUrl = body.currencyApiUrl || null;

  const updated = await updateSettings(data);
  return NextResponse.json(serialize(updated, true));
}
