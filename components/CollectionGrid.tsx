"use client";

// The home-page collection grid, wrapped so it can own multi-select
// state across all three view modes. Without a selection it behaves
// exactly as before — cards/rows are links to the detail page. Tick one
// (the checkbox appears on hover in the grids, always visible in the
// list) and a toolbar shows up with "Select all" and "Remove".
// Shift-click a second one to select the whole range between it and the
// last one you clicked.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GameCard from "@/components/GameCard";
import GameListRow from "@/components/GameListRow";
import type { ScoreBand } from "@/lib/score-badge";
import type { PlayStatus } from "@/lib/play-status";
import type { ViewMode } from "@/lib/view-mode";

export interface CollectionCard {
  id: string;
  title: string;
  platform: string;
  coverUrl: string | null;
  valueCibGbp: number | null;
  valueLooseGbp: number | null;
  score: number | null;
  playStatus: string;
  format: string;
  trophies: { earned: number; total: number } | null;
  hltbMainHours: number | null;
  hltbCompletionistHours: number | null;
}

interface Prefs {
  scoreBadgeEnabled: boolean;
  scoreBands: ScoreBand[];
  statusBadgeEnabled: boolean;
  statusColors: Record<PlayStatus, string>;
  dimCompleted: boolean;
  dimPlayedPreviously: boolean;
  dimStrength: number;
}

const LARGE_GRID_CLASS =
  "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:[grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]";
const SMALL_GRID_CLASS =
  "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:[grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]";

export default function CollectionGrid({
  games,
  prefs,
  view,
}: {
  games: CollectionCard[];
  prefs: Prefs;
  view: ViewMode;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const selectionActive = selected.size > 0;

  // Drop ids that are no longer on screen — a filter change or a refresh
  // after deleting — so the count and actions stay honest.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const onScreen = new Set(games.map((g) => g.id));
      const next = new Set([...prev].filter((id) => onScreen.has(id)));
      return next.size === prev.size ? prev : next;
    });
    setAnchor(null);
  }, [games]);

  // Esc clears the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(new Set());
        setAnchor(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = useCallback(
    (index: number, shiftKey: boolean) => {
      if (shiftKey && anchor !== null) {
        const [lo, hi] = anchor <= index ? [anchor, index] : [index, anchor];
        const range = games.slice(lo, hi + 1).map((g) => g.id);
        setSelected((prev) => {
          const next = new Set(prev);
          range.forEach((id) => next.add(id));
          return next;
        });
      } else {
        const id = games[index].id;
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
        setAnchor(index);
      }
    },
    [anchor, games]
  );

  function clear() {
    setSelected(new Set());
    setAnchor(null);
  }

  function selectAll() {
    setSelected(new Set(games.map((g) => g.id)));
  }

  async function removeSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const what = ids.length === 1 ? "this game" : `these ${ids.length} games`;
    if (
      !confirm(
        `Remove ${what} from your collection? This permanently deletes ${
          ids.length === 1 ? "it" : "them"
        } and can't be undone.`
      )
    )
      return;

    setBusy(true);
    try {
      const res = await fetch("/api/games/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      clear();
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {selectionActive && (
        <div className="sticky top-[60px] z-20 mb-4 flex flex-wrap items-center gap-2 rounded-card border border-ink-line bg-ink-soft/95 px-3 py-2 shadow-lg backdrop-blur lg:top-2">
          <span className="text-sm font-medium text-parchment">
            {selected.size} selected
          </span>
          {selected.size < games.length && (
            <button type="button" onClick={selectAll} className="btn-secondary text-xs">
              Select all ({games.length})
            </button>
          )}
          <button type="button" onClick={clear} className="btn-secondary text-xs">
            Clear
          </button>
          <span className="flex-1" />
          <button
            type="button"
            onClick={removeSelected}
            disabled={busy}
            className="btn-secondary text-xs text-red-400"
          >
            {busy ? "Removing…" : selected.size === 1 ? "Remove game" : "Remove games"}
          </button>
        </div>
      )}

      {view === "list" ? (
        <div className="divide-y divide-ink-line overflow-hidden rounded-card border border-ink-line bg-ink-soft">
          {games.map((g, i) => (
            <GameListRow
              key={g.id}
              id={g.id}
              title={g.title}
              platform={g.platform}
              coverUrl={g.coverUrl}
              valueCibGbp={g.valueCibGbp}
              valueLooseGbp={g.valueLooseGbp}
              format={g.format}
              trophies={g.trophies}
              hltbMainHours={g.hltbMainHours}
              hltbCompletionistHours={g.hltbCompletionistHours}
              selected={selected.has(g.id)}
              selectionActive={selectionActive}
              onToggleSelect={(shiftKey) => toggle(i, shiftKey)}
            />
          ))}
        </div>
      ) : (
        <div className={view === "small" ? SMALL_GRID_CLASS : LARGE_GRID_CLASS}>
          {games.map((g, i) => (
            <GameCard
              key={g.id}
              id={g.id}
              title={g.title}
              platform={g.platform}
              coverUrl={g.coverUrl}
              valueCibGbp={g.valueCibGbp}
              valueLooseGbp={g.valueLooseGbp}
              score={g.score}
              scoreBadgeEnabled={prefs.scoreBadgeEnabled}
              scoreBands={prefs.scoreBands}
              playStatus={g.playStatus}
              statusBadgeEnabled={prefs.statusBadgeEnabled}
              statusColors={prefs.statusColors}
              dimCompleted={prefs.dimCompleted}
              dimPlayedPreviously={prefs.dimPlayedPreviously}
              dimStrength={prefs.dimStrength}
              format={g.format}
              trophies={g.trophies}
              selectable
              selected={selected.has(g.id)}
              selectionActive={selectionActive}
              onToggleSelect={(shiftKey) => toggle(i, shiftKey)}
            />
          ))}
        </div>
      )}
    </>
  );
}
