"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface PlatformCount {
  platform: string;
  count: number;
}

// Nav is alphabetical: Collection, Discover, Platforms, Release Calendar,
// Settings, Wishlist. "Platforms" is a collapsible group that filters the
// home grid via ?platform=.
export default function Sidebar() {
  const pathname = usePathname();
  const [platforms, setPlatforms] = useState<PlatformCount[]>([]);
  const [platformsOpen, setPlatformsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/platforms")
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setPlatforms(d))
      .catch(() => {});
  }, [pathname]);

  // Close the mobile drawer on navigation.
  useEffect(() => setMobileOpen(false), [pathname]);

  if (pathname === "/login") return null;

  const nav = (
    <nav className="flex flex-col gap-1 text-sm">
      <NavLink href="/" label="Collection" pathname={pathname} exact />

      <NavLink href="/discover" label="Discover" pathname={pathname} />

      {/* Platforms — alphabetical slot, collapsible filter list */}
      <button
        type="button"
        onClick={() => setPlatformsOpen((v) => !v)}
        className="flex items-center justify-between rounded-md px-3 py-2 text-left text-mute transition hover:bg-ink-soft hover:text-parchment"
      >
        <span>Platforms</span>
        <span className="text-xs">{platformsOpen ? "▾" : "▸"}</span>
      </button>
      {platformsOpen && (
        <div className="mb-1 ml-2 flex flex-col gap-0.5 border-l border-ink-line pl-2">
          {platforms.length === 0 && (
            <span className="px-2 py-1 text-xs text-mute">No games yet</span>
          )}
          {platforms.map((p) => (
            <Link
              key={p.platform}
              href={`/?platform=${encodeURIComponent(p.platform)}`}
              className="flex items-center justify-between rounded px-2 py-1 text-xs text-mute transition hover:bg-ink-soft hover:text-parchment"
            >
              <span className="truncate">{p.platform}</span>
              <span className="ml-2 shrink-0 text-[10px] text-mute">{p.count}</span>
            </Link>
          ))}
        </div>
      )}

      <NavLink href="/calendar" label="Release Calendar" pathname={pathname} />
      <NavLink href="/settings" label="Settings" pathname={pathname} />
      <NavLink href="/wishlist" label="Wishlist" pathname={pathname} />
    </nav>
  );

  const brand = (
    <Link href="/" className="font-display text-lg font-bold tracking-tight text-parchment">
      Game<span className="text-amber">Vault</span>
    </Link>
  );

  return (
    <>
      {/* Desktop: fixed left rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-ink-line bg-ink/95 px-3 py-5 lg:flex">
        <div className="px-2">{brand}</div>
        <Link href="/games/add" className="btn-primary mt-4 w-full text-center text-sm">
          Add a game
        </Link>
        <div className="mt-5">{nav}</div>
      </aside>

      {/* Mobile: top bar + dropdown drawer */}
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-ink-line bg-ink/95 px-4 py-3 backdrop-blur lg:hidden">
        {brand}
        <div className="flex items-center gap-2">
          <Link href="/games/add" className="btn-primary text-xs">
            Add
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
            className="rounded-md border border-ink-line px-3 py-1.5 text-parchment"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>
      {mobileOpen && (
        <div className="fixed inset-x-0 top-[52px] z-20 border-b border-ink-line bg-ink px-4 py-3 lg:hidden">
          {nav}
        </div>
      )}
    </>
  );
}

function NavLink({
  href,
  label,
  pathname,
  exact,
}: {
  href: string;
  label: string;
  pathname: string;
  exact?: boolean;
}) {
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-2 transition ${
        active
          ? "bg-ink-soft font-medium text-parchment"
          : "text-mute hover:bg-ink-soft hover:text-parchment"
      }`}
    >
      {label}
    </Link>
  );
}
