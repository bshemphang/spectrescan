// SpectreScan — home page (client component).
// One address input, one-click sample scans, and the haunting report:
// ghost meter, LLM verdict, findings cards, disclaimer.

"use client";

import { useState } from "react";
import {
  Ghost,
  Loader2,
  RotateCcw,
  ScanSearch,
  ShieldQuestion,
  TriangleAlert,
} from "lucide-react";
import GhostMeter from "@/components/GhostMeter";
import FindingCard from "@/components/FindingCard";
import { SAMPLE_CONTRACTS } from "@/lib/engine/fixtures";
import type { ScanResult } from "@/lib/engine/types";
import { isValidAddress } from "@/lib/engine/scan";

type Status = "idle" | "scanning" | "done" | "error";

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"] as const;

export default function Home() {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  async function runScan(addr: string) {
    const trimmed = addr.trim();
    if (!isValidAddress(trimmed)) {
      setError("That is not a valid contract address. Use 0x followed by 40 hex characters.");
      setStatus("error");
      return;
    }
    setStatus("scanning");
    setError(null);
    setResult(null);
    const started = Date.now();
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: trimmed }),
      });
      const json = (await res.json()) as ScanResult & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Scan failed.");
      setResult(json);
      setElapsed((Date.now() - started) / 1000);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed. Try again.");
      setStatus("error");
    }
  }

  const sortedFindings = result
    ? [...result.findings].sort(
        (a, b) =>
          SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
      )
    : [];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
      {/* Header */}
      <header className="flex items-center justify-between pt-6">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-spectral/15 text-spectral">
            <Ghost size={20} aria-hidden />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">
            SpectreScan
          </span>
        </div>
        <span className="rounded-full border border-haunt-border px-3 py-1 text-xs font-medium text-bone-dim">
          BSC · Chain 56
        </span>
      </header>

      {/* Hero */}
      <section className="mt-10 text-center sm:mt-14">
        <h1 className="font-display text-4xl leading-tight font-bold sm:text-5xl">
          Is this contract <span className="text-spectral">haunted?</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-bone-dim sm:text-lg">
          Paste any BNB Chain contract address. SpectreScan reads its verified
          source and on-chain footprint, then tells you in plain English
          whether it is safe to touch — with the exact lines cited.
        </p>
      </section>

      {/* Scan form */}
      <section className="mt-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runScan(address);
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <label htmlFor="address" className="sr-only">
            Contract address
          </label>
          <input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x… contract address"
            spellCheck={false}
            autoComplete="off"
            className="h-12 flex-1 rounded-lg border border-haunt-border bg-haunt-panel px-4 font-mono text-sm text-bone placeholder:text-bone-dim/60 focus:border-spectral focus:outline-none"
          />
          <button
            type="submit"
            disabled={status === "scanning"}
            className="flex h-12 items-center justify-center gap-2 rounded-lg bg-spectral px-6 text-sm font-semibold text-haunt-bg transition hover:bg-spectral-deep hover:text-bone disabled:opacity-60"
          >
            {status === "scanning" ? (
              <>
                <Loader2 size={17} className="animate-spin" aria-hidden />
                Summoning the ghost…
              </>
            ) : (
              <>
                <ScanSearch size={17} aria-hidden />
                Scan contract
              </>
            )}
          </button>
        </form>

        {/* Sample contracts */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-bone-dim">Try one:</span>
          {SAMPLE_CONTRACTS.map((s) => (
            <button
              key={s.address}
              type="button"
              disabled={status === "scanning"}
              onClick={() => {
                setAddress(s.address);
                void runScan(s.address);
              }}
              className="rounded-full border border-haunt-border bg-haunt-panel px-3 py-1.5 text-xs font-medium text-bone transition hover:border-spectral hover:text-spectral disabled:opacity-60"
            >
              {s.label} — {s.tagline.split("—")[0].trim()}
            </button>
          ))}
        </div>
      </section>

      {/* Error */}
      {status === "error" && error && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-blood/40 bg-blood/10 p-4">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-blood" aria-hidden />
          <p className="text-sm text-bone">{error}</p>
        </div>
      )}

      {/* Loading note */}
      {status === "scanning" && (
        <p className="mt-8 text-center text-sm text-bone-dim">
          Reading verified source, checking the owner, the liquidity lock and
          the holders… usually under 30 seconds.
        </p>
      )}

      {/* Result */}
      {status === "done" && result && (
        <section className="mt-10">
          <div className="rounded-2xl border border-haunt-border bg-haunt-panel p-5 sm:p-7">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
              <GhostMeter score={result.score} band={result.band} />
              <div className="w-full sm:max-w-sm">
                <h2 className="font-display text-lg font-semibold">
                  {result.token.name ?? "Unknown token"}{" "}
                  {result.token.symbol ? `(${result.token.symbol})` : ""}
                </h2>
                <p className="mt-1 font-mono text-xs break-all text-bone-dim">
                  {result.address}
                </p>
                <p className="mt-2 text-xs text-bone-dim">
                  Source {result.verified ? "verified" : "not verified"} ·{" "}
                  {result.findings.length} findings
                  {elapsed !== null ? ` · scanned in ${elapsed.toFixed(1)}s` : ""}
                </p>
                {result.explanation ? (
                  <p className="mt-4 text-sm leading-relaxed text-bone">
                    {result.explanation}
                  </p>
                ) : (
                  <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-bone-dim">
                    <ShieldQuestion size={16} className="mt-0.5 shrink-0" aria-hidden />
                    The ghost&apos;s verdict could not be summoned this time —
                    the findings below still stand on their own.
                  </p>
                )}
              </div>
            </div>
          </div>

          <h2 className="mt-8 font-display text-xl font-semibold">
            What the ghost found
          </h2>
          <div className="mt-4 space-y-3">
            {sortedFindings.map((f) => (
              <FindingCard key={f.id} finding={f} />
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setResult(null);
              setAddress("");
              setStatus("idle");
            }}
            className="mt-8 flex items-center gap-2 rounded-lg border border-haunt-border px-4 py-2.5 text-sm font-medium text-bone transition hover:border-spectral hover:text-spectral"
          >
            <RotateCcw size={15} aria-hidden />
            Scan another contract
          </button>
        </section>
      )}

      {/* Footer */}
      <footer className="mt-14 border-t border-haunt-border pt-6 text-center">
        <p className="text-xs leading-relaxed text-bone-dim">
          SpectreScan is not an audit. Never invest more than you can afford
          to lose. Sources: Sourcify (verified source), public BSC RPCs
          (on-chain state), Dexscreener (pairs and liquidity). Built for
          Kiroween 2026, Frankenstein category.
        </p>
      </footer>
    </main>
  );
}
