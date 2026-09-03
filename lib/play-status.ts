// Per-game play status shown as a coloured dot on the bottom-left of each
// cover on the home page, and (for "completed") a dark overlay. The three
// dot colours are editable in Settings. Pure module — imported by both
// server components and client code.

export type PlayStatus = "unplayed" | "in_progress" | "completed";

export const PLAY_STATUS_OPTIONS: { value: PlayStatus; label: string }[] = [
  { value: "unplayed", label: "Unplayed" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

export const DEFAULT_STATUS_COLORS: Record<PlayStatus, string> = {
  unplayed: "#6b7280",
  in_progress: "#e3a63e",
  completed: "#22c55e",
};

const HEX_COLOUR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isPlayStatus(v: unknown): v is PlayStatus {
  return v === "unplayed" || v === "in_progress" || v === "completed";
}

export function statusLabel(status: string): string {
  return (
    PLAY_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "Unplayed"
  );
}

// Always returns all three keys: starts from the defaults and overrides a
// colour only when the input supplies a valid hex (also keeps the value
// safe to drop into a style attribute).
export function sanitizeStatusColors(input: unknown): Record<PlayStatus, string> {
  const out: Record<PlayStatus, string> = { ...DEFAULT_STATUS_COLORS };
  if (input && typeof input === "object") {
    for (const key of Object.keys(out) as PlayStatus[]) {
      const v = (input as Record<string, unknown>)[key];
      if (typeof v === "string" && HEX_COLOUR.test(v)) out[key] = v;
    }
  }
  return out;
}

export function parseStatusColors(
  raw: string | null | undefined
): Record<PlayStatus, string> {
  if (!raw) return { ...DEFAULT_STATUS_COLORS };
  try {
    return sanitizeStatusColors(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_STATUS_COLORS };
  }
}

export function statusColor(
  status: string,
  colors: Record<PlayStatus, string>
): string {
  return isPlayStatus(status) ? colors[status] : colors.unplayed;
}
