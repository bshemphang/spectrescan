// SpectreScan — site header: wordmark, page nav, sound toggle, chain
// label. Shared by every page. The wordmark is the home link: one
// click from anywhere returns to the homepage.
//
// The nav is split by screen size. On a wide screen the header carries
// the full horizontal nav (SiteNav, with the current page marked). On a
// phone the header keeps only the wordmark and the sound toggle, and the
// navigation lives in a fixed bottom tab bar (MobileNav) with a More
// sheet, because the old horizontal row overflowed and was cut off
// mid-word. Both nav parts are client components that read the pathname,
// so each sits inside a Suspense boundary: with cacheComponents on,
// usePathname suspends on the dynamic /scan/[address] route, and the
// boundary keeps the shell prerendered instead of failing the build.

import { Suspense } from "react";
import Link from "next/link";
import { Ghost } from "lucide-react";
import SoundToggle from "./SoundToggle";
import SiteNav from "./SiteNav";
import MobileNav from "./MobileNav";

export default function SiteHeader() {
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-6">
        <Link
          href="/"
          aria-label="SpectreScan home"
          className="flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-spectral/15 text-spectral">
            <Ghost size={20} strokeWidth={1.5} aria-hidden />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">
            SpectreScan
          </span>
        </Link>
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <Suspense
            fallback={
              <nav
                aria-label="Site"
                className="hidden min-w-0 items-center gap-4 sm:flex"
              />
            }
          >
            <SiteNav />
          </Suspense>
          <SoundToggle />
          <span className="hidden font-mono text-xs whitespace-nowrap text-bone-dim sm:inline">
            BSC · Chain 56
          </span>
        </div>
      </header>
      <Suspense fallback={null}>
        <MobileNav />
      </Suspense>
    </>
  );
}
