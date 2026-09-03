"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PLAY_STATUS_OPTIONS } from "@/lib/play-status";

// A single "Filters" button with a small dropdown (status / media /
// platform) and removable chips for whatever's active. Each control just
// sets/clears a URL param and lets the server page re-query.
export default function FilterBar({ platforms }: { platforms: string[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const status = sp.get("status") ?? "";
  const media = sp.get("media") ?? "";
  const platform = sp.get("platform") ?? "";
  const active = [status, media, platform].filter(Boolean).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function set(key: string, value: string) {
    const p = new URLSearchParams(sp.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    const qs = p.toString();
    router.push(qs ? `/?${qs}` : "/");
  }
  function clearAll() {
    const p = new URLSearchParams(sp.toString());
    p.delete("status");
    p.delete("media");
    p.delete("platform");
    const qs = p.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  const statusLabel = PLAY_STATUS_OPTIONS.find((o) => o.value === status)?.label;

  const chip = (label: string, onClear: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1 rounded-full border border-ink-line bg-ink-soft px-2.5 py-1 text-xs text-parchment transition hover:border-mute"
    >
      {label} <span className="text-mute">✕</span>
    </button>
  );

  return (
    <div ref={ref} className="relative flex flex-wrap items-center gap-2">
      {statusLabel && chip(statusLabel, () => set("status", ""))}
      {media && chip(media, () => set("media", ""))}
      {platform && chip(platform, () => set("platform", ""))}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-secondary flex items-center gap-1.5 text-xs"
      >
        Filters
        {active > 0 && (
          <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber px-1 text-[10px] font-bold text-ink">
            {active}
          </span>
        )}
        <span className="text-mute">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-card border border-ink-line bg-ink-soft p-3 shadow-lg">
          <Field label="Status" value={status} onChange={(v) => set("status", v)}>
            <option value="">Any</option>
            {PLAY_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Field>
          <Field label="Media" value={media} onChange={(v) => set("media", v)}>
            <option value="">Any</option>
            <option value="Physical">Physical</option>
            <option value="Digital">Digital</option>
          </Field>
          <Field label="Platform" value={platform} onChange={(v) => set("platform", v)}>
            <option value="">Any</option>
            {platforms.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Field>
          {active > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-amber hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-2 block">
      <span className="mb-1 block text-xs text-mute">{label}</span>
      <select
        className="field text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}
