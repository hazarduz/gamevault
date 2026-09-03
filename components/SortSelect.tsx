"use client";

import { useRouter, useSearchParams } from "next/navigation";

export const SORT_OPTIONS = [
  { value: "name", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "score-desc", label: "IGDB score (high → low)" },
  { value: "value-desc", label: "Current value (high → low)" },
  { value: "added-desc", label: "Recently added" },
  { value: "released-desc", label: "Release date (newest)" },
  { value: "rating-desc", label: "My rating (high → low)" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export const DEFAULT_SORT: SortValue = "name";

export function isSortValue(v: string | undefined): v is SortValue {
  return !!v && SORT_OPTIONS.some((o) => o.value === v);
}

// The home page is a server component, so the reordering happens by
// pushing `?sort=` into the URL and letting it re-render. The current
// search term (`q`) is preserved.
export default function SortSelect({ current }: { current: SortValue }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value === DEFAULT_SORT) {
      params.delete("sort");
    } else {
      params.set("sort", e.target.value);
    }
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  return (
    <label className="flex items-center gap-2 text-sm text-mute">
      <span className="whitespace-nowrap">Sort by</span>
      <select value={current} onChange={onChange} className="field sm:w-56">
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
