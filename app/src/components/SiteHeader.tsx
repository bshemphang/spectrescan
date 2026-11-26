// SpectreScan — site header: wordmark, page nav, sound toggle, chain
// label. Shared by every page.

import Link from "next/link";
import { Ghost } from "lucide-react";
import SoundToggle from "./SoundToggle";

const NAV = [
  { href: "/registry", label: "Registry" },
  { href: "/how-it-works", label: "How it works" },
];

export default function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-3 pt-6">
      <Link
        href="/"
        className="flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-spectral/15 text-spectral">
          <Ghost size={20} strokeWidth={1.5} aria-hidden />
        </span>
        <span className="font-display text-xl font-semibold tracking-tight">
          SpectreScan
        </span>
      </Link>
      <div className="flex items-center gap-2 sm:gap-4">
        <nav aria-label="Site" className="flex items-center gap-3 sm:gap-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded font-mono text-xs text-bone-dim transition-colors hover:text-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral sm:text-sm"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <SoundToggle />
        <span className="hidden font-mono text-xs text-bone-dim sm:inline">
          BSC · Chain 56
        </span>
      </div>
    </header>
  );
}
