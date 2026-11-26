// SpectreScan — one explorer table for the explorer front door and
// the registry database. Every row is a token the site has actually
// scanned: a filed case shipped in the repo, or a scan this browser
// ran. The source column says which, so a filed case never passes
// as a live scan. Nothing here is a live ranking of the whole
// chain, and the page header above this table says so.

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ExplorerEntry } from "@/lib/explorer";
import { shortAddress } from "@/lib/format";

const BAND_COLOR: Record<string, string> = {
  "Resting in peace": "#7fe0b2",
  "Mildly haunted": "#a78bfa",
  Haunted: "#f0a35e",
  Possessed: "#f26d6d",
};

export function bandColor(band: string): string {
  return BAND_COLOR[band] ?? "#a78bfa";
}

export default function ExplorerTable({
  entries,
}: {
  entries: ExplorerEntry[];
}) {
  if (entries.length === 0) {
    return (
      <p className="mt-4 rounded-xl border border-haunt-border bg-haunt-panel p-5 text-sm text-bone-dim">
        Nothing here yet. Scan a token and it will appear in this list.
      </p>
    );
  }
  return (
    <ul className="mt-4 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      {entries.map((entry) => (
        <li key={entry.address}>
          <Link
            href={`/scan/${entry.address}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral sm:gap-4"
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: bandColor(entry.band) }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-bone">
                {entry.label}
                {entry.caseNo ? (
                  <span className="ml-2 font-mono text-xs text-bone-dim">
                    {entry.caseNo}
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block truncate font-mono text-xs text-bone-dim">
                {shortAddress(entry.address)} ·{" "}
                {entry.source === "case" ? "Filed case" : "Your scan"}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2 text-sm">
              <span className="font-mono font-semibold text-bone tabular-nums">
                {entry.score}
              </span>
              <span
                className="hidden text-bone-dim sm:inline"
                style={{ color: bandColor(entry.band) }}
              >
                {entry.band}
              </span>
              <ArrowUpRight
                size={15}
                strokeWidth={1.5}
                className="text-bone-dim"
                aria-hidden
              />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
