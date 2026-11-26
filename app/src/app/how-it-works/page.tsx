// SpectreScan — how it works: the autopsy page. The nine checks in
// full, the scoring weights and bands, and the honest limits: what
// the scan cannot see. Everything here is the real engine, described
// in plain words. No claims, only mechanics.

import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "How it works | SpectreScan",
  description:
    "The nine checks, the scoring weights, and the honest limits of a SpectreScan report.",
};

const CHECKS: Array<{
  id: string;
  name: string;
  what: string;
  evidence: string;
}> = [
  {
    id: "R1",
    name: "Source verification",
    what: "Fetches the verified source from Sourcify. A perfect match means the published code is the deployed code. A partial match means only part of it matches. No match means the code cannot be read at all, and only the on-chain footprint can be checked.",
    evidence: "Sourcify match status.",
  },
  {
    id: "R2",
    name: "Source patterns",
    what: "Reads the verified source for honeypot patterns: a blacklist function, an owner-controlled trading switch, owner-settable max transaction and wallet limits, owner-settable buy and sell fees, a pause function, and a public mint function. Each pattern is matched against the code, not guessed from the name.",
    evidence: "File and line, for example AGIOToken.sol:24.",
  },
  {
    id: "R3",
    name: "Deployer mint",
    what: "Checks whether the deployer minted the supply at launch, in the constructor, in initialize(), or by a top-level assignment. Minting 90 percent or more counts as almost the entire supply.",
    evidence: "File and line, for example DigitalToken.sol:22.",
  },
  {
    id: "R4",
    name: "Supply cap",
    what: "A mint is less dangerous when a supply cap is enforced by a hardcoded constant, an immutable, or a literal. A cap stored in a variable the owner can change does not count.",
    evidence: "The cap constant in the source.",
  },
  {
    id: "R5",
    name: "Owner",
    what: "Calls owner() and classifies what answers: a wallet, a verified contract whose rules are public code, or an unverified contract hiding the real controller. A mint governed by a verified contract scores lower than a mint one wallet controls.",
    evidence: "The owner() return value, plus the owner contract's Sourcify status.",
  },
  {
    id: "R6",
    name: "Ownership renounced",
    what: "owner() returns the zero address, so no one can call owner-only functions any more. Minting, pausing, and fee changes are locked out.",
    evidence: "owner() = 0x000…000.",
  },
  {
    id: "R7",
    name: "LP burn share",
    what: "Reads the pair's total LP supply and the balances sitting in burn addresses, and computes the burned share. V3 concentrated-liquidity pools have no LP token, so their lock status is unknown and is reported as unknown, never as clean.",
    evidence: "The measured burn share, for example 92.4 percent.",
  },
  {
    id: "R8",
    name: "Holder concentration",
    what: "Reads the share of total supply sitting in the main DEX pair, from Dexscreener pair data. This is a pair-share proxy, not a full holder list. The address dossier separately scans Transfer logs for the last 20,000 blocks, about 17 hours on BSC, and shows the real movement.",
    evidence: "The pair share with the proxy label.",
  },
  {
    id: "R9",
    name: "Pair health",
    what: "Reads the best-liquidity pair from Dexscreener: liquidity in dollars and the 24 hour buy and sell counts. Thin liquidity and heavy selling are flagged.",
    evidence: "The measured liquidity and the 24 hour buy and sell counts.",
  },
];

const WEIGHTS = [
  { severity: "Critical", weight: 75, note: "One critical finding alone reaches Possessed." },
  { severity: "High", weight: 50, note: "One high finding alone reaches Haunted." },
  { severity: "Medium", weight: 12, note: "Two mediums together read Mildly haunted." },
  { severity: "Low", weight: 5, note: "Small signals, never enough alone." },
  { severity: "Info", weight: 0, note: "Context only. Never moves the score." },
];

const BANDS = [
  { range: "0 to 12", band: "Resting in peace" },
  { range: "13 to 49", band: "Mildly haunted" },
  { range: "50 to 74", band: "Haunted" },
  { range: "75 to 100", band: "Possessed" },
];

