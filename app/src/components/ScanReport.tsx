// SpectreScan — scan report: the address dossier. One results view
// holds everything about the address: the identity card, the risk
// score and verdict, the bubble map, the transfer flow, the pair
// health, and the timeline of first seen and deployer activity. The
// point is that a person gets the little details they would
// otherwise chase across three sites in this one page, with every
// number labelled by where it came from and what window it covers.
// The score is deterministic: the same findings always give the same
// score. The ghost's verdict only turns the findings into plain
// English; it never changes the score. The verdict is rendered as
// plain text: any markdown the explainer used anyway is stripped
// before display, so a raw "**Source code missing**" never reaches
// the reader again.

"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Check,
  Link2,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import GhostMeter from "./GhostMeter";
import FindingCard from "./FindingCard";
import IdentityCard from "./IdentityCard";
import BubbleMap from "./BubbleMap";
import TransferFlow from "./TransferFlow";
import { stripMarkdown } from "@/lib/explainer";
import { isSoundEnabled, playVerdictChime } from "@/lib/sound";
import { formatDate, shortAddress } from "@/lib/format";
import type { ScanResult } from "@/lib/engine/types";

// The 3D core is lazy-loaded after the hero text: Three.js must not
// hold up the first paint.
const SpectralCore = dynamic(() => import("./SpectralCore"), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 items-center justify-center font-mono text-xs text-bone-dim">
      summoning the core…
    </div>
  ),
});

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"] as const;

