import type { Game } from "@prisma/client";

// Shared by the server home page (app/page.tsx) and the client
// SortSelect control. Keep this a plain module — no "use client" — so
// the server can call the helpers directly instead of getting a
// client-reference proxy.

export const SORT_OPTIONS = [
  { value: "name", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "score-desc", label: "IGDB score (high → low)" },
  { value: "value-desc", label: "Current value (high → low)" },
  { value: "added-desc", label: "Recently added" },
  { value: "released-desc", label: "Release date (newest)" },
  { value: "rating-desc", label: "My rating (high → low)" },
  { value: "status", label: "Play status (unplayed first)" },
] as const;

const STATUS_ORDER: Record<string, number> = {
  unplayed: 0,
  in_progress: 1,
  completed: 2,
  platinum: 3,
};

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export const DEFAULT_SORT: SortValue = "name";

export function isSortValue(v: string | undefined | null): v is SortValue {
  return !!v && SORT_OPTIONS.some((o) => o.value === v);
}

// CIB → Loose → New, matching how the collection total and GameCard pick
// a value. Returns null when the game has no value at all.
export function currentValue(g: Game): number | null {
  const v = g.valueCibGbp ?? g.valueLooseGbp ?? g.valueNewGbp;
  return v == null ? null : Number(v);
}

export function sortGames(games: Game[], sort: SortValue): Game[] {
  const byName = (a: Game, b: Game) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" });

  // Highest first, missing values pushed to the end, ties broken by title.
  const desc =
    (get: (g: Game) => number | null) => (a: Game, b: Game) => {
      const av = get(a);
      const bv = get(b);
      if (av == null && bv == null) return byName(a, b);
      if (av == null) return 1;
      if (bv == null) return -1;
      return bv - av || byName(a, b);
    };

  const sorted = [...games];
  switch (sort) {
    case "name-desc":
      return sorted.sort((a, b) => byName(b, a));
    case "score-desc":
      return sorted.sort(desc((g) => g.aggregatedRating));
    case "value-desc":
      return sorted.sort(desc(currentValue));
    case "added-desc":
      return sorted.sort(desc((g) => g.dateAdded?.getTime() ?? null));
    case "released-desc":
      return sorted.sort(desc((g) => g.releaseDate?.getTime() ?? null));
    case "rating-desc":
      return sorted.sort(desc((g) => g.personalRating));
    case "status":
      return sorted.sort(
        (a, b) =>
          (STATUS_ORDER[a.playStatus] ?? 0) - (STATUS_ORDER[b.playStatus] ?? 0) ||
          byName(a, b)
      );
    case "name":
    default:
      return sorted.sort(byName);
  }
}
