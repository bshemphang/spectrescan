// SpectreScan — site footer: the not-an-audit disclaimer plus sources.
// Shared by the home page and the scan page.

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/8 py-6 text-xs leading-relaxed text-bone-dim">
      SpectreScan is a public-signal checker, not an audit. It reads the
      verified source and public on-chain data; it cannot see hidden
      behaviour, and it never calls a contract safe. Sources: Sourcify
      (verified source), public BSC RPCs (on-chain state), Dexscreener
      (pairs and liquidity). Built for Kiroween 2026, Frankenstein category.
    </footer>
  );
}
