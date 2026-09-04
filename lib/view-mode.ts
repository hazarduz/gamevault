// How the collection grid (home page, and platform filters — same page,
// different query string) is laid out. Kept in the URL as `?view=`, the
// same pattern as `?sort=` in lib/sort-games.ts, so it's a plain module
// the server page can import directly.

export const VIEW_OPTIONS = [
  { value: "large", label: "Large grid" },
  { value: "small", label: "Small grid" },
  { value: "list", label: "List" },
] as const;

export type ViewMode = (typeof VIEW_OPTIONS)[number]["value"];

export const DEFAULT_VIEW: ViewMode = "large";

export function isViewMode(v: string | undefined | null): v is ViewMode {
  return !!v && VIEW_OPTIONS.some((o) => o.value === v);
}
