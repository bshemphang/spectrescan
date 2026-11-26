// SpectreScan — site footer: the not-an-audit disclaimer plus
// sources and page links. Shared by every page.

import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/8 py-6 text-xs leading-relaxed text-bone-dim">
      <p>
        SpectreScan is not an audit. Never invest more than you can afford to lose. It reads
        the verified source and public on-chain data; it cannot see
        hidden behaviour, and it never calls a contract safe. Sources:
        Sourcify (verified source), public BSC RPCs (on-chain state),
        Dexscreener (pairs and liquidity). Built for Kiroween 2026,
        Frankenstein category.
      </p>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono">
        <Link
          href="/registry"
          className="hover:text-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
        >
          Registry
        </Link>
        <Link
          href="/how-it-works"
          className="hover:text-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
        >
          How it works
        </Link>
        <a
          href="https://github.com/bshemphang/spectrescan"
          className="hover:text-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
        >
          GitHub
        </a>
        <a
          href="https://spectrescan.onrender.com"
          className="hover:text-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
        >
          spectrescan.onrender.com
        </a>
      </p>
    </footer>
  );
}
