// SpectreScan — learn: how rugs work, taught from real scans.
// Every lesson is tied to one of the nine checks the engine runs,
// and every case study is written from the filed findings in
// lib/cases.ts, which are the engine's own output copied verbatim.
// No rug story here is reconstructed from memory: if a fact is not
// in the engine output, it is not on this page.

import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { CASE_FILES } from "@/lib/cases";

const LESSONS: Array<{
  id: string;
  check: string;
  title: string;
  body: string;
  lookFor: string;
}> = [
  {
    id: "check-r1",
    check: "R1",
    title: "Read the source, or admit you cannot",
    body: "A contract whose source is verified on Sourcify can be read: the code on chain is the code that runs. A partial match means only part of it matches. No match means the code cannot be read at all, and only the on-chain footprint can be checked. A rug that hides its source is not automatically a rug, but it is unreadable, and unreadable is a reason to stop.",
    lookFor: "Source verified: perfect, partial, or none. None is the red flag.",
  },
  {
    id: "check-r2",
    check: "R2",
    title: "Honeypot patterns live in the code",
    body: "A blacklist function lets the owner block chosen wallets from selling. An owner-controlled trading switch lets the owner turn trading off. Owner-settable max transaction and wallet limits let the owner cap how much anyone can sell. Owner-settable buy and sell fees let the owner raise the sell fee to 99 percent. A pause function stops all trading. A public mint function lets the owner print more supply. Each pattern is matched against the code and cited by file and line.",
    lookFor: "Any one of these in the source, cited by file and line.",
  },
  {
    id: "check-r3",
    check: "R3",
    title: "Who got the supply at launch",
    body: "If the deployer minted 90 percent or more of the supply at launch, one wallet controls almost everything. It can sell into every buyer, or hold the price hostage. The check reads the constructor, the initialize function, and top-level assignments, and cites the file and line.",
    lookFor: "Deployer minted 90 percent or more at launch.",
  },
  {
    id: "check-r4",
    check: "R4",
    title: "A cap that moves is not a cap",
    body: "A mint is less dangerous when a supply cap is enforced by a hardcoded constant, an immutable, or a literal. A cap stored in a variable the owner can change does not count: the owner can move it whenever they like.",
    lookFor: "A hardcoded cap constant in the source.",
  },
  {
    id: "check-r5",
    check: "R5",
    title: "Who is the owner, really",
    body: "The owner() address answers the question. A wallet owner is one person with the keys. A verified contract owner is public code with rules anyone can read. An unverified contract owner hides the real controller behind code nobody can read.",
    lookFor: "owner() returns a wallet, a verified contract, or an unverified contract.",
  },
  {
    id: "check-r6",
    check: "R6",
    title: "Renounced ownership locks the doors",
    body: "When owner() returns the zero address, no one can call owner-only functions any more. Minting, pausing, and fee changes are locked out. Renouncing is the one move that takes the keys away from everyone, including the deployer.",
    lookFor: "owner() = 0x000…000.",
  },
  {
    id: "check-r7",
    check: "R7",
    title: "Burned liquidity cannot be pulled",
    body: "Liquidity providers get LP tokens for the pool. When almost all of the pair's LP tokens sit in burn addresses, the liquidity cannot be pulled by the deployer. V3 concentrated-liquidity pools have no LP token, so their lock status is unknown and is reported as unknown, never as clean.",
    lookFor: "The share of LP tokens in burn addresses.",
  },
  {
    id: "check-r8",
    check: "R8",
    title: "A few wallets can move the price hard",
    body: "Most of the token supply held outside the trading pair, usually by the deployer or early insiders, means a small group can move the price hard. The scan reads the share of supply sitting in the main DEX pair as a proxy, and the dossier separately shows real Transfer logs for the last 20,000 blocks.",
    lookFor: "A tiny share of supply in the pair, with the rest in few hands.",
  },
  {
    id: "check-r9",
    check: "R9",
    title: "Thin liquidity, heavy selling",
    body: "A pair with thin liquidity and far more sells than buys in 24 hours is a market with no floor and everyone leaving. The scan reads liquidity in dollars and the 24 hour buy and sell counts from Dexscreener, and flags thin liquidity and heavy selling instead of hiding them.",
    lookFor: "Liquidity in dollars, and the 24 hour buy and sell balance.",
  },
];

export default function LearnPage() {
  return (
    <div className="relative z-[2] mx-auto w-full max-w-6xl px-5 sm:px-8">
      <SiteHeader />
      <main id="main" className="pb-16">
        <section aria-labelledby="learn-heading" className="pt-12">
          <p className="font-mono text-xs tracking-widest text-spectral">
            $ spectre learn --from-real-scans
          </p>
          <h1
            id="learn-heading"
            className="mt-3 font-haunt text-4xl font-medium text-bone sm:text-5xl"
          >
            How rugs work
          </h1>
          <p className="mt-4 max-w-[65ch] leading-relaxed text-bone-dim">
            Nine lessons, one per check the engine runs, each taught
            from a real scan. Nothing here is a story reconstructed
            from memory: every case below is a filed case, and every
            finding quoted is the engine&apos;s own output.
          </p>
        </section>

        <section aria-labelledby="lessons-heading" className="mt-12">
          <h2
            id="lessons-heading"
            className="font-display text-2xl font-semibold text-bone"
          >
            The nine lessons
          </h2>
          <ol className="mt-6 space-y-5">
            {LESSONS.map((lesson) => (
              <li
                key={lesson.id}
                id={lesson.id}
                className="scroll-mt-24 rounded-2xl border border-haunt-border bg-haunt-panel p-5 sm:p-6"
              >
                <p className="font-mono text-sm font-semibold text-spectral">
                  {lesson.check}
                </p>
                <h3 className="mt-1 font-display text-lg font-semibold text-bone">
                  {lesson.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-bone-dim">
                  {lesson.body}
                </p>
                <p className="mt-3 font-mono text-xs text-bone">
                  Look for: {lesson.lookFor}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="cases-heading" className="mt-16">
          <h2
            id="cases-heading"
            className="font-display text-2xl font-semibold text-bone"
          >
            Case studies from filed scans
          </h2>
          <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-bone-dim">
            Three filed cases. Their findings are the engine&apos;s own
            output, copied verbatim from live scans. Open any of them
            and the live scan shows the same result.
          </p>
          <div className="mt-6 space-y-5">
            {CASE_FILES.map((file) => (
              <article
                key={file.address}
                className="rounded-2xl border border-haunt-border bg-haunt-panel p-5 sm:p-6"
              >
                <p className="font-mono text-xs tracking-widest text-bone-dim">
                  {file.caseNo} · {file.label} · scored {file.score},{" "}
                  {file.band}
                </p>
                <h3 className="mt-2 font-display text-lg font-semibold text-bone">
                  {file.tagline}
                </h3>
                <ul className="mt-3 space-y-2">
                  {file.findings.map((finding) => (
                    <li
                      key={finding.id}
                      className="text-sm leading-relaxed text-bone-dim"
                    >
                      <span className="text-bone">{finding.title}</span>{" "}
                      <span className="font-mono text-xs">
                        ({finding.check}, {finding.severity}
                        {finding.weight > 0 ? `, +${finding.weight}` : ""})
                      </span>
                      {finding.evidence.length > 0 && (
                        <span className="mt-0.5 block font-mono text-xs break-all">
                          {finding.evidence.join(" · ")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/scan/${file.address}`}
                  className="mt-4 inline-block text-sm font-medium text-spectral hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
                >
                  Open the live scan
                </Link>
              </article>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
