// SpectreScan — home page, rebuilt as The Seance: four acts, not
// one flat tool. Act one is the question and the scan form, over a
// looping background video with the spectral core beside it. Act two
// is known hauntings: the three filed cases with their real findings.
// Act three is the autopsy: the nine checks and a scoring workbench
// that runs the real scorer. Act four is the lab: the Kiro build
// story as an exhibit of real files. Every section is built from
// something real in the engine or the repo. Nothing here is filler.

"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import CaseFile from "@/components/CaseFile";
import HeroVideo from "@/components/HeroVideo";
import RecentScans from "@/components/RecentScans";
import Reveal from "@/components/Reveal";
import ScoreWorkbench from "@/components/ScoreWorkbench";
import ScrollSpine from "@/components/ScrollSpine";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import SpectralCore from "@/components/SpectralCore";
import { CASE_FILES } from "@/lib/cases";

// The nine checks, as the engine runs them. Descriptions are plain
// summaries of chainChecks.ts and sourceChecks.ts; the evidence column
// says what each check actually cites.
const RULES: Array<{ id: string; name: string; detail: string }> = [
  {
    id: "R1",
    name: "Source verification",
    detail: "Sourcify match: perfect, partial, or none. No match means the code cannot be read.",
  },
  {
    id: "R2",
    name: "Source patterns",
    detail: "Honeypot flags in the code: blacklist, trading switch, max-tx and wallet limits, fee setter, pausable, mintable. Cited by file and line.",
  },
  {
    id: "R3",
    name: "Deployer mint",
    detail: "How much of the supply the deployer minted at launch. 90 percent or more counts as almost everything. Cited by file and line.",
  },
  {
    id: "R4",
    name: "Supply cap",
    detail: "Whether a mint cap is enforced by a hardcoded constant. A cap the owner can move is not a cap.",
  },
  {
    id: "R5",
    name: "Owner",
    detail: "The owner() address: a wallet, a verified contract, or an unverified contract hiding the real controller.",
  },
  {
    id: "R6",
    name: "Ownership renounced",
    detail: "owner() returns the zero address, so no one can call owner-only functions any more.",
  },
  {
    id: "R7",
    name: "LP burn share",
    detail: "The share of LP tokens sitting in burn addresses, measured on chain. V3 pools have no LP token, so their lock status is unknown.",
  },
  {
    id: "R8",
    name: "Holder concentration",
    detail: "The pair-share proxy: the share of total supply sitting in the main DEX pair, read from Dexscreener pair data. It is an estimate, not a holder list. The address dossier separately shows real Transfer logs for the last 20,000 blocks, about 17 hours on BSC.",
  },
  {
    id: "R9",
    name: "Pair health",
    detail: "Liquidity and the 24 hour buy and sell balance from Dexscreener. Thin liquidity and heavy selling are flagged, not hidden.",
  },
];

