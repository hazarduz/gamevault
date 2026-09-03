import Link from "next/link";
import Image from "next/image";
import { pickScoreBand, type ScoreBand } from "@/lib/score-badge";
import type { PlayStatus } from "@/lib/play-status";
import StatusMark from "@/components/StatusMark";

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
  wishlist = false,
  releaseDate = null,
}: GameCardProps) {
  const value = valueCibGbp ?? valueLooseGbp;
  const band = !wishlist && scoreBadgeEnabled ? pickScoreBand(score, scoreBands) : null;
  const dimmed =
    !wishlist &&
    dimCompleted &&
    (playStatus === "completed" || playStatus === "platinum");

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
      className="group flex flex-col overflow-hidden rounded-card border border-ink-line bg-ink-soft transition hover:border-mute"
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

        {dimmed && <div className="absolute inset-0 bg-black/60" />}

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
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 font-display text-sm font-medium leading-snug text-parchment">
          {title}
        </h3>
        <p className="text-xs text-mute">{platform}</p>
        {wishlist ? (
          <p className="mt-auto pt-2 text-xs text-mute">{releaseLabel}</p>
        ) : (
          value !== null && (
            <p className="mt-auto pt-2 font-display text-sm font-bold text-amber">
              £{value.toFixed(2)}
            </p>
          )
        )}
      </div>
    </Link>
  );
}
