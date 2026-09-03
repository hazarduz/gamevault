import { getMediaKind, mediaLabel, type MediaKind } from "@/lib/media";

// Small physical/digital indicator for a game cover. Presentational, so
// it works in both server and client components.
export default function MediaIcon({
  platform,
  format,
  className = "",
}: {
  platform: string | null | undefined;
  format: string | null | undefined;
  className?: string;
}) {
  const kind = getMediaKind(platform, format);
  if (!kind) return null;

  return (
    <span
      className={`flex h-6 w-6 items-center justify-center rounded-md bg-black/50 text-parchment shadow ring-1 ring-white/15 ${className}`}
      title={mediaLabel(kind)}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
        {glyph(kind)}
      </svg>
    </span>
  );
}

function glyph(kind: MediaKind) {
  if (kind === "cloud") {
    return (
      <path
        fill="currentColor"
        d="M7 19a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 18 10.4 3.8 3.8 0 0 1 17.5 19H7Z"
      />
    );
  }
  if (kind === "cartridge") {
    return (
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M7 3h7.2L19 7.8V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm1 3.6h6v3.6H8V6.6Z"
      />
    );
  }
  // disc — outer ring with a centre hole (even-odd punch)
  return (
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 6.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8Z"
    />
  );
}
