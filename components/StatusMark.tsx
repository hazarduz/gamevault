import { statusColor, type PlayStatus } from "@/lib/play-status";

// The bottom-left play-status marker on a cover: a small coloured dot for
// most statuses, a silver trophy for "platinum". Pure/presentational, so
// it works in both server components (GameCard) and client code
// (Settings preview). Positioning is the caller's job.
export default function StatusMark({
  status,
  colors,
  idSuffix = "x",
  className = "",
}: {
  status: string;
  colors: Record<PlayStatus, string>;
  idSuffix?: string;
  className?: string;
}) {
  const color = statusColor(status, colors);

  if (status === "platinum") {
    const gid = `plat-sheen-${idSuffix}`;
    return (
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full bg-black/55 shadow ring-1 ring-white/25 ${className}`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="42%" stopColor={color} />
              <stop offset="60%" stopColor="#f4f5f7" />
              <stop offset="100%" stopColor="#8a8f98" />
            </linearGradient>
          </defs>
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" fill={`url(#${gid})`} />
        </svg>
      </span>
    );
  }

  return (
    <span
      className={`h-3.5 w-3.5 rounded-full shadow ring-1 ring-black/30 ${className}`}
      style={{ backgroundColor: color }}
    />
  );
}
