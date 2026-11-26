// SpectreScan — home page: asymmetric hero, GhostMeter preview on the
// right, sample scans as compact warning cards, a How-it-works toggle,
// and this browser's real recent scans. Results live on /scan/[address];
// the home page only takes the address and navigates there.

"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Ghost,
  OctagonAlert,
  Search,
  ShieldAlert,
} from "lucide-react";
import GhostMeter from "@/components/GhostMeter";
import RecentScans from "@/components/RecentScans";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { SAMPLE_CONTRACTS } from "@/lib/engine/fixtures";

// Sample cards get an icon by contract, as decided in the design review:
// SELO is the outright case (red), AGIO the warning case (amber), CAKE
// the clean comparison (green).
const SAMPLE_ICON: Record<
  string,
  { Icon: typeof OctagonAlert; color: string }
> = {
  SELO: { Icon: OctagonAlert, color: "#f26d6d" },
  AGIO: { Icon: ShieldAlert, color: "#f0a35e" },
  CAKE: { Icon: CheckCircle2, color: "#7fe0b2" },
};

export default function Home() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = address.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
      setError("Enter a contract address: 0x followed by 40 hex characters.");
      inputRef.current?.focus();
      return;
    }
    setError(null);
    router.push(`/scan/${value}`);
  }

  const selo = SAMPLE_CONTRACTS[0];

  return (
    <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
      <SiteHeader />
      <main id="main" className="pb-16">
        <div className="grid items-center gap-10 pt-12 lg:grid-cols-[55%_45%] lg:pt-16">
          <section aria-labelledby="hero-heading">
            <h1
              id="hero-heading"
              className="font-display text-[2.25rem] leading-[1.05] font-medium text-balance text-bone sm:text-6xl"
            >
              Is this contract <span className="text-spectral">haunted?</span>
            </h1>
            <p className="mt-5 max-w-[36rem] text-lg leading-relaxed text-bone-dim">
              Paste a BNB Chain contract address and find out what is wrong
              with it, with the evidence cited.
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
                  className="h-12 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.04] px-4 font-mono text-sm text-bone placeholder:text-bone-dim focus:border-spectral focus:outline-2 focus:outline-offset-2 focus:outline-spectral"
                />
                <button
                  type="submit"
                  className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-spectral px-6 text-sm font-semibold text-white transition-[background-color,border-color,box-shadow,transform] hover:bg-[#8b5cf6] hover:shadow-[0_0_28px_rgba(139,92,246,0.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral active:scale-[0.97]"
                >
                  <Search size={16} strokeWidth={1.5} aria-hidden />
                  Scan it
                </button>
              </div>
              {error && (
                <p id="address-error" role="alert" className="mt-3 text-sm text-[#f26d6d]">
                  {error}
                </p>
              )}
            </form>
            <p className="mt-4 text-xs text-bone-dim">
              Free, no wallet, no sign-up. Reads the verified source and
              public on-chain data only.
            </p>
          </section>

          <section
            aria-label="Example scan result"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8"
          >
            <GhostMeter score={selo.sampleScore} band={selo.sampleBand} />
            <p className="mt-4 text-center text-sm text-bone-dim">
              SELO scored 100 — Possessed. The deployer holds the entire
              supply.
            </p>
            <div className="mt-5 text-center">
              <Link
                href={`/scan/${selo.address}`}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/15 px-5 text-sm font-medium text-bone transition-[background-color,border-color] hover:border-white/30 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
              >
                <Ghost size={16} strokeWidth={1.5} aria-hidden />
                See the full SELO scan
              </Link>
            </div>
          </section>
        </div>

        <section aria-labelledby="samples-heading" className="mt-16">
          <h2
            id="samples-heading"
            className="font-display text-xl font-semibold text-bone"
          >
            Sample scans
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {SAMPLE_CONTRACTS.map((sample) => {
              const { Icon, color } = SAMPLE_ICON[sample.label] ?? {
                Icon: ShieldAlert,
                color: "#a78bfa",
              };
              return (
                <Link
                  key={sample.address}
                  href={`/scan/${sample.address}`}
                  className="group rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-[background-color,border-color] hover:border-white/20 hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <Icon size={16} strokeWidth={1.5} style={{ color }} aria-hidden />
                    <span className="font-mono text-sm font-semibold text-bone">
                      {sample.label}
                    </span>
                    <span className="ml-auto font-mono text-sm text-bone tabular-nums">
                      {sample.sampleScore}
                    </span>
                    <span className="text-xs whitespace-nowrap" style={{ color }}>
                      {sample.sampleBand}
                    </span>
                  </span>
                  <span className="mt-3 block text-sm leading-relaxed text-bone-dim">
                    {sample.tagline}
                  </span>
                  <span className="mt-3 block font-mono text-xs break-all text-bone-dim">
                    {sample.address}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <details className="group mt-12 rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <summary className="cursor-pointer list-none text-sm font-semibold text-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral">
            How the ghost decides
            <span className="float-right text-bone-dim transition-transform group-open:rotate-180" aria-hidden>
              ↓
            </span>
          </summary>
          <p className="mt-4 max-w-[65ch] text-sm leading-relaxed text-bone-dim">
            The score comes from a deterministic rules engine. It reads the
            verified source and public on-chain data and checks them against
            a fixed list of rules: deployer mint, hidden taxes, honeypot
            flags, ownership, liquidity. The same findings always give the
            same score. A language model then turns those findings into plain
            English. It never changes the score and never invents a finding.
            That split, rules decide and words explain, is what makes the
            verdict checkable: every claim points at its evidence.
          </p>
        </details>

        <RecentScans />
      </main>

      <SiteFooter />
    </div>
  );
}
