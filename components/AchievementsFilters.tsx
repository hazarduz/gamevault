"use client";

import { useRouter, useSearchParams } from "next/navigation";

const KIND_OPTIONS = [
  { value: "", label: "All types" },
  { value: "trophy", label: "PSN Trophies" },
  { value: "achievement", label: "Steam Achievements" },
  { value: "retroachievement", label: "RetroAchievements" },
];

export default function AchievementsFilters({ platforms }: { platforms: string[] }) {
  const router = useRouter();
  const sp = useSearchParams();

  const kind = sp.get("kind") ?? "";
  const platform = sp.get("platform") ?? "";

  function set(key: string, value: string) {
    const p = new URLSearchParams(sp.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    const qs = p.toString();
    router.push(qs ? `/achievements?${qs}` : "/achievements");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className="field text-sm" value={kind} onChange={(e) => set("kind", e.target.value)}>
        {KIND_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className="field text-sm"
        value={platform}
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
