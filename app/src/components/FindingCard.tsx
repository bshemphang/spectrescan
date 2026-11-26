// SpectreScan — one finding card: severity, plain title, explanation,
// and the evidence (file:line refs or on-chain values).

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  Info,
  OctagonAlert,
  ShieldAlert,
} from "lucide-react";
import type { Finding, Severity } from "@/lib/engine/types";

const SEVERITY_STYLE: Record<
  Severity,
  { label: string; color: string; Icon: typeof Info }
> = {
  critical: { label: "Critical", color: "#f26d6d", Icon: OctagonAlert },
  high: { label: "High", color: "#f0a35e", Icon: ShieldAlert },
  medium: { label: "Medium", color: "#e8c85a", Icon: AlertTriangle },
  low: { label: "Low", color: "#a78bfa", Icon: AlertTriangle },
  info: { label: "Clear", color: "#7fe0b2", Icon: CheckCircle2 },
};

export default function FindingCard({ finding }: { finding: Finding }) {
  const style = SEVERITY_STYLE[finding.severity];
  const Icon = style.Icon;
  return (
    <article className="rounded-xl border border-haunt-border bg-haunt-panel p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
          style={{
            backgroundColor: `${style.color}33`,
            borderColor: `${style.color}55`,
            color: style.color,
          }}
        >
          <Icon size={16} strokeWidth={1.5} aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold text-bone sm:text-lg">
              {finding.title}
            </h3>
            <span
              className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
              style={{
                backgroundColor: `${style.color}33`,
                borderColor: `${style.color}55`,
                color: style.color,
              }}
            >
              {style.label}
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-bone-dim">
            {finding.detail}
          </p>
          <p className="mt-2">
            <Link
              href={`/learn#check-${finding.check.toLowerCase()}`}
              className="text-sm font-medium text-spectral hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
            >
              Learn how this check works
            </Link>
          </p>
          {finding.evidence.length > 0 && (
            <ul className="mt-3 space-y-1">
              {finding.evidence.map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-1.5 font-mono text-xs text-bone-dim"
                >
                  <FileCode2 size={13} strokeWidth={1.5} className="mt-0.5 shrink-0 text-spectral" aria-hidden />
                  <span className="break-all">{line}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}
