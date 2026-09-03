import { getPlatformIconKind, type PlatformIconKind } from "@/lib/platform-icon";

// Small platform glyph for the top-left of a game cover. Presentational,
// so it works in server and client components.
export default function PlatformIcon({
  platform,
  className = "",
}: {
  platform: string;
  className?: string;
}) {
  const kind = getPlatformIconKind(platform);
  return (
    <span
      className={`flex h-6 w-6 items-center justify-center rounded-md bg-black/50 text-parchment shadow ring-1 ring-white/15 ${className}`}
      title={platform}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        {glyph(kind)}
      </svg>
    </span>
  );
}

function glyph(kind: PlatformIconKind) {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (kind) {
    case "playstation":
      return (
        <>
          <path {...stroke} d="M12 2.5 L16 9 H8 Z" />
          <circle {...stroke} cx="18" cy="12.5" r="3" />
          <path {...stroke} d="M9 15.5 l5 5 M14 15.5 l-5 5" />
          <rect {...stroke} x="3" y="9.5" width="6" height="6" rx="0.8" />
        </>
      );
    case "xbox":
      return (
        <>
          <circle {...stroke} cx="12" cy="12" r="9.3" />
          <path {...stroke} d="M7 7 L17 17 M17 7 L7 17" />
        </>
      );
    case "switch":
      return (
        <>
          <rect {...stroke} x="3" y="4" width="7" height="16" rx="3.5" />
          <rect {...stroke} x="14" y="4" width="7" height="16" rx="3.5" />
          <circle cx="6.5" cy="9" r="1.3" fill="currentColor" />
          <circle cx="17.5" cy="15" r="1.3" fill="currentColor" />
        </>
      );
    case "nintendo-console":
      return (
        <>
          <rect {...stroke} x="2.5" y="7" width="19" height="10" rx="3" />
          <path {...stroke} d="M7 9.5 v5 M4.5 12 h5" />
          <circle cx="15.5" cy="11" r="1.3" fill="currentColor" />
          <circle cx="18" cy="13" r="1.3" fill="currentColor" />
        </>
      );
    case "nintendo-handheld":
      return (
        <>
          <rect {...stroke} x="6" y="2.5" width="12" height="19" rx="2.5" />
          <rect x="8.5" y="5" width="7" height="6.5" rx="0.6" fill="currentColor" opacity="0.5" />
          <path {...stroke} strokeWidth={1.4} d="M9.5 15 v2.4 M8.3 16.2 h2.4" />
          <circle cx="15" cy="16" r="1" fill="currentColor" />
          <circle cx="16.6" cy="17.8" r="1" fill="currentColor" />
        </>
      );
    case "pc":
      return (
        <>
          <rect {...stroke} x="3" y="4" width="18" height="12" rx="1.5" />
          <path {...stroke} d="M9 20 h6 M12 16 v4" />
        </>
      );
    default: // gamepad
      return (
        <path
          fill="currentColor"
          d="M8 8h8a5 5 0 0 1 4.8 3.6l1 4a2.5 2.5 0 0 1-4 2.6l-2.5-1.8a3 3 0 0 0-1.8-.6h-3a3 3 0 0 0-1.8.6l-2.5 1.8a2.5 2.5 0 0 1-4-2.6l1-4A5 5 0 0 1 8 8Z"
        />
      );
  }
}