export default function Home() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = address.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
      setError("Enter a contract address: 0x followed by 40 hex characters.");
      inputRef.current?.focus();
      return;
    }
    setError(null);
    // Honest loading state: the ghost bobs in the button while the
    // dossier loads, so the button never looks dead mid-navigation.
    setScanning(true);
    router.push(`/scan/${value}`);
  }

  const selo = CASE_FILES.find((c) => c.label === "SELO") ?? CASE_FILES[0];

  return (
    <div className="relative">
      <ScrollSpine />

      {/* Act one: the question and the scan. Video background, canvas
          mist over it, spectral core beside the form. */}
      <section
        id="act-scan"
        aria-labelledby="hero-heading"
        className="relative overflow-hidden"
      >
        <HeroVideo />
        <div className="relative z-[2] mx-auto w-full max-w-6xl px-5 sm:px-8">
          <SiteHeader />
          <div className="grid items-center gap-10 pt-12 pb-20 lg:grid-cols-[55%_45%] lg:pt-16 lg:pb-24">
            <div>
              <p className="font-mono text-xs tracking-widest text-spectral">
                $ spectre run --chain 56
              </p>
              <h1
                id="hero-heading"
                className="mt-4 font-haunt text-[2.5rem] leading-[1.02] font-medium text-balance text-bone sm:text-6xl"
              >
                Is this contract{" "}
                <span className="text-spectral">haunted?</span>
              </h1>
              <p className="mt-5 max-w-[36rem] text-base leading-relaxed text-bone-dim sm:text-lg">
                Paste a BNB Chain contract address. The agent reads the
                verified source and the public on-chain footprint, weighs
                nine checks, and files the verdict with the evidence cited.
              </p>
              <form onSubmit={submit} className="mt-8 max-w-[36rem]" noValidate>
                <label
                  htmlFor="contract-address"
                  className="mb-2 block text-sm font-medium text-bone"
                >
                  Contract address
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    ref={inputRef}
                    id="contract-address"
                    name="contract-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="0x…"
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "address-error" : undefined}
                    className="h-12 min-w-0 flex-1 rounded-lg border border-white/15 bg-[#0c0a12]/70 px-4 font-mono text-sm text-bone placeholder:text-bone-dim focus:border-spectral focus:outline-2 focus:outline-offset-2 focus:outline-spectral"
                  />
                  <button
                    type="submit"
                    disabled={scanning}
                    className={`btn-boo inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-spectral px-6 text-sm font-semibold text-white hover:bg-[#8b5cf6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral ${scanning ? "btn-loading" : ""}`}
                  >
                    <Search size={16} strokeWidth={1.5} aria-hidden />
                    {scanning ? "Scanning…" : "Scan it"}
                  </button>
                </div>
                {error && (
                  <p id="address-error" role="alert" className="mt-3 text-sm text-[#f26d6d]">
                    {error}
                  </p>
                )}
              </form>
              <p className="mt-4 text-xs text-bone-dim">
                Free, no wallet, no sign-up. Reads the verified source,
                public on-chain data, and market signals.
              </p>
              <p className="mt-6 font-mono text-xs text-bone-dim">
                9 checks · 4 data sources · 110 tests · same findings, same
                score
              </p>
            </div>

            <div className="relative">
              <SpectralCore
                band="Possessed"
                label="Spectral core for SELO: Possessed, score 100. Drag to turn it."
                className="h-64 w-full sm:h-80 lg:h-[380px]"
              />
              <p className="mt-2 text-center text-sm text-bone-dim">
                Live example: SELO scored 100, Possessed. The deployer
                holds the entire supply. Drag the core to turn it.
              </p>
              <div className="mt-4 text-center">
                <Link
                  href={`/scan/${selo.address}`}
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/15 bg-[#0c0a12]/60 px-5 text-sm font-medium text-bone transition-[background-color,border-color] hover:border-white/30 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
                >
                  See the full SELO scan
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-[2] mx-auto w-full max-w-6xl px-5 sm:px-8">
        <main id="main" className="pb-16">
          {/* Act two: known hauntings. Real case files, real findings. */}
          <section id="act-cases" aria-labelledby="cases-heading" className="pt-16">
            <Reveal>
              <p className="font-mono text-xs tracking-widest text-spectral">
                ACT TWO · THE CASES
              </p>
              <h2
                id="cases-heading"
                className="mt-3 font-display text-3xl font-medium text-bone sm:text-4xl"
              >
                Known hauntings
              </h2>
              <p className="mt-3 max-w-[65ch] leading-relaxed text-bone-dim">
                Three filed cases. Real scans, real findings, real evidence.
                Open any of them and the live scan shows the same result.
              </p>
            </Reveal>
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {CASE_FILES.map((file, i) => (
                <Reveal key={file.address} delay={i * 120}>
                  <CaseFile file={file} />
                </Reveal>
              ))}
            </div>
          </section>

          {/* Act three: the autopsy. The rules, then the scorer. */}
          <section id="act-autopsy" aria-labelledby="autopsy-heading" className="pt-24">
            <Reveal>
              <p className="font-mono text-xs tracking-widest text-spectral">
                ACT THREE · THE AUTOPSY
              </p>
              <h2
                id="autopsy-heading"
                className="mt-3 font-display text-3xl font-medium text-bone sm:text-4xl"
              >
                How the ghost decides
              </h2>
              <p className="mt-3 max-w-[65ch] leading-relaxed text-bone-dim">
                No model decides the score. Nine fixed checks read the
                evidence, each finding adds a fixed weight, and the total
                is the score. The language model only turns the findings
                into plain English. It never changes the score and never
                invents a finding.
              </p>
            </Reveal>
            <Reveal delay={100}>
              <ol className="mt-8 divide-y divide-white/10 overflow-hidden rounded-2xl border border-haunt-border bg-haunt-panel">
                {RULES.map((rule) => (
                  <li
                    key={rule.id}
                    className="grid gap-1 px-5 py-4 sm:grid-cols-[64px_220px_1fr] sm:gap-4"
                  >
                    <span className="font-mono text-sm font-semibold text-spectral">
                      {rule.id}
                    </span>
                    <span className="text-sm font-medium text-bone">
                      {rule.name}
                    </span>
                    <span className="text-sm leading-relaxed text-bone-dim">
                      {rule.detail}
                    </span>
                  </li>
                ))}
              </ol>
            </Reveal>
            <Reveal delay={150} className="mt-6">
              <ScoreWorkbench />
            </Reveal>
          </section>

          {/* Act four: the lab. How it was built, as an exhibit. */}
          <section id="act-lab" aria-labelledby="lab-heading" className="pt-24">
            <Reveal>
              <p className="font-mono text-xs tracking-widest text-spectral">
                ACT FOUR · THE LAB
              </p>
              <h2
                id="lab-heading"
                className="mt-3 font-display text-3xl font-medium text-bone sm:text-4xl"
              >
                Built with Kiro, in the open
              </h2>
              <p className="mt-3 max-w-[65ch] leading-relaxed text-bone-dim">
                Specs first, then code, then proof. Every line below names
                a real file in the repo. Nothing here is a claim; it is the
                build, exhibited.
              </p>
            </Reveal>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <Reveal>
                <article className="h-full rounded-2xl border border-haunt-border bg-haunt-panel p-5 sm:p-6">
                  <h3 className="font-display text-lg font-semibold text-bone">
                    Specs, written first
                  </h3>
                  <ul className="mt-3 space-y-2 font-mono text-xs leading-relaxed text-bone-dim">
                    <li>.kiro/specs/spectrescan/requirements.md</li>
                    <li>.kiro/specs/spectrescan/design.md</li>
                    <li>.kiro/specs/spectrescan/tasks.md</li>
                  </ul>
                  <p className="mt-3 text-sm leading-relaxed text-bone-dim">
                    Nine requirements, REQ-1 to REQ-9, written before any
                    code. The scan, the score, the explainer, the UI, the
                    MCP server, the hooks, and the tests all trace back
                    to them.
                  </p>
                </article>
              </Reveal>
              <Reveal delay={100}>
                <article className="h-full rounded-2xl border border-haunt-border bg-haunt-panel p-5 sm:p-6">
                  <h3 className="font-display text-lg font-semibold text-bone">
                    Steering: the honesty rules
                  </h3>
                  <ul className="mt-3 space-y-2 font-mono text-xs leading-relaxed text-bone-dim">
                    <li>.kiro/steering/honesty.md</li>
                    <li>.kiro/steering/security.md</li>
                    <li>.kiro/steering/style.md</li>
                  </ul>
                  <p className="mt-3 text-sm leading-relaxed text-bone-dim">
                    Hard rules, quoted verbatim: never call a contract
                    audited, safe, secure, or trustworthy. Never invent
                    a vulnerability. If a data source failed, say
                    unknown, and say why.
                  </p>
                </article>
              </Reveal>
              <Reveal>
                <article className="h-full rounded-2xl border border-haunt-border bg-haunt-panel p-5 sm:p-6">
                  <h3 className="font-display text-lg font-semibold text-bone">
                    Hooks that guard the engine
                  </h3>
                  <ul className="mt-3 space-y-2 font-mono text-xs leading-relaxed text-bone-dim">
                    <li>verify-engine-on-save</li>
                    <li>forbid-weakening-tests</li>
                  </ul>
                  <p className="mt-3 text-sm leading-relaxed text-bone-dim">
                    Saving any engine file re-runs the live fixture scans
                    and the typecheck. Saving the scorer or the tests
                    runs the full suite. No one lowers a threshold to
                    get a green run.
                  </p>
                </article>
              </Reveal>
              <Reveal delay={100}>
                <article className="h-full rounded-2xl border border-haunt-border bg-haunt-panel p-5 sm:p-6">
                  <h3 className="font-display text-lg font-semibold text-bone">
                    The same engine, as an MCP server
                  </h3>
                  <ul className="mt-3 space-y-2 font-mono text-xs leading-relaxed text-bone-dim">
                    <li>getContractSource</li>
                    <li>getTokenInfo</li>
                    <li>getPairInfo</li>
                    <li>scanContract</li>
                  </ul>
                  <p className="mt-3 text-sm leading-relaxed text-bone-dim">
                    Four tools, one engine. An agent can call the same
                    scan this site runs, and get the same findings and
                    the same score.
                  </p>
                </article>
              </Reveal>
            </div>
            <Reveal delay={150}>
              <p className="mt-6 rounded-2xl border border-haunt-border bg-haunt-panel p-5 text-sm leading-relaxed text-bone-dim">
                110 tests. Property tests prove determinism (same findings,
                any order, same score) and monotonicity (adding a finding
                never lowers the score). Live fixture scans re-check SELO,
                AGIO, and CAKE on every engine save. Repo:{" "}
                <a
                  href="https://github.com/bshemphang/spectrescan"
                  className="text-spectral hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
                >
                  github.com/bshemphang/spectrescan
                </a>
                .
              </p>
            </Reveal>
          </section>

          <RecentScans />
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}
