"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PLAY_STATUS_OPTIONS } from "@/lib/play-status";

// Filters for the collection grid — status, media, platform. Each just
// sets/clears a URL param and lets the (server) home page re-query;
// other params (q, sort, …) are preserved.
export default function FilterBar({ platforms }: { platforms: string[] }) {
  const router = useRouter();
  const sp = useSearchParams();

  function set(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  const cls = "field w-auto text-xs";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={cls}
        value={sp.get("status") ?? ""}
        onChange={(e) => set("status", e.target.value)}
      >
        <option value="">All statuses</option>
        {PLAY_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        className={cls}
        value={sp.get("media") ?? ""}
        onChange={(e) => set("media", e.target.value)}
      >
        <option value="">Physical &amp; digital</option>
        <option value="Physical">Physical</option>
        <option value="Digital">Digital</option>
      </select>

      <select
        className={cls}
        value={sp.get("platform") ?? ""}
        onChange={(e) => set("platform", e.target.value)}
      >
        <option value="">All platforms</option>
        {platforms.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </div>
  );
}
