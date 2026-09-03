import Link from "next/link";
import Image from "next/image";
import { pickScoreBand, type ScoreBand } from "@/lib/score-badge";
import { statusColor, type PlayStatus } from "@/lib/play-status";

interface GameCardProps {
  id: string;
  title: string;
  platform: string;
  coverUrl: string | null;
  valueCibGbp: number | null;
  valueLooseGbp: number | null;
  score: number | null;
  scoreBadgeEnabled: boolean;
  scoreBands: ScoreBand[];
  playStatus: string;
  statusBadgeEnabled: boolean;
  statusColors: Record<PlayStatus, string>;
  dimCompleted: boolean;
}

export default function GameCard({
  id,
  title,
  platform,
  coverUrl,
  valueCibGbp,
  valueLooseGbp,
  score,
  scoreBadgeEnabled,
  scoreBands,
  playStatus,
  statusBadgeEnabled,
  statusColors,
  dimCompleted,
}: GameCardProps) {
  const value = valueCibGbp ?? valueLooseGbp;
  const band = scoreBadgeEnabled ? pickScoreBand(score, scoreBands) : null;
  const dimmed = dimCompleted && playStatus === "completed";

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

        {band && score !== null && (
          <span
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full font-display text-xs font-bold shadow-md ring-1 ring-black/20"
            style={{ backgroundColor: band.bg, color: band.fg }}
            title={`IGDB score ${Math.round(score)}`}
          >
            {Math.round(score)}
          </span>
        )}

        {statusBadgeEnabled && (
          <span
            className="absolute bottom-2 left-2 h-3.5 w-3.5 rounded-full shadow ring-1 ring-black/30"
            style={{ backgroundColor: statusColor(playStatus, statusColors) }}
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 font-display text-sm font-medium leading-snug text-parchment">
          {title}
        </h3>
        <p className="text-xs text-mute">{platform}</p>
        {value !== null && (
          <p className="mt-auto pt-2 font-display text-sm font-bold text-amber">
            £{value.toFixed(2)}
          </p>
        )}
      </div>
    </Link>
  );
}