export default function HowItWorksPage() {
  return (
    <div className="relative z-[2] mx-auto w-full max-w-6xl px-5 sm:px-8">
      <SiteHeader />
      <main id="main" className="pb-16">
        <section aria-labelledby="how-heading" className="pt-12">
          <p className="font-mono text-xs tracking-widest text-spectral">
            $ spectre explain --full
          </p>
          <h1
            id="how-heading"
            className="mt-3 font-haunt text-4xl font-medium text-bone sm:text-5xl"
          >
            How the ghost decides
          </h1>
          <p className="mt-4 max-w-[65ch] leading-relaxed text-bone-dim">
            Nine fixed checks read the evidence. Each finding adds a fixed
            weight. The total is the score. A language model then turns
            the findings into plain English; it never changes the score
            and never invents a finding. That split, rules decide and
            words explain, is what makes a verdict checkable.
          </p>
        </section>

        <section aria-labelledby="checks-heading" className="mt-12">
          <h2
            id="checks-heading"
            className="font-display text-2xl font-semibold text-bone"
          >
            The nine checks
          </h2>
          <ol className="mt-6 space-y-5">
            {CHECKS.map((check) => (
              <li
                key={check.id}
                className="rounded-2xl border border-haunt-border bg-haunt-panel p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="font-mono text-sm font-semibold text-spectral">
                    {check.id}
                  </span>
                  <h3 className="font-display text-lg font-semibold text-bone">
                    {check.name}
                  </h3>
                </div>
                <p className="mt-2 max-w-[75ch] text-sm leading-relaxed text-bone-dim">
                  {check.what}
                </p>
                <p className="mt-2 font-mono text-xs text-bone-dim">
                  Evidence: {check.evidence}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="scoring-heading" className="mt-12">
          <h2
            id="scoring-heading"
            className="font-display text-2xl font-semibold text-bone"
          >
            The score
          </h2>
          <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-bone-dim">
            The score is a sum of fixed severity weights, capped at 100.
            Adding a finding can never lower the score, and the same
            findings always give the same score. Property tests prove
            both.
          </p>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-haunt-border bg-haunt-panel">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-5 py-3 font-mono text-xs text-bone-dim">
                      Severity
                    </th>
                    <th className="px-5 py-3 font-mono text-xs text-bone-dim">
                      Weight
                    </th>
                    <th className="px-5 py-3 font-mono text-xs text-bone-dim">
                      Means
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {WEIGHTS.map((row) => (
                    <tr key={row.severity} className="border-b border-white/5 last:border-0">
                      <td className="px-5 py-3 text-bone">{row.severity}</td>
                      <td className="px-5 py-3 font-mono text-bone tabular-nums">
                        {row.weight}
                      </td>
                      <td className="px-5 py-3 text-bone-dim">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="overflow-hidden rounded-2xl border border-haunt-border bg-haunt-panel">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-5 py-3 font-mono text-xs text-bone-dim">
                      Score
                    </th>
                    <th className="px-5 py-3 font-mono text-xs text-bone-dim">
                      Band
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {BANDS.map((row) => (
                    <tr key={row.band} className="border-b border-white/5 last:border-0">
                      <td className="px-5 py-3 font-mono text-bone tabular-nums">
                        {row.range}
                      </td>
                      <td className="px-5 py-3 text-bone">{row.band}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section aria-labelledby="limits-heading" className="mt-12">
          <h2
            id="limits-heading"
            className="font-display text-2xl font-semibold text-bone"
          >
            What it cannot see
          </h2>
          <ul className="mt-4 max-w-[75ch] list-disc space-y-2 pl-5 text-sm leading-relaxed text-bone-dim">
            <li>
              Hidden behaviour. Unverified source can only be judged by
              its on-chain footprint, never by its code.
            </li>
            <li>
              The future. A clean scan today says nothing about what the
              owner deploys tomorrow.
            </li>
            <li>
              Off-chain facts. Team, audits, and promises live outside
              the chain and outside this scan.
            </li>
            <li>
              Full holder history. The log scan covers only the last
              20,000 blocks, about 17 hours on BSC, and the pair-share
              proxy is an estimate, not a holder list.
            </li>
            <li>
              A wallet. An address with no contract code is a wallet, not
              a token. The scan says so plainly and gives it no score.
            </li>
          </ul>
          <p className="mt-6 text-sm leading-relaxed text-bone-dim">
            SpectreScan is not an audit. Never invest more than you can afford to lose. It
            never calls a contract safe.{" "}
            <Link
              href="/"
              className="text-spectral hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
            >
              Run a scan
            </Link>{" "}
            or browse{" "}
            <Link
              href="/registry"
              className="text-spectral hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
            >
              the registry
            </Link>
            .
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
