"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { VIEW_OPTIONS, DEFAULT_VIEW, type ViewMode } from "@/lib/view-mode";

// Same approach as SortSelect: push `?view=` into the URL (dropping it
// entirely at the default) and let the server page re-render.
export default function ViewSelect({ current }: { current: ViewMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setView(v: ViewMode) {
    const params = new URLSearchParams(searchParams.toString());
    if (v === DEFAULT_VIEW) params.delete("view");
    else params.set("view", v);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-ink-line p-0.5">
      {VIEW_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setView(o.value)}
          aria-label={o.label}
          aria-pressed={current === o.value}
          title={o.label}
          className={`flex h-7 w-7 items-center justify-center rounded transition ${
            current === o.value
              ? "bg-ink-soft text-amber"
              : "text-mute hover:text-parchment"
          }`}
        >
          <ViewIcon mode={o.value} />
        </button>
      ))}
    </div>
  );
}

function ViewIcon({ mode }: { mode: ViewMode }) {
  if (mode === "small") {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <rect x="2" y="2" width="4" height="4" rx="0.6" />
        <rect x="8" y="2" width="4" height="4" rx="0.6" />
        <rect x="14" y="2" width="4" height="4" rx="0.6" />
        <rect x="2" y="8" width="4" height="4" rx="0.6" />
        <rect x="8" y="8" width="4" height="4" rx="0.6" />
        <rect x="14" y="8" width="4" height="4" rx="0.6" />
        <rect x="2" y="14" width="4" height="4" rx="0.6" />
        <rect x="8" y="14" width="4" height="4" rx="0.6" />
        <rect x="14" y="14" width="4" height="4" rx="0.6" />
      </svg>
    );
  }
  if (mode === "list") {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <rect x="2" y="3" width="16" height="3" rx="1" />
        <rect x="2" y="8.5" width="16" height="3" rx="1" />
        <rect x="2" y="14" width="16" height="3" rx="1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <rect x="2" y="2" width="7" height="7" rx="1" />
      <rect x="11" y="2" width="7" height="7" rx="1" />
      <rect x="2" y="11" width="7" height="7" rx="1" />
      <rect x="11" y="11" width="7" height="7" rx="1" />
    </svg>
  );
}
