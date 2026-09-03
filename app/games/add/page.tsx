"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { PLATFORM_OPTIONS, pickPreferredPlatform } from "@/lib/platforms";

interface IgdbHit {
  igdbId: number;
  title: string;
  coverUrl: string | null;
  releaseDate: string | null;
  platforms: string[];
}

export default function AddGamePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IgdbHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    platform: "PlayStation 5",
    region: "",
    condition: "Complete in box",
    format: "Physical",
    igdbId: null as number | null,
    coverUrl: "",
    releaseDate: "",
    summary: "",
    genres: [] as string[],
    developer: "",
    publisher: "",
    aggregatedRating: null as number | null,
  });
  const [saving, setSaving] = useState(false);

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/igdb/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setResults(data);
    } catch (e: any) {
      setSearchError(e.message);
    } finally {
      setSearching(false);
    }
  }

  async function pickResult(hit: IgdbHit) {
    setSearchError(null);
    try {
      const res = await fetch(`/api/igdb/search?igdbId=${hit.igdbId}`);
      const detail = await res.json();
      if (!res.ok) throw new Error(detail.error ?? "Lookup failed");

      setForm((f) => ({
        ...f,
        title: detail.title,
        igdbId: detail.igdbId,
        coverUrl: detail.coverUrl ?? "",
        releaseDate: detail.releaseDate ? detail.releaseDate.slice(0, 10) : "",
        summary: detail.summary ?? "",
        genres: detail.genres ?? [],
        developer: detail.developer ?? "",
        publisher: detail.publisher ?? "",
        aggregatedRating: detail.aggregatedRating ?? null,
        platform: hit.platforms.length > 0 ? pickPreferredPlatform(hit.platforms) : f.platform,
      }));
      setResults([]);
    } catch (e: any) {
      setSearchError(e.message);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.platform) return;
    setSaving(true);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const game = await res.json();
      if (!res.ok) throw new Error(game.error ?? "Save failed");
      router.push(`/games/${game.id}`);
    } catch (e: any) {
      setSearchError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-parchment">Add a game</h1>
      <p className="mt-1 text-sm text-mute">
        Search IGDB to auto-fill cover art and details, or skip straight to
        the form and enter everything yourself.
      </p>

      <div className="mt-6 flex gap-2">
        <input
          className="field"
          placeholder="Search by title, e.g. Chrono Trigger"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={searching}
          className="btn-secondary whitespace-nowrap"
        >
          {searching ? "Searching…" : "Search IGDB"}
        </button>
      </div>

      {searchError && (
        <p className="mt-2 text-sm text-red-400">{searchError}</p>
      )}

      {results.length > 0 && (
        <ul className="mt-4 divide-y divide-ink-line rounded-card border border-ink-line bg-ink-soft">
          {results.map((hit) => (
            <li key={hit.igdbId}>
              <button
                type="button"
                onClick={() => pickResult(hit)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ink-softer"
              >
                <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded bg-ink-softer">
                  {hit.coverUrl && (
                    <Image src={hit.coverUrl} alt={hit.title} fill className="object-cover" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-parchment">{hit.title}</p>
                  <p className="text-xs text-mute">
                    {hit.platforms.join(", ") || "Unknown platform"}
                    {hit.releaseDate && ` · ${hit.releaseDate.slice(0, 4)}`}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div className="flex gap-4">
          {form.coverUrl && (
            <div className="relative h-36 w-28 flex-shrink-0 overflow-hidden rounded-card border border-ink-line">
              <Image src={form.coverUrl} alt={form.title} fill className="object-cover" />
            </div>
          )}
          <div className="flex-1 space-y-4">
            <div>
              <label className="label">Title *</label>
              <input
                className="field"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Platform *</label>
                <select
                  className="field"
                  required
                  value={form.platform}
                  onChange={(e) => setForm({ ...form, platform: e.target.value })}
                >
                  {PLATFORM_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                  {/* If IGDB returned a platform not in our standard list, keep it selectable. */}
                  {!(PLATFORM_OPTIONS as readonly string[]).includes(form.platform) && form.platform && (
                    <option value={form.platform}>{form.platform}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="label">Region</label>
                <input
                  className="field"
                  placeholder="e.g. PAL"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Condition</label>
            <select
              className="field"
              value={form.condition}
              onChange={(e) => setForm({ ...form, condition: e.target.value })}
            >
              <option>Complete in box</option>
              <option>Loose cart/disc</option>
              <option>Sealed</option>
              <option>Box only</option>
              <option>Manual only</option>
            </select>
          </div>
          <div>
            <label className="label">Format</label>
            <select
              className="field"
              value={form.format}
              onChange={(e) => setForm({ ...form, format: e.target.value })}
            >
              <option>Physical</option>
              <option>Digital</option>
            </select>
          </div>
        </div>

        {form.genres.length > 0 && (
          <p className="text-sm text-mute">Genres: {form.genres.join(", ")}</p>
        )}

        <div className="pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Add to collection"}
          </button>
        </div>
      </form>
    </div>
  );
}
