import Link from "next/link";
import Image from "next/image";

interface GameCardProps {
  id: string;
  title: string;
  platform: string;
  coverUrl: string | null;
  valueCibGbp: number | null;
  valueLooseGbp: number | null;
  metacriticScore: number | null;
}

export default function GameCard({
  id,
  title,
  platform,
  coverUrl,
  valueCibGbp,
  valueLooseGbp,
  metacriticScore,
}: GameCardProps) {
  const value = valueCibGbp ?? valueLooseGbp;

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
        {metacriticScore !== null && (
          <span className="absolute right-2 top-2 rounded bg-ink/90 px-1.5 py-0.5 font-display text-xs font-bold text-amber">
            {metacriticScore}
          </span>
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
