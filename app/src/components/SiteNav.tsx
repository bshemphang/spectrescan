// SpectreScan — desktop header nav. Client component: it reads the
// pathname to mark the current page. The active link is unmistakable by
// more than color: ember text and weight plus a violet dot under it, and
// aria-current="page" on the anchor itself, so a screen reader and a
// colorblind reader both get it. Rendered inside a Suspense boundary by
// SiteHeader: with cacheComponents on, usePathname suspends on the
// dynamic /scan/[address] route, and the boundary keeps the shell
// prerendered instead of failing the build.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DESKTOP_NAV, getActiveNav } from "@/lib/nav";

export default function SiteNav() {
  const pathname = usePathname();
  const active = getActiveNav(pathname);

  return (
    <nav
      aria-label="Site"
      className="hidden min-w-0 items-center gap-4 sm:flex"
    >
      {DESKTOP_NAV.map((item) => {
        const isActive = active === item.key;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`relative shrink-0 rounded px-1 py-2 font-mono text-sm whitespace-nowrap transition-colors transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral active:scale-[0.97] ${
              isActive
                ? "font-semibold text-ember"
                : "text-bone-dim hover:text-bone"
            }`}
          >
            {item.label}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute -bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-spectral shadow-[0_0_8px_rgba(167,139,250,0.9)]"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
