// Which media icon (if any) to show for a game, from its platform +
// format. Digital always -> cloud. Physical -> disc or cartridge based on
// what that platform actually shipped on.

export type MediaKind = "disc" | "cartridge" | "cloud";

const CARTRIDGE_PLATFORMS = new Set([
  "Nintendo Switch 2",
  "Nintendo Switch",
  "Nintendo 64",
  "SNES",
  "NES",
  "Game Boy Advance",
  "Game Boy Color",
  "Game Boy",
  "Nintendo DS",
  "Nintendo 3DS",
  "PlayStation Vita",
]);

const DISC_PLATFORMS = new Set([
  "PlayStation 5",
  "PlayStation 4",
  "PlayStation 3",
  "PlayStation 2",
  "PlayStation 1",
  "PSP",
  "Xbox Series X|S",
  "Xbox One",
  "Xbox 360",
  "Xbox",
  "Wii U",
  "Wii",
  "GameCube",
  "PC",
]);

export function getMediaKind(
  platform: string | null | undefined,
  format: string | null | undefined
): MediaKind | null {
  if ((format ?? "").toLowerCase() === "digital") return "cloud";
  if ((format ?? "").toLowerCase() !== "physical") return null;

  const p = (platform ?? "").trim();
  if (CARTRIDGE_PLATFORMS.has(p)) return "cartridge";
  if (DISC_PLATFORMS.has(p)) return "disc";
  return null;
}

export function mediaLabel(kind: MediaKind): string {
  return kind === "cloud"
    ? "Digital"
    : kind === "cartridge"
    ? "Physical — cartridge"
    : "Physical — disc";
}
