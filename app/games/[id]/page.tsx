"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { PLATFORM_OPTIONS } from "@/lib/platforms";
import { PLAY_STATUS_OPTIONS } from "@/lib/play-status";
import MediaIcon from "@/components/MediaIcon";

interface Game {
  id: string;
  title: string;
  platform: string;
  region: string | null;
  condition: string | null;
  format: string;
  playStatus: string;
  wishlist: boolean;
  notes: string | null;
  coverUrl: string | null;
  releaseDate: string | null;
  summary: string | null;
  genres: string[];
  developer: string | null;
  publisher: string | null;
  igdbId: number | null;
  aggregatedRating: number | null;
  valueLooseGbp: number | null;
  valueCibGbp: number | null;
  valueNewGbp: number | null;
  valueUpdatedAt: string | null;
  valueSource: string | null;
  hltbMainHours: number | null;
  hltbMainExtraHours: number | null;
  hltbCompletionistHours: number | null;
  hltbUpdatedAt: string | null;
}

export default function GameDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [priceLoading, setPriceLoading] = useState(false);
  const [hltbLoading, setHltbLoading] = useState(false);
  const [igdbLoading, setIgdbLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/games/${params.id}`)
      .then((r) => r.json())
      .then((data) => setGame(data && !data.error ? data : null))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function patch(fields: Partial<Game>) {
    setSaving(true);
    const res = await fetch(`/api/games/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    const updated = await res.json();
    setGame(updated);
    setSaving(false);
  }

  async function fetchPrice() {
    if (!game) return;
    setPriceLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/enrich/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, title: game.title, platform: game.platform, region: game.region }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGame((g) => g && { ...g, valueLooseGbp: data.loose, valueCibGbp: data.cib, valueNewGbp: data.new, valueUpdatedAt: new Date().toISOString() });
      setStatusMsg(`Matched "${data.matchedTitle}" on PriceCharting.`);
    } catch (e: any) {
      setStatusMsg(e.message);
    } finally {
      setPriceLoading(false);
    }
  }

  async function fetchHltb() {
    if (!game) return;
    setHltbLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/enrich/hltb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, title: game.title }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGame((g) => g && {
        ...g,
        hltbMainHours: data.matched.mainHours,
        hltbMainExtraHours: data.matched.mainExtraHours,
        hltbCompletionistHours: data.matched.completionistHours,
        hltbUpdatedAt: new Date().toISOString(),
      });
      setStatusMsg(`Matched "${data.matched.title}" on HowLongToBeat.`);
    } catch (e: any) {
      setStatusMsg(e.message);
    } finally {
      setHltbLoading(false);
    }
  }

  async function refreshIgdbScore() {
    if (!game?.igdbId) return;
    setIgdbLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/igdb/search?igdbId=${game.igdbId}`);
      const detail = await res.json();
      if (!res.ok) throw new Error(detail.error ?? "IGDB lookup failed");
      const rating: number | null = detail.aggregatedRating ?? null;
      await patch({ aggregatedRating: rating });
      setStatusMsg(
        rating != null
          ? `IGDB score updated to ${Math.round(rating)}.`
          : "IGDB has no critic score for this game yet."
      );
    } catch (e: any) {
      setStatusMsg(e.message);
    } finally {
      setIgdbLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Remove this game from your collection?")) return;
    await fetch(`/api/games/${params.id}`, { method: "DELETE" });
    router.push("/");
  }

  if (loading) return <p className="text-mute">Loading…</p>;
  if (!game) return <p className="text-mute">Game not found.</p>;

  return (
    <div className="grid gap-8 md:grid-cols-[240px_1fr]">
      <div>
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-card border border-ink-line bg-ink-soft">
          {game.coverUrl && (
            <Image src={game.coverUrl} alt={game.title} fill className="object-cover" />
          )}
        </div>
        {game.wishlist && (
          <button
            onClick={() => patch({ wishlist: false })}
            className="btn-primary mt-4 w-full"
          >
            Move to collection
          </button>
        )}
        <button
          onClick={handleDelete}
          className="btn-secondary mt-4 w-full text-red-400"
        >
          {game.wishlist ? "Remove from wishlist" : "Remove from collection"}
        </button>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-bold text-parchment">{game.title}</h1>
          <MediaIcon platform={game.platform} format={game.format} />
          {game.wishlist && (
            <span className="rounded-full bg-amber/90 px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wide text-ink">
              Wishlist
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-mute">
          {game.platform}
          {game.region && ` · ${game.region}`}
          {game.releaseDate && ` · ${game.releaseDate.slice(0, 4)}`}
        </p>

        {game.summary && (
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-parchment/90">
            {game.summary}
          </p>
        )}

        {statusMsg && (
          <p className="mt-4 rounded-md border border-ink-line bg-ink-soft px-3 py-2 text-sm text-amber">
            {statusMsg}
          </p>
        )}

        {/* --- Value --- */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-parchment">Current value</h2>
            {game.format !== "Digital" && (
              <button onClick={fetchPrice} disabled={priceLoading} className="btn-secondary text-xs">
                {priceLoading ? "Looking up…" : "Fetch from PriceCharting"}
              </button>
            )}
          </div>
          {game.format === "Digital" ? (
            <div className="mt-3 grid grid-cols-3 gap-3">
              {["Loose", "Complete (CIB)", "New/Sealed"].map((label) => (
                <div key={label}>
                  <label className="label">{label}</label>
                  <span className="field block text-mute">N/A</span>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <ValueField label="Loose" value={game.valueLooseGbp} onSave={(v) => patch({ valueLooseGbp: v })} />
                <ValueField label="Complete (CIB)" value={game.valueCibGbp} onSave={(v) => patch({ valueCibGbp: v })} />
                <ValueField label="New/Sealed" value={game.valueNewGbp} onSave={(v) => patch({ valueNewGbp: v })} />
              </div>
              {game.valueUpdatedAt && (
                <p className="mt-2 text-xs text-mute">
                  Updated {new Date(game.valueUpdatedAt).toLocaleDateString()}
                </p>
              )}
            </>
          )}
        </section>

        {/* --- How Long To Beat --- */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-parchment">How long to beat</h2>
            <button onClick={fetchHltb} disabled={hltbLoading} className="btn-secondary text-xs">
              {hltbLoading ? "Looking up…" : "Fetch from HowLongToBeat"}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <NumberField label="Main story (hrs)" value={game.hltbMainHours} onSave={(v) => patch({ hltbMainHours: v })} />
            <NumberField label="Main + extra (hrs)" value={game.hltbMainExtraHours} onSave={(v) => patch({ hltbMainExtraHours: v })} />
            <NumberField label="Completionist (hrs)" value={game.hltbCompletionistHours} onSave={(v) => patch({ hltbCompletionistHours: v })} />
          </div>
        </section>

        {/* --- Scores & personal details --- */}
        <section className="mt-8 grid grid-cols-2 gap-4">
          <div>
            <label className="label">Platform</label>
            <select
              className="field"
              value={game.platform}
              onChange={(e) => patch({ platform: e.target.value })}
            >
              {PLATFORM_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              {!(PLATFORM_OPTIONS as readonly string[]).includes(game.platform) && (
                <option value={game.platform}>{game.platform}</option>
              )}
            </select>
          </div>
          <div>
            <label className="label">IGDB score</label>
            <div className="flex items-center gap-2">
              <span className="field flex-1 tabular-nums">
                {game.aggregatedRating != null ? Math.round(game.aggregatedRating) : "—"}
              </span>
              {game.igdbId != null && (
                <button
                  type="button"
                  onClick={refreshIgdbScore}
                  disabled={igdbLoading}
                  className="btn-secondary whitespace-nowrap text-xs"
                >
                  {igdbLoading ? "…" : "Refresh"}
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="label">Condition</label>
            {game.format === "Digital" ? (
              <span className="field block text-mute">N/A — digital</span>
            ) : (
              <select
                className="field"
                value={game.condition ?? ""}
                onChange={(e) => patch({ condition: e.target.value })}
              >
                <option>Complete in box</option>
                <option>Loose cart/disc</option>
                <option>Sealed</option>
                <option>Box only</option>
                <option>Manual only</option>
              </select>
            )}
          </div>
          <div>
            <label className="label">Play status</label>
            <select
              className="field"
              value={game.playStatus}
              onChange={(e) => patch({ playStatus: e.target.value })}
            >
              {PLAY_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Media</label>
            <select
              className="field"
              value={game.format}
              onChange={(e) =>
                patch(
                  e.target.value === "Digital"
                    ? {
                        format: "Digital",
                        condition: null,
                        valueLooseGbp: null,
                        valueCibGbp: null,
                        valueNewGbp: null,
                        valueUpdatedAt: null,
                        valueSource: null,
                      }
                    : {
                        format: "Physical",
                        condition: game.condition ?? "Complete in box",
                      }
                )
              }
            >
              <option>Physical</option>
              <option>Digital</option>
            </select>
          </div>
        </section>

        <section className="mt-6">
          <label className="label">Notes</label>
          <textarea
            className="field min-h-24"
            defaultValue={game.notes ?? ""}
            onBlur={(e) => patch({ notes: e.target.value })}
          />
        </section>

        {saving && <p className="mt-2 text-xs text-mute">Saving…</p>}
      </div>
    </div>
  );
}

function ValueField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number | null;
  onSave: (v: number | null) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-1">
        <span className="text-mute">£</span>
        <input
          type="number"
          step="0.01"
          className="field"
          defaultValue={value ?? ""}
          onBlur={(e) => onSave(e.target.value ? parseFloat(e.target.value) : null)}
        />
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onSave,
  max,
}: {
  label: string;
  value: number | null;
  onSave: (v: number | null) => void;
  max?: number;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        step="0.1"
        max={max}
        className="field"
        defaultValue={value ?? ""}
        onBlur={(e) => onSave(e.target.value ? parseFloat(e.target.value) : null)}
      />
    </div>
  );
}
