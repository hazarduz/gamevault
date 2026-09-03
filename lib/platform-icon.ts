// Maps a platform name to an icon family. Deliberately not the official
// trademarked logos — clean generic glyphs that read at a glance. The
// exact platform name is kept as a tooltip.

export type PlatformIconKind =
  | "playstation"
  | "xbox"
  | "switch"
  | "nintendo-console"
  | "nintendo-handheld"
  | "pc"
  | "gamepad";

const NINTENDO_CONSOLE = new Set([
  "Wii U",
  "Wii",
  "GameCube",
  "Nintendo 64",
  "SNES",
  "NES",
]);

const NINTENDO_HANDHELD = new Set([
  "Nintendo DS",
  "Nintendo 3DS",
  "Game Boy Advance",
  "Game Boy Color",
  "Game Boy",
]);

export function getPlatformIconKind(platform: string): PlatformIconKind {
  const p = (platform ?? "").trim();

  if (p === "Nintendo Switch" || p === "Nintendo Switch 2") return "switch";
  if (NINTENDO_CONSOLE.has(p)) return "nintendo-console";
  if (NINTENDO_HANDHELD.has(p)) return "nintendo-handheld";
  if (/^playstation|^ps\b|psp|vita/i.test(p)) return "playstation";
  if (/xbox/i.test(p)) return "xbox";
  if (p === "PC") return "pc";
  return "gamepad";
}