export default function ScanReport({
  result,
  elapsed,
}: {
  result: ScanResult;
  elapsed: number | null;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  // The verdict can be retried on its own: the route re-runs only the
  // explainer against the cached scan, so a flaky LLM call does not
  // force a full rescan.
  const [explanation, setExplanation] = useState<string | null>(
    result.explanation,
  );
  const [verdictFailed, setVerdictFailed] = useState(result.explainerFailed);
  const [explanationLocal, setExplanationLocal] = useState(
    result.explanationLocal ?? false,
  );
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);

  // Verdict reveal: a particle burst over the page and, only when the
  // header toggle is on, the soft chime. Off by default, and the
  // burst is skipped under reduced motion by the canvas itself.
  useEffect(() => {
    if (result.isEOA) return;
    window.dispatchEvent(new Event("spectre:burst"));
    if (isSoundEnabled()) playVerdictChime();
    // Once per result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.address]);

  async function copyLink() {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (non-secure context): say so plainly —
      // the address bar URL is the shareable link.
      setCopyFailed(true);
    }
  }

  async function retryVerdict() {
    setRetrying(true);
    setRetryFailed(false);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: result.address, retryExplainer: true }),
      });
      const json = (await res.json()) as ScanResult & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Retry failed.");
      // Sanitize again at the display layer, even though the server
      // already strips: the UI must never show raw markdown markers.
      setExplanation(json.explanation ? stripMarkdown(json.explanation) : null);
      setVerdictFailed(json.explainerFailed);
      setExplanationLocal(json.explanationLocal ?? false);
    } catch {
      setRetryFailed(true);
    } finally {
      setRetrying(false);
    }
  }

  // Empty-string names render blank with ??, so fall back with || and
  // use the address itself as the title when both name and symbol are
  // empty.
  const title =
    result.token.name || result.token.symbol
      ? `${result.token.name || result.token.symbol}${result.token.name && result.token.symbol ? ` (${result.token.symbol})` : ""}`
      : result.address;

  const sortedFindings = [...result.findings].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  // Retry control for the verdict: shared by the failure view and by
  // the local-verdict view, so a reader can always ask the ghost for
  // its own version.
  const retryBlock = (
    <div className="mt-4">
      <button
        type="button"
        onClick={retryVerdict}
        disabled={retrying}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/15 px-4 text-sm font-medium text-bone transition-[background-color,border-color] hover:border-white/30 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral disabled:opacity-60"
      >
        <RotateCcw size={15} strokeWidth={1.5} aria-hidden />
        {retrying ? "Retrying the verdict…" : "Retry verdict"}
      </button>
      {retryFailed && (
        <p role="status" className="mt-2 text-sm text-[#f26d6d]">
          The verdict could not be retried. Try again in a moment.
        </p>
      )}
    </div>
  );

  const actions = (
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
        Scan another address
      </Link>
    </div>
  );

  const disclaimer = (
    <p className="mt-8 flex items-start gap-2 text-xs leading-relaxed text-bone-dim">
      <TriangleAlert
        size={14}
        strokeWidth={1.5}
        className="mt-0.5 shrink-0"
        aria-hidden
      />
      SpectreScan is not an audit. Never invest more than you can afford to lose. It reads the
      verified source and public on-chain data; it cannot see hidden
      behaviour, and it never calls a contract safe.
    </p>
  );

  // A wallet is not a haunted token. eth_getCode returned 0x, so no
  // token checks ran and the score is 0 by construction, not by
  // verdict. Say so plainly instead of dressing a wallet up as a
  // low-risk token.
  if (result.isEOA) {
    return (
      <>
        <section
          aria-label="Wallet, not a contract"
          className="verdict-reveal mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8"
        >
          <div className="flex items-start gap-3">
            <Wallet
              size={22}
              strokeWidth={1.5}
              className="mt-1 shrink-0 text-spectral"
              aria-hidden
            />
            <div className="min-w-0">
              <h1 className="font-haunt text-2xl font-semibold text-balance text-bone sm:text-3xl">
                This is a wallet, not a smart contract
              </h1>
              <p className="mt-2 font-mono text-xs break-all text-bone-dim">
                {result.address}
              </p>
              <p className="mt-5 max-w-[65ch] leading-relaxed text-bone break-words">
                {explanation ??
                  "This address holds no contract code. It is an externally owned account, a wallet, so there is no token to score, no source to verify, and no owner to check. A wallet cannot be haunted, and it cannot rug anyone. The score is 0 because there is nothing to score, not because the wallet is safe."}
              </p>
              <p className="mt-4 text-sm text-bone-dim">
                Checked: eth_getCode returned 0x on BSC. No token checks
                ran. Scanned {new Date(result.scannedAt).toLocaleString()}
                {elapsed !== null ? ` · took ${elapsed.toFixed(1)}s` : ""}.
              </p>
            </div>
          </div>
        </section>
        {actions}
        {copyFailed && (
          <p role="status" className="mt-3 text-sm text-[#f26d6d]">
            Copy failed. Copy the URL from the address bar instead.
          </p>
        )}
        {disclaimer}
      </>
    );
  }

  const dossier = result.dossier ?? null;
  const summary = dossier?.analysis.summary ?? null;
  const cleanVerdict = explanation ? stripMarkdown(explanation) : null;

  return (
    <>
      <section
        aria-label="Scan result"
        className="verdict-reveal mt-8 grid gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:grid-cols-[1fr_auto] sm:p-8"
      >
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-spectral">
            Case file · {result.band}
          </p>
          <h1 className="mt-2 font-haunt text-2xl font-semibold text-balance text-bone sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 font-mono text-xs break-all text-bone-dim">
            {result.address}
          </p>
          {cleanVerdict ? (
            <>
              <p className="mt-5 max-w-[65ch] leading-relaxed text-bone break-words">
                {cleanVerdict}
              </p>
              {explanationLocal && (
                <>
                  <p className="mt-3 text-sm text-bone-dim">
                    Written from the findings without a model, because the
                    ghost could not be reached. Ask for its version below.
                  </p>
                  {retryBlock}
                </>
              )}
            </>
          ) : (
            <>
              <p className="mt-5 max-w-[65ch] leading-relaxed text-bone break-words">
                The ghost&apos;s verdict could not be written this time. The
                findings below still stand on their own.
              </p>
              {retryBlock}
            </>
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
            {verdictFailed
              ? explanationLocal
                ? " · verdict written from the findings, model unavailable"
                : " · verdict unavailable, findings shown"
              : ""}
          </p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <GhostMeter score={result.score} band={result.band} />
          <div className="h-56 w-56 sm:h-64 sm:w-64">
            <SpectralCore band={result.band} />
          </div>
        </div>
      </section>

      {dossier && summary && (
        <section
          aria-label="Timeline"
          className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-spectral">
            Timeline
          </h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            <li>
              <p className="font-mono text-xs text-bone-dim">First seen</p>
              <p className="mt-1 font-mono text-sm text-bone">
                {summary.firstSeenBlock !== null
                  ? `Block ${summary.firstSeenBlock.toLocaleString()}`
                  : "Unknown"}
              </p>
              <p className="font-mono text-xs text-bone-dim">
                {summary.firstSeenAt !== null
                  ? formatDate(summary.firstSeenAt)
                  : "no transfers in the scanned window"}
              </p>
            </li>
            <li>
              <p className="font-mono text-xs text-bone-dim">First minter</p>
              <p
                className="mt-1 font-mono text-sm text-bone"
                title={summary.firstMinter ?? undefined}
              >
                {summary.firstMinter
                  ? shortAddress(summary.firstMinter)
                  : "Unknown"}
              </p>
              <p className="font-mono text-xs text-bone-dim">
                {summary.firstMinter
                  ? "recipient of the earliest mint in the window"
                  : "no mint in the scanned window"}
              </p>
            </li>
            <li>
              <p className="font-mono text-xs text-bone-dim">Scanned</p>
              <p className="mt-1 font-mono text-sm text-bone">
                {formatDate(Math.floor(new Date(result.scannedAt).getTime() / 1000))}
              </p>
              <p className="font-mono text-xs text-bone-dim">
                dossier window: last 20,000 blocks
              </p>
            </li>
          </ol>
        </section>
      )}

      {dossier ? (
        <>
          <IdentityCard result={result} dossier={dossier} />
          <BubbleMap
            dossier={dossier}
            tokenAddress={result.address}
            decimals={result.token.decimals}
            symbol={result.token.symbol}
          />
          <TransferFlow
            dossier={dossier}
            decimals={result.token.decimals}
            symbol={result.token.symbol}
          />
        </>
      ) : (
        <section
          aria-label="Dossier unavailable"
          className="dossier-card"
        >
          <p className="font-mono text-sm text-bone-dim">
            Dossier data unavailable: the transfer scan failed outright, so
            the identity card, bubble map, and transfer flow could not be
            built. The score and findings above still stand.
          </p>
        </section>
      )}

      <section aria-labelledby="findings-heading" className="mt-10">
        <h2
          id="findings-heading"
          className="font-haunt text-xl font-semibold text-bone"
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

      {actions}
      {copyFailed && (
        <p role="status" className="mt-3 text-sm text-[#f26d6d]">
          Copy failed. Copy the URL from the address bar instead.
        </p>
      )}
      {disclaimer}
    </>
  );
}
