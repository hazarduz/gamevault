// HowLongToBeat has no official public API and now embeds a rotating
// access key inside their frontend JavaScript bundle, which breaks any
// hand-written request to a fixed endpoint after a while (that's what
// was happening before — the URL we called stopped existing and HLTB
// served back its normal webpage instead of JSON, hence the "Unexpected
// token '<'" error).
//
// Rather than reverse-engineer that key extraction ourselves, this uses
// the "howlongtobeat" npm package, which is actively maintained
// specifically to track HLTB's changes: https://github.com/ckatzorke/howlongtobeat
// If lookups ever break again, check that package's GitHub issues first
// — it's likely already fixed there — and bump the version in
// package.json.
import { HowLongToBeatService } from "howlongtobeat";
import { getSettings } from "@/lib/settings";

// Constructed lazily inside searchHltb rather than at module scope: if
// the "howlongtobeat" package throws while initialising, we want that to
// surface as a normal caught error from the API route, not a crash at
// import time that makes the route return an HTML 500 page.
let hltbService: HowLongToBeatService | null = null;
function getHltbService(): HowLongToBeatService {
  if (!hltbService) hltbService = new HowLongToBeatService();
  return hltbService;
}

export interface HltbResult {
  title: string;
  mainHours: number | null;
  mainExtraHours: number | null;
  completionistHours: number | null;
}

export async function searchHltb(query: string): Promise<HltbResult[]> {
  const settings = await getSettings();
  if (!settings.hltbEnabled) {
    throw new Error("HowLongToBeat lookups are turned off in Settings.");
  }

  let results;
  try {
    results = await getHltbService().search(query);
  } catch (e: any) {
    throw new Error(
      `HowLongToBeat lookup failed (${e.message}). Their site occasionally changes and breaks lookups — enter times manually if this keeps happening.`
    );
  }

  return results.map((g: any) => ({
    title: g.name,
    mainHours: g.gameplayMain > 0 ? g.gameplayMain : null,
    mainExtraHours: g.gameplayMainExtra > 0 ? g.gameplayMainExtra : null,
    completionistHours: g.gameplayCompletionist > 0 ? g.gameplayCompletionist : null,
  }));
}
