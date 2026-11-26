// SpectreScan — one filed case: a case-file card for a real scan.
// The findings are the engine's own output, copied verbatim, with
// the evidence that backs each one. Nothing here is a summary written
// for the page; it is the scan, filed.

import Link from "next/link";
import { ArrowUpRight, FileCode2 } from "lucide-react";
import type { CaseFileData } from "@/lib/cases";
import type { Severity } from "@/lib/engine/types";

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "#f26d6d",
  high: "#f0a35e",
  medium: "#e8c85a",
  low: "#a78bfa",
  info: "#7fe0b2",
};

const BAND_COLOR: Record<string, string> = {
  "Resting in peace": "#7fe0b2",
  "Mildly haunted": "#a78bfa",
  Haunted: "#f0a35e",
  Possessed: "#f26d6d",
};

export default function CaseFile({ file }: { file: CaseFileData }) {
  const bandColor = BAND_COLOR[file.band] ?? "#a78bfa";
  return (
    <article className="relative overflow-hidden rounded-2xl border border-haunt-border bg-haunt-panel p-5 sm:p-6">
      <span
        aria-hidden
        className="pointer-events-none absolute top-4 right-4 rotate-6 rounded border-2 px-2 py-0.5 font-mono text-[11px] font-bold tracking-widest uppercase"
        style={{ color: bandColor, borderColor: `${bandColor}88` }}
      >
        {file.band}
      </span>
      <p className="pr-36 font-mono text-xs tracking-widest text-bone-dim">
        {file.caseNo} · FILED FROM A LIVE SCAN
      </p>
      <div className="mt-3 flex items-baseline gap-3 pr-32">
        <h3 className="font-display text-2xl font-semibold text-bone">
          {file.label}
        </h3>
        <span className="font-display text-4xl font-semibold tabular-nums" style={{ color: bandColor }}>
          {file.score}
        </span>
        <span className="font-mono text-xs text-bone-dim">/ 100</span>
      </div>
      <p className="mt-1 text-sm text-bone-dim">{file.tagline}</p>
      <p className="mt-2 font-mono text-xs break-all text-bone-dim">
        {file.address}
      </p>

      <ul className="mt-5 space-y-3 border-t border-white/10 pt-4">
        {file.findings.map((finding) => {
          const color = SEVERITY_COLOR[finding.severity];
          return (
            <li key={finding.id} className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <div className="min-w-0">
                <p className="text-sm text-bone">
                  {finding.title}
                  <span
                    className="ml-2 rounded-full border px-1.5 py-px text-[10px] font-semibold"
                    style={{
                      backgroundColor: `${color}33`,
                      borderColor: `${color}55`,
                      color,
                    }}
                  >
                    {finding.severity}
                  </span>
                </p>
                {finding.evidence.map((line) => (
                  <p
                    key={line}
                    className="mt-0.5 flex items-start gap-1.5 font-mono text-xs break-all text-bone-dim"
                  >
                    <FileCode2
                      size={12}
                      strokeWidth={1.5}
                      className="mt-0.5 shrink-0 text-spectral"
                      aria-hidden
                    />
                    {line}
                  </p>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <Link
        href={`/scan/${file.address}`}
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-spectral hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
      >
        Open the live scan
        <ArrowUpRight size={15} strokeWidth={1.5} aria-hidden />
      </Link>
    </article>
  );
}
