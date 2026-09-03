import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getFreeGames, type FreeGamesResult } from "@/lib/free-games";
import FreeGamesView from "@/components/FreeGamesView";

export const dynamic = "force-dynamic";

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[™®©]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export default async function FreePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const settings = await getSettings();

  if (!settings.freeGamesEnabled) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-display text-2xl font-bold text-parchment">Currently Free</h1>
        <p className="mt-6 text-sm text-mute">
          This page is turned off. An admin can enable it in Settings.
        </p>
      </div>
    );
  }

  let result: FreeGamesResult | null = null;
  let error: string | null = null;
  try {
    result = await getFreeGames();
  } catch (e: any) {
    error = e?.message || "Couldn't load the free-games feed.";
  }

  // Flag anything the user already has, matched loosely by title.
  const rows = await prisma.game.findMany({
    where: { userId: user.id },
    select: { title: true, wishlist: true },
  });
  const owned: Record<string, "owned" | "wishlist"> = {};
  for (const r of rows) {
    const key = normalizeTitle(r.title);
    if (!key) continue;
    // "owned" wins over "wishlist" if both exist.
    if (owned[key] === "owned") continue;
    owned[key] = r.wishlist ? "wishlist" : "owned";
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-parchment">Currently Free</h1>
      <p className="mt-1 text-sm text-mute">
        Games you can claim and keep for free right now, from the Epic Games
        Store and cross-platform giveaway round-ups. Refreshes every{" "}
        {settings.freeGamesTtlHours}
        {settings.freeGamesTtlHours === 1 ? " hour" : " hours"}.
      </p>

      <FreeGamesView initial={result} error={error} owned={owned} />
    </div>
  );
}
