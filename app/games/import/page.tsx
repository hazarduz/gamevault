"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { PLATFORM_OPTIONS, pickPreferredPlatform } from "@/lib/platforms";

interface IgdbHit {
  igdbId: number;
  title: string;
  coverUrl: string | null;
  releaseDate: string | null;
  platforms: string[];
}

interface Candidate {
  id: string;
  query: string;
  hint: string | null;
  matches: IgdbHit[];
  matchIdx: number; // -1 = "add as typed"
  platform: string;
  include: boolean;
  searching: boolean;
}

const JUNK: RegExp[] = [
  /^(pegi|esrb|usk|rating)\b/i,
  /^(the )?(video ?game|game of the year|goty)$/i,
  /^(standard|deluxe|collector'?s|special|limited|gold|ultimate|complete)\s+edition$/i,
  /^(only on|exclusive to|available on|now on|coming soon)\b/i,
  /^(©|\(c\)|copyright|all rights reserved)/i,
  /^\W+$/,
  /^\d+$/,
  /^(playstation( ?[1-5])?|nintendo( switch)?( ?2)?|switch|xbox( one| series x\|?s?| 360)?|microsoft|sony( interactive)?|ubisoft|electronic arts|ea( games| sports)?|activision|blizzard|bethesda|sega|capcom|konami|bandai ?namco|square ?enix|warner ?bros|steam)$/i,
];

function isJunk(l: string) {
  return JUNK.some((re) => re.test(l));
}

function parseLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 3 && /[a-z]/i.test(l) && !isJunk(l));
}

function platformHint(text: string): string | null {
  const t = text.toLowerCase();
  const map: [RegExp, string][] = [
    [/nintendo switch ?2|\bswitch ?2\b/, "Nintendo Switch 2"],
    [/nintendo switch|\bswitch\b/, "Nintendo Switch"],
    [/playstation ?5|\bps5\b/, "PlayStation 5"],
    [/playstation ?4|\bps4\b/, "PlayStation 4"],
    [/playstation ?3|\bps3\b/, "PlayStation 3"],
    [/xbox series|xbox one x\|?s/, "Xbox Series X|S"],
    [/xbox one/, "Xbox One"],
    [/xbox 360/, "Xbox 360"],
    [/\bpc\b|steam|windows/, "PC"],
  ];
  for (const [re, name] of map) if (re.test(t)) return name;
  return null;
}

function defaultPlatform(match: IgdbHit | undefined, hint: string | null): string {
  if (match?.platforms?.length) {
    const p = pickPreferredPlatform(match.platforms);
    if ((PLATFORM_OPTIONS as readonly string[]).includes(p)) return p;
  }
  return hint ?? PLATFORM_OPTIONS[0];
}

