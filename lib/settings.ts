import { prisma } from "@/lib/prisma";

// There's always exactly one Settings row, id "singleton". This creates
// it on first access if it doesn't exist yet (fresh database).
export async function getSettings() {
  const existing = await prisma.settings.findUnique({
    where: { id: "singleton" },
  });
  if (existing) return existing;

  return prisma.settings.create({
    data: { id: "singleton" },
  });
}

export async function updateSettings(data: {
  igdbEnabled?: boolean;
  twitchClientId?: string | null;
  twitchClientSecret?: string | null;
  hltbEnabled?: boolean;
  priceChartingEnabled?: boolean;
  currencyApiUrl?: string | null;
}) {
  await getSettings(); // ensure row exists first
  return prisma.settings.update({
    where: { id: "singleton" },
    data,
  });
}

// Twitch/IGDB credentials can come from the database (set via the
// Settings page) or fall back to the .env file — DB takes priority so
// you can change them without redeploying.
export async function getTwitchCredentials() {
  const settings = await getSettings();
  return {
    clientId: settings.twitchClientId || process.env.TWITCH_CLIENT_ID || "",
    clientSecret:
      settings.twitchClientSecret || process.env.TWITCH_CLIENT_SECRET || "",
  };
}
