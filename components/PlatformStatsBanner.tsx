"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PsnStats, SteamStats } from "@/lib/platform-stats";
import { TROPHY_TIER_COLORS } from "@/lib/trophy-colors";

export default function PlatformStatsBanner(
  props:
    | { kind: "psn"; psn: PsnStats }
    | { kind: "steam"; steam: SteamStats }
) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function refresh(url: string) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Refresh failed.");
      if (props.kind === "steam" && typeof data.synced === "number") {
        setNote(
          data.remaining > 0
            ? `Synced ${data.synced} — ${data.remaining} left, run it again.`
            : `Synced ${data.synced}.`
        );
      }
      router.refresh();
    } catch (e: any) {
      setNote(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 rounded-card border border-ink-line bg-ink-soft px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {props.kind === "psn" ? (
          <>
            {(["platinum", "gold", "silver", "bronze"] as const).map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-parchment">
                <span
                  className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: TROPHY_TIER_COLORS[t] }}
                />
                <span className="font-display font-bold">{props.psn[t].toLocaleString()}</span>
                <span className="text-mute capitalize">{t}</span>
              </span>
            ))}
            <span className="text-mute">
              {props.psn.total.toLocaleString()} trophies · Level{" "}
              <span className="text-parchment">{props.psn.trophyLevel}</span>
            </span>
          </>
        ) : (
          <>
            <span className="text-parchment">
              <span className="font-display font-bold">
                {props.steam.unlocked.toLocaleString()}
              </span>{" "}
              <span className="text-mute">
                of {props.steam.available.toLocaleString()} achievements
              </span>
            </span>
            <span className="text-parchment">
              <span className="font-display font-bold">{props.steam.perfectGames}</span>{" "}
              <span className="text-mute">
                {props.steam.perfectGames === 1 ? "perfect game" : "perfect games"}
              </span>
            </span>
            <span className="text-mute">
              {props.steam.gamesTracked}/{props.steam.pcGames} PC games tracked
            </span>
          </>
        )}

        <button
          type="button"
          onClick={() =>
            refresh(props.kind === "psn" ? "/api/psn/summary" : "/api/steam/achievements/sync-all")
          }
          disabled={busy}
          className="ml-auto text-xs text-mute underline underline-offset-2 hover:text-parchment disabled:opacity-50"
        >
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {(note || (props.kind === "psn" && props.psn.stale)) && (
        <p className="mt-2 text-xs text-mute">
          {note ??
            "Showing the last cached totals — Sony didn't answer the refresh. Check the NPSSO token in Settings."}
        </p>
      )}
    </div>
  );
}