async function searchIgdb(query: string): Promise<IgdbHit[]> {
  try {
    const res = await fetch(`/api/igdb/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.slice(0, 6) : [];
  } catch {
    return [];
  }
}

export default function ImportPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState<{ imported: number; skipped: number } | null>(null);

  async function scan() {
    if (files.length === 0) return;
    setScanning(true);
    setMsg(null);
    setDone(null);
    setCandidates([]);
    setProgress("Loading OCR engine…");

    try {
      const { createWorker } = await import("tesseract.js");
      let scanIndex = 0;
      const worker = await createWorker("eng", 1, {
        logger: (m: any) => {
          if (m.status === "recognizing text") {
            setProgress(
              `Reading image ${scanIndex + 1} of ${files.length} — ${Math.round(
                (m.progress ?? 0) * 100
              )}%`
            );
          }
        },
      });

      const seen = new Set<string>();
      const found: { line: string; hint: string | null }[] = [];

      for (scanIndex = 0; scanIndex < files.length; scanIndex++) {
        setProgress(`Reading image ${scanIndex + 1} of ${files.length}…`);
        const { data } = await worker.recognize(files[scanIndex]);
        const hint = platformHint(data.text || "");
        for (const line of parseLines(data.text || "")) {
          const key = line.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          found.push({ line, hint });
        }
      }
      await worker.terminate();

      if (found.length === 0) {
        setProgress(null);
        setMsg("No readable text found. Try clearer, straight-on photos.");
        return;
      }

      setProgress(`Matching ${found.length} titles against IGDB…`);
      const rows: Candidate[] = [];
      for (let i = 0; i < found.length; i += 4) {
        const batch = found.slice(i, i + 4);
        const results = await Promise.all(batch.map((f) => searchIgdb(f.line)));
        batch.forEach((f, j) => {
          const matches = results[j];
          rows.push({
            id: `${i + j}`,
            query: f.line,
            hint: f.hint,
            matches,
            matchIdx: matches.length > 0 ? 0 : -1,
            platform: defaultPlatform(matches[0], f.hint),
            include: matches.length > 0,
            searching: false,
          });
        });
      }
      setCandidates(rows);
      setProgress(null);
    } catch (e: any) {
      setProgress(null);
      setMsg(e?.message || "OCR failed.");
    } finally {
      setScanning(false);
    }
  }

  function patch(id: string, next: Partial<Candidate>) {
    setCandidates((cs) => cs.map((c) => (c.id === id ? { ...c, ...next } : c)));
  }

  async function research(c: Candidate) {
    patch(c.id, { searching: true });
    const matches = await searchIgdb(c.query);
    patch(c.id, {
      matches,
      matchIdx: matches.length > 0 ? 0 : -1,
      platform: defaultPlatform(matches[0], c.hint),
      searching: false,
    });
  }

  async function addAll() {
    const games = candidates
      .filter((c) => c.include)
      .map((c) => {
        const m = c.matchIdx >= 0 ? c.matches[c.matchIdx] : undefined;
        return {
          igdbId: m?.igdbId,
          title: (m?.title ?? c.query).trim(),
          platform: c.platform,
        };
      })
      .filter((g) => g.title && g.platform);

    if (games.length === 0) {
      setMsg("Nothing ticked to add.");
      return;
    }
    setAdding(true);
    setMsg(null);
    try {
      const res = await fetch("/api/games/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ games }),
      });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error ?? "Import failed.");
      setDone({ imported: r.imported, skipped: r.skipped });
      setCandidates([]);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setAdding(false);
    }
  }

  const includeCount = candidates.filter((c) => c.include).length;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-parchment">
        Import games from photos
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-mute">
        Upload photos of box fronts, shelves, screenshots or lists. Text is read
        in your browser (no upload), matched against IGDB, and you confirm each
        row before anything is added. Straight-on box art and screenshots work
        best; angled spines are hit-and-miss.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="block text-xs text-mute file:mr-3 file:rounded file:border file:border-ink-line file:bg-ink file:px-2 file:py-1 file:text-parchment"
        />
        <button
          type="button"
          onClick={scan}
          disabled={scanning || files.length === 0}
          className="btn-primary text-xs"
        >
          {scanning ? "Scanning…" : `Scan ${files.length || ""} image${files.length === 1 ? "" : "s"}`}
        </button>
      </div>

      {progress && <p className="mt-3 text-xs text-amber">{progress}</p>}
      {msg && <p className="mt-3 text-sm text-amber">{msg}</p>}
      {done && (
        <p className="mt-4 text-sm text-parchment">
          Added {done.imported} game{done.imported === 1 ? "" : "s"}
          {done.skipped ? `, skipped ${done.skipped} already in your collection` : ""}.{" "}
          <Link href="/" className="text-amber underline">
            Back to your collection
          </Link>
        </p>
      )}

      {candidates.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-mute">
              {candidates.length} detected · {includeCount} ticked
            </p>
            <button
              type="button"
              onClick={addAll}
              disabled={adding || includeCount === 0}
              className="btn-primary text-xs"
            >
              {adding ? "Adding…" : `Add ${includeCount} game${includeCount === 1 ? "" : "s"}`}
            </button>
          </div>

          <div className="space-y-2">
            {candidates.map((c) => {
              const m = c.matchIdx >= 0 ? c.matches[c.matchIdx] : undefined;
              return (
                <div
                  key={c.id}
                  className={`rounded-card border border-ink-line bg-ink-soft p-2 ${
                    c.include ? "" : "opacity-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={c.include}
                      onChange={(e) => patch(c.id, { include: e.target.checked })}
                      className="mt-1.5 accent-amber"
                    />
                    <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded bg-ink-softer">
                      {m?.coverUrl && (
                        <Image src={m.coverUrl} alt="" fill className="object-cover" />
                      )}
                    </div>
                    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_1fr_10rem]">
                      <div className="flex gap-1">
                        <input
                          className="field text-xs"
                          value={c.query}
                          onChange={(e) => patch(c.id, { query: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && research(c)}
                        />
                        <button
                          type="button"
                          onClick={() => research(c)}
                          disabled={c.searching}
                          className="btn-secondary whitespace-nowrap px-2 text-xs"
                        >
                          {c.searching ? "…" : "Search"}
                        </button>
                      </div>
                      <select
                        className="field text-xs"
                        value={c.matchIdx}
                        onChange={(e) => {
                          const idx = Number(e.target.value);
                          patch(c.id, {
                            matchIdx: idx,
                            platform: defaultPlatform(
                              idx >= 0 ? c.matches[idx] : undefined,
                              c.hint
                            ),
                          });
                        }}
                      >
                        {c.matches.map((mm, i) => (
                          <option key={mm.igdbId} value={i}>
                            {mm.title}
                            {mm.releaseDate ? ` (${mm.releaseDate.slice(0, 4)})` : ""}
                          </option>
                        ))}
                        <option value={-1}>Add as typed — no IGDB</option>
                      </select>
                      <select
                        className="field text-xs"
                        value={c.platform}
                        onChange={(e) => patch(c.id, { platform: e.target.value })}
                      >
                        {PLATFORM_OPTIONS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setCandidates((cs) => cs.filter((x) => x.id !== c.id))
                      }
                      className="mt-1 text-mute transition hover:text-red-400"
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
