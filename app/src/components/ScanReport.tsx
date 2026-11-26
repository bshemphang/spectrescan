// SpectreScan — scan report: the full result of one scan, shared by the
// scan page and any other surface that shows a result. Meter card first,
// then the findings, then actions. The score is deterministic: the same
// findings always give the same score. The ghost's verdict only turns
// the findings into plain English; it never changes the score.

"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Link2, RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import GhostMeter from "./GhostMeter";
import FindingCard from "./FindingCard";
import type { ScanResult } from "@/lib/engine/types";

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"] as const;

export default function ScanReport({
  result,
  elapsed,
}: {
  result: ScanResult;
  elapsed: number | null;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (non-secure context): the address bar URL
      // is the shareable link; nothing else to do.
    }
  }

  const sortedFindings = [...result.findings].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  return (
    <>
      <section
        aria-label="Scan result"
        className="mt-8 grid gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:grid-cols-[1fr_auto] sm:p-8"
      >
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-balance text-bone sm:text-3xl">
            {result.token.name ?? "Unknown token"}
            {result.token.symbol ? ` (${result.token.symbol})` : ""}
          </h1>
          <p className="mt-2 font-mono text-xs break-all text-bone-dim">
            {result.address}
          </p>
          {result.explanation ? (
            <p className="mt-5 max-w-[65ch] leading-relaxed text-bone">
              {result.explanation}
            </p>
          ) : (
            <p className="mt-5 max-w-[65ch] leading-relaxed text-bone">
              The ghost&apos;s verdict could not be written this time. The
              findings below still stand on their own.
            </p>
          )}
          <p className="mt-5 flex items-start gap-2 text-sm text-bone-dim">
            <ShieldCheck
              size={16}
              strokeWidth={1.5}
              className="mt-0.5 shrink-0 text-spectral"
              aria-hidden
            />
            Same findings, same score, every time. The score is decided by
            the rules below; the verdict only puts them into words.
          </p>
          <p className="mt-3 text-xs text-bone-dim">
            Source {result.verified ? "verified" : "not verified"} ·{" "}
            {result.findings.length}{" "}
            {result.findings.length === 1 ? "finding" : "findings"} · scanned{" "}
            {new Date(result.scannedAt).toLocaleString()}
            {elapsed !== null ? ` · took ${elapsed.toFixed(1)}s` : ""}
            {result.explainerFailed
              ? " · verdict unavailable, findings shown"
              : ""}
          </p>
        </div>
        <div className="flex justify-center sm:justify-end">
          <GhostMeter score={result.score} band={result.band} />
        </div>
      </section>

      <section aria-labelledby="findings-heading" className="mt-10">
        <h2
          id="findings-heading"
          className="font-display text-xl font-semibold text-bone"
        >
          What the ghost found
        </h2>
        {result.findings.length === 0 ? (
          <p className="mt-3 text-sm text-bone-dim">
            Nothing suspicious turned up in the checks above.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {sortedFindings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={copyLink}
          aria-label="Copy link to this scan result"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-spectral px-5 text-sm font-semibold text-white transition-[background-color,border-color,box-shadow,transform] hover:bg-[#8b5cf6] hover:shadow-[0_0_24px_rgba(139,92,246,0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral active:scale-[0.97]"
        >
          {copied ? (
            <Check size={16} strokeWidth={1.5} aria-hidden />
          ) : (
            <Link2 size={16} strokeWidth={1.5} aria-hidden />
          )}
          {copied ? "Link copied" : "Copy link"}
        </button>
        <Link
          href="/"
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/15 px-5 text-sm font-medium text-bone transition-[background-color,border-color] hover:border-white/30 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
        >
          <RotateCcw size={16} strokeWidth={1.5} aria-hidden />
          Scan another contract
        </Link>
      </div>

      <p className="mt-8 flex items-start gap-2 text-xs leading-relaxed text-bone-dim">
        <TriangleAlert
          size={14}
          strokeWidth={1.5}
          className="mt-0.5 shrink-0"
          aria-hidden
        />
        SpectreScan is a public-signal checker, not an audit. It reads the
        verified source and public on-chain data; it cannot see hidden
        behaviour, and it never calls a contract safe.
      </p>
    </>
  );
}
