// SpectreScan — mobile navigation. A fixed bottom tab bar for the four
// sections people use most (Home, Explorer, Watchlist, Wallet) plus a
// More button that opens a bottom sheet with the rest of the site in
// full, never truncated. Client component: it reads the pathname to mark
// the current tab. Rendered inside a Suspense boundary by SiteHeader:
// with cacheComponents on, usePathname suspends on the dynamic
// /scan/[address] route, and the boundary keeps the shell prerendered.
//
// The active tab is unmistakable by more than color: ember icon and
// label plus a violet dot under it, and aria-current="page" on the anchor
// itself. The sheet traps focus while open, closes on Escape and on
// selection, returns focus to the More button on close, and locks body
// scroll while open. The tab bar sits above the page footer by body
// padding (globals.css), and the ghost back-to-top button is raised above
// the bar on phones, so the two never cover each other.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Braces,
  CircleHelp,
  Compass,
  Database,
  Ellipsis,
  Home,
  Layers,
  Star,
  Wallet,
  X,
} from "lucide-react";
import { MORE_NAV, TAB_NAV, getActiveNav, type NavKey } from "@/lib/nav";

const TAB_ICONS: Record<string, typeof Home> = {
  home: Home,
  explorer: Compass,
  watchlist: Star,
  wallet: Wallet,
};

const MORE_ICONS: Record<NavKey, typeof Home> = {
  home: Home,
  explorer: Compass,
  watchlist: Star,
  wallet: Wallet,
  learn: BookOpen,
  api: Braces,
  registry: Database,
  bulk: Layers,
  how: CircleHelp,
};

export default function MobileNav() {
  const pathname = usePathname();
  const active = getActiveNav(pathname);
  const [open, setOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Navigation closes the sheet in every mounted instance. This matters
  // because Next keeps the previous route mounted but hidden after a
  // client-side navigation: without it, the old tree's scroll lock
  // (below) would stay on and the new page could not scroll.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Open: lock body scroll and move focus into the sheet. Close: unlock
  // and return focus to the More button that opened it.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const sheet = sheetRef.current;
    const first = sheet?.querySelector<HTMLElement>("a[href], button");
    first?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      moreButtonRef.current?.focus();
    };
  }, [open ]);

  // Focus trap and Escape, both scoped to the sheet.
  const onSheetKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab") return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const items = Array.from(
      sheet.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <nav
        aria-label="Site"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-haunt-border bg-[#0c0a12]/95 backdrop-blur sm:hidden"
      >
        <div
          className="flex items-stretch"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {TAB_NAV.map((item) => {
            const Icon = TAB_ICONS[item.key];
            const isActive = active === item.key;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 py-2 transition-transform focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-spectral active:scale-[0.97] ${
                  isActive ? "text-ember" : "text-bone-dim"
                }`}
              >
                <Icon size={20} strokeWidth={1.5} aria-hidden />
                <span className="text-[11px] leading-none font-medium">
                  {item.label}
                </span>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-spectral shadow-[0_0_8px_rgba(167,139,250,0.9)]"
                  />
                )}
              </Link>
            );
          })}
          <button
            ref={moreButtonRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="more-sheet"
            aria-label="More pages"
            className="relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 py-2 text-bone-dim focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-spectral"
          >
            <Ellipsis size={20} strokeWidth={1.5} aria-hidden />
            <span className="text-[11px] leading-none font-medium">More</span>
          </button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={close}
            className="absolute inset-0 cursor-default bg-black/70"
          />
          <div
            ref={sheetRef}
            id="more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More pages"
            onKeyDown={onSheetKeyDown}
            className="sheet-in absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-haunt-border bg-haunt-panel px-4 pt-3"
            style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-xs tracking-widest text-bone-dim uppercase">
                More pages
              </p>
              <button
                type="button"
                onClick={close}
                aria-label="Close menu"
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 text-bone-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
              >
                <X size={18} strokeWidth={1.5} aria-hidden />
              </button>
            </div>
            <ul>
              {MORE_NAV.map((item) => {
                const Icon = MORE_ICONS[item.key];
                const isActive = active === item.key;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      onClick={close}
                      className={`flex min-h-12 items-center gap-3 rounded-lg px-3 py-3 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral active:scale-[0.98] ${
                        isActive
                          ? "font-semibold text-ember"
                          : "text-bone hover:bg-white/[0.04]"
                      }`}
                    >
                      <Icon size={18} strokeWidth={1.5} aria-hidden />
                      <span className="text-sm">{item.label}</span>
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="ml-auto h-1.5 w-1.5 rounded-full bg-spectral shadow-[0_0_8px_rgba(167,139,250,0.9)]"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
