"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <header className="border-b border-ink-line bg-ink/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-lg font-bold tracking-tight text-parchment">
            Game<span className="text-amber">Vault</span>
          </span>
        </Link>
        {!isLoginPage && (
          <div className="flex items-center gap-3">
            <Link href="/settings" className="btn-secondary">
              Settings
            </Link>
            <Link href="/games/add" className="btn-primary">
              Add a game
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
