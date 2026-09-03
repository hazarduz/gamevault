// Single source of truth for platform names used across the app: the
// Add/Edit dropdowns, which platform IGDB search results default to,
// and how PriceCharting's URLs are built (they use one console slug per
// platform, e.g. https://www.pricecharting.com/game/playstation-5/...).

export const PLATFORM_OPTIONS = [
  "PlayStation 5",
  "PlayStation 4",
  "PlayStation 3",
  "PlayStation 2",
  "PlayStation 1",
  "PlayStation Vita",
  "PSP",
  "Xbox Series X|S",
  "Xbox One",
  "Xbox 360",
  "Xbox",
  "Nintendo Switch 2",
  "Nintendo Switch",
  "Wii U",
  "Wii",
  "GameCube",
  "Nintendo 64",
  "SNES",
  "NES",
  "Game Boy Advance",
  "Game Boy Color",
  "Game Boy",
  "Nintendo DS",
  "Nintendo 3DS",
  "PC",
  "Other",
] as const;

// When an IGDB search result lists several platforms for a game, prefer
// the one earliest in this list. Edit this order to match your own
// collecting preference (this is what "defaults to Xbox" was — IGDB just
// returns platforms in its own arbitrary order, so we pick for it).
export const PLATFORM_PREFERENCE = [
  "PlayStation 5",
  "PlayStation 4",
  "Nintendo Switch",
  "Nintendo Switch 2",
  "PC",
  "Xbox Series X|S",
  "Xbox One",
];

export function pickPreferredPlatform(available: string[]): string {
  for (const preferred of PLATFORM_PREFERENCE) {
    const match = available.find((a) => a.toLowerCase().includes(preferred.toLowerCase()));
    if (match) return match;
  }
  return available[0] ?? "";
}

// PriceCharting console slugs, keyed by the display names above. NTSC/US
// slugs only — a "pal-" or "jp-" prefix is added separately based on the
// game's region field (PriceCharting's URLs follow that same convention
// consistently, e.g. pal-playstation-5, jp-nintendo-switch).
export const PRICECHARTING_CONSOLE_SLUGS: Record<string, string> = {
  "PlayStation 5": "playstation-5",
  "PlayStation 4": "playstation-4",
  "PlayStation 3": "playstation-3",
  "PlayStation 2": "playstation-2",
  "PlayStation 1": "playstation",
  "PlayStation Vita": "playstation-vita",
  PSP: "psp",
  "Xbox Series X|S": "xbox-series-x",
  "Xbox One": "xbox-one",
  "Xbox 360": "xbox-360",
  Xbox: "xbox",
  "Nintendo Switch 2": "nintendo-switch-2",
  "Nintendo Switch": "nintendo-switch",
  "Wii U": "wii-u",
  Wii: "wii",
  GameCube: "gamecube",
  "Nintendo 64": "nintendo-64",
  SNES: "super-nintendo",
  NES: "nes",
  "Game Boy Advance": "gameboy-advance",
  "Game Boy Color": "gameboy-color",
  "Game Boy": "gameboy",
  "Nintendo DS": "nintendo-ds",
  "Nintendo 3DS": "nintendo-3ds",
};

export function pricechartingConsoleSlug(platform: string, region?: string | null): string | null {
  const base = PRICECHARTING_CONSOLE_SLUGS[platform];
  if (!base) return null;

  const r = (region ?? "").toLowerCase();
  if (r.includes("pal")) return `pal-${base}`;
  if (r.includes("jp") || r.includes("japan") || r.includes("ntsc-j")) return `jp-${base}`;
  return base;
}

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
