"use client";

import Link from "next/link";
import Image from "next/image";
import { pickScoreBand, type ScoreBand } from "@/lib/score-badge";
import type { PlayStatus } from "@/lib/play-status";
import StatusMark from "@/components/StatusMark";
import MediaIcon from "@/components/MediaIcon";
import PlatformIcon from "@/components/PlatformIcon";

interface GameCardProps {
  id: string;
  title: string;
  platform: string;
  coverUrl: string | null;
  // Collection view (ignored when `wishlist` is set)
  valueCibGbp?: number | null;
  valueLooseGbp?: number | null;
  score?: number | null;
  scoreBadgeEnabled?: boolean;
  scoreBands?: ScoreBand[];
  playStatus?: string;
  statusBadgeEnabled?: boolean;
  statusColors?: Record<PlayStatus, string>;
  dimCompleted?: boolean;
  dimPlayedPreviously?: boolean;
  dimStrength?: number;
  format?: string;
  trophies?: { earned: number; total: number } | null;
  // Multi-select (home page)
  selectable?: boolean;
  selected?: boolean;
  selectionActive?: boolean; // any card selected — card click toggles instead of navigating
  onToggleSelect?: (shiftKey: boolean) => void;
  // Wishlist view
  wishlist?: boolean;
  releaseDate?: string | null;
}

export default function GameCard({
  id,
  title,
  platform,
  coverUrl,
  valueCibGbp = null,
  valueLooseGbp = null,
  score = null,
  scoreBadgeEnabled = false,
  scoreBands = [],
  playStatus = "unplayed",
  statusBadgeEnabled = false,
  statusColors,
  dimCompleted = false,
  dimPlayedPreviously = false,
  dimStrength = 70,
  format = "Physical",
  trophies = null,
  selectable = false,
  selected = false,
  selectionActive = false,
  onToggleSelect,
  wishlist = false,
  releaseDate = null,
}: GameCardProps) {
  const value = format === "Digital" ? null : valueCibGbp ?? valueLooseGbp;
  const band = !wishlist && scoreBadgeEnabled ? pickScoreBand(score, scoreBands) : null;
  const dimmed =
    !wishlist &&
    ((dimCompleted && (playStatus === "completed" || playStatus === "platinum")) ||
      (dimPlayedPreviously && playStatus === "played_previously"));

  const releaseLabel = (() => {
    if (!wishlist) return null;
    if (!releaseDate) return "Release TBA";
    const d = new Date(releaseDate);
    if (Number.isNaN(d.getTime())) return "Release TBA";
    return d.getTime() <= Date.now()
      ? "Out now"
      : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  })();

  return (
    <Link
      href={`/games/${id}`}
      onClick={(e) => {
        if (selectable && selectionActive) {
          e.preventDefault();
          onToggleSelect?.(e.shiftKey);
        }
      }}
      className={`group flex flex-col overflow-hidden rounded-card border bg-ink-soft transition hover:border-mute ${
        selectable ? "select-none" : ""
      } ${selected ? "border-amber ring-2 ring-amber" : "border-ink-line"}`}
    >
      <div className="relative aspect-[3/4] w-full bg-ink-softer">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 45vw, 220px"
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center font-display text-sm text-mute">
            {title}
          </div>
        )}

        {dimmed && (
          <div
            className="absolute inset-0"
            style={{ backgroundColor: `rgba(0,0,0,${Math.min(95, Math.max(0, dimStrength)) / 100})` }}
          />
        )}

        <div
          className={`absolute left-2 top-2 transition-opacity ${
            selectable && (selected || selectionActive)
              ? "opacity-0"
              : selectable
              ? "group-hover:opacity-0"
              : ""
          }`}
        >
          <PlatformIcon platform={platform} />
        </div>

        {selectable && (
          <span
            role="checkbox"
            aria-checked={selected}
            aria-label={selected ? "Deselect game" : "Select game"}
            tabIndex={0}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleSelect?.(e.shiftKey);
            }}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                onToggleSelect?.(e.shiftKey);
              }
            }}
            className={`absolute left-2 top-2 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-xs font-bold ring-1 transition ${
              selected
                ? "bg-amber text-ink ring-amber"
                : "bg-black/50 text-transparent ring-white/40 hover:text-white/80"
            } ${
              selected || selectionActive
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100"
            }`}
          >
            ✓
          </span>
        )}

        {wishlist && (
          <span className="absolute right-2 top-2 rounded-full bg-amber/90 px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wide text-ink">
            Wishlist
          </span>
        )}

        {band && score !== null && (
          <span
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full font-display text-xs font-bold shadow-md ring-1 ring-black/20"
            style={{ backgroundColor: band.bg, color: band.fg }}
            title={`IGDB score ${Math.round(score)}`}
          >
            {Math.round(score)}
          </span>
        )}

        {!wishlist && statusBadgeEnabled && statusColors && (
          <div className="absolute bottom-2 left-2">
            <StatusMark status={playStatus} colors={statusColors} idSuffix={id} />
          </div>
        )}

        {!wishlist && (
          <div className="absolute bottom-2 right-2">
            <MediaIcon platform={platform} format={format} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 font-display text-sm font-medium leading-snug text-parchment">
          {title}
        </h3>
        {wishlist ? (
          <p className="mt-auto pt-2 text-xs text-mute">{releaseLabel}</p>
        ) : (
          (value !== null || trophies) && (
            <div className="mt-auto flex items-center justify-between gap-2 pt-2">
              {value !== null ? (
                <p className="font-display text-sm font-bold text-amber">£{value.toFixed(2)}</p>
              ) : (
                <span />
              )}
              {trophies && (
                <span
                  className="flex flex-shrink-0 items-center gap-1 text-xs text-mute"
                  title={`${trophies.earned} of ${trophies.total} earned`}
                >
                  <TrophyGlyph className="h-3.5 w-3.5" />
                  {trophies.earned}/{trophies.total}
                </span>
              )}
            </div>
          )
        )}
      </div>
    </Link>
  );
}

// Same silhouette as the animated platinum marker in StatusMark.tsx, just
// static and small — a plain "earned/total" glyph for either PSN
// trophies or Steam achievements, whichever the game is linked to.
function TrophyGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
