"use client";

import Link from "next/link";
import Image from "next/image";

export interface GameListRowProps {
  id: string;
  title: string;
  platform: string;
  coverUrl: string | null;
  valueCibGbp: number | null;
  valueLooseGbp: number | null;
  format: string;
  trophies: { earned: number; total: number } | null;
  hltbMainHours: number | null;
  hltbCompletionistHours: number | null;
  selected: boolean;
  selectionActive: boolean;
  onToggleSelect: (shiftKey: boolean) => void;
}

// The list-view row: cover thumbnail, then title / platform / value /
// trophy or achievement count / HLTB stats as fixed-ish columns. Mirrors
// GameCard's selection behaviour (checkbox, shift-click range, click-to-
// toggle while anything is selected) but as a persistent checkbox rather
// than a hover reveal — there's no room for that trick on a thin row.
export default function GameListRow({
  id,
  title,
  platform,
  coverUrl,
  valueCibGbp,
  valueLooseGbp,
  format,
  trophies,
  hltbMainHours,
  hltbCompletionistHours,
  selected,
  selectionActive,
  onToggleSelect,
}: GameListRowProps) {
  const value = format === "Digital" ? null : valueCibGbp ?? valueLooseGbp;
  const hasHltb = hltbMainHours != null || hltbCompletionistHours != null;

  return (
    <Link
      href={`/games/${id}`}
      onClick={(e) => {
        if (selectionActive) {
          e.preventDefault();
          onToggleSelect(e.shiftKey);
        }
      }}
      className={`flex select-none items-center gap-3 px-3 py-2 transition hover:bg-ink-softer ${
        selected ? "bg-amber/10" : ""
      }`}
    >
      <span
        role="checkbox"
        aria-checked={selected}
        aria-label={selected ? "Deselect game" : "Select game"}
        tabIndex={0}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleSelect(e.shiftKey);
        }}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onToggleSelect(e.shiftKey);
          }
        }}
        className={`flex h-5 w-5 flex-shrink-0 cursor-pointer items-center justify-center rounded border text-[10px] font-bold transition ${
          selected
            ? "border-amber bg-amber text-ink"
            : "border-ink-line bg-ink-soft text-transparent hover:text-mute"
        }`}
      >
        ✓
      </span>

      <div className="relative h-12 w-9 flex-shrink-0 overflow-hidden rounded bg-ink-softer">
        {coverUrl && (
          <Image src={coverUrl} alt="" fill sizes="36px" className="object-cover" />
        )}
      </div>

      <p className="min-w-0 flex-1 truncate text-sm text-parchment">{title}</p>

      <p className="hidden w-28 flex-shrink-0 truncate text-xs text-mute sm:block">
        {platform}
      </p>

      <p className="w-16 flex-shrink-0 text-right font-display text-sm font-bold text-amber">
        {value !== null ? `£${value.toFixed(2)}` : ""}
      </p>

      <p className="w-16 flex-shrink-0 text-right text-xs text-mute">
        {trophies ? `${trophies.earned}/${trophies.total}` : ""}
      </p>

      <p
        className="hidden w-24 flex-shrink-0 text-right text-xs text-mute md:block"
        title={hasHltb ? "Main story / Completionist (HowLongToBeat)" : undefined}
      >
        {hasHltb
          ? [
              hltbMainHours != null ? `${hltbMainHours}h` : "—",
              hltbCompletionistHours != null ? `${hltbCompletionistHours}h` : null,
            ]
              .filter(Boolean)
              .join(" / ")
          : ""}
      </p>
    </Link>
  );
}
