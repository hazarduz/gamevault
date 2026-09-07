// Option lists for the Game Picker's filter dropdowns. Platform and
// genre ids are IGDB's; the length bands are matched against
// HowLongToBeat's main-story time.

export const PICKER_PLATFORMS = [
  { id: 6, label: "PC" },
  { id: 48, label: "PlayStation 4" },
  { id: 167, label: "PlayStation 5" },
  { id: 49, label: "Xbox One" },
  { id: 169, label: "Xbox Series X|S" },
  { id: 130, label: "Nintendo Switch" },
  { id: 508, label: "Nintendo Switch 2" },
] as const;

// The "Add as" dropdown on the Game Picker offers exactly the same set
// of platforms as the platform filter, in the same order.
export const PICKER_ADD_PLATFORMS: string[] = PICKER_PLATFORMS.map((p) => p.label);

export const PICKER_GENRES = [
  { id: 31, label: "Adventure" },
  { id: 33, label: "Arcade" },
  { id: 35, label: "Card & Board Game" },
  { id: 4, label: "Fighting" },
  { id: 25, label: "Hack and slash / Beat 'em up" },
  { id: 32, label: "Indie" },
  { id: 36, label: "MOBA" },
  { id: 7, label: "Music" },
  { id: 8, label: "Platform" },
  { id: 2, label: "Point-and-click" },
  { id: 9, label: "Puzzle" },
  { id: 26, label: "Quiz / Trivia" },
  { id: 10, label: "Racing" },
  { id: 11, label: "Real Time Strategy (RTS)" },
  { id: 12, label: "Role-playing (RPG)" },
  { id: 5, label: "Shooter" },
  { id: 13, label: "Simulator" },
  { id: 14, label: "Sport" },
  { id: 15, label: "Strategy" },
  { id: 24, label: "Tactical" },
  { id: 16, label: "Turn-based strategy (TBS)" },
  { id: 34, label: "Visual Novel" },
] as const;

export interface LengthBand {
  value: string;
  label: string;
  min: number;
  max: number;
}

export const PICKER_LENGTHS: LengthBand[] = [
  { value: "0-10", label: "0–10 hours", min: 0, max: 10 },
  { value: "10-20", label: "10–20 hours", min: 10, max: 20 },
  { value: "20-30", label: "20–30 hours", min: 20, max: 30 },
  { value: "30-50", label: "30–50 hours", min: 30, max: 50 },
  { value: "50+", label: "50+ hours", min: 50, max: 100000 },
];

export function lengthBand(value: string | null | undefined): LengthBand | null {
  return PICKER_LENGTHS.find((b) => b.value === value) ?? null;
}

// Rating bands are matched against the score shown on the card (IGDB's
// aggregated critic score, falling back to the combined rating), 0–100.
// `min` is exclusive, `max` inclusive — so the bands tile with no gaps
// even though the labels read "51–70", "71–80", etc.
export interface RatingBand {
  value: string;
  label: string;
  min: number;
  max: number;
}

export const PICKER_RATINGS: RatingBand[] = [
  { value: "0-50", label: "0–50%", min: -1, max: 50 },
  { value: "51-70", label: "51–70%", min: 50, max: 70 },
  { value: "71-80", label: "71–80%", min: 70, max: 80 },
  { value: "81-90", label: "81–90%", min: 80, max: 90 },
  { value: "90+", label: "90%+", min: 90, max: 1000 },
];

export function ratingBand(value: string | null | undefined): RatingBand | null {
  return PICKER_RATINGS.find((b) => b.value === value) ?? null;
}
