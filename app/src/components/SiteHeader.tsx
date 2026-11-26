// SpectreScan — site header: wordmark plus a quiet chain label.
// Shared by the home page and the scan page.

import Link from "next/link";
import { Ghost } from "lucide-react";

export default function SiteHeader() {
  return (
    <header className="flex items-center justify-between pt-6">
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
      <span className="font-mono text-xs text-bone-dim">BSC · Chain 56</span>
    </header>
  );
}
