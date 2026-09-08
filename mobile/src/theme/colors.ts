// A single dark palette — GameVault's web app is dark-first, and a
// mobile collection browser spends most of its time showing cover art,
// which reads best against a dark ground.
export const colors = {
  background: "#0f172a",
  surface: "#1e293b",
  surfaceAlt: "#273449",
  border: "#334155",
  text: "#e2e8f0",
  textMuted: "#94a3b8",
  accent: "#38bdf8",
  accentText: "#0f172a",
  danger: "#f87171",
  success: "#4ade80",
  warning: "#facc15",
};

export const statusColors: Record<string, string> = {
  unplayed: colors.textMuted,
  in_progress: colors.accent,
  completed: colors.success,
  platinum: colors.warning,
};

export const statusLabels: Record<string, string> = {
  unplayed: "Unplayed",
  in_progress: "In progress",
  completed: "Completed",
  platinum: "Platinum",
};
