// SpectreScan — recent scans: this browser's real scan history, read
// from localStorage. Never seeded, never invented; an empty history says
// so in plain text.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { loadRecent, type RecentScan } from "@/lib/recent";

const BAND_COLOR: Record<string, string> = {
  "Resting in peace": "#7fe0b2",
  "Mildly haunted": "#a78bfa",
  Haunted: "#f0a35e",
  "Possessed — do not touch": "#f26d6d",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export default function RecentScans() {
  const [scans, setScans] = useState<RecentScan[] | null>(null);

  useEffect(() => {
    // localStorage exists only in the browser; read it after mount so
    // the server render and the first client paint agree (empty).
    const raf = requestAnimationFrame(() => setScans(loadRecent()));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (scans === null) return null;

  return (
    <section aria-labelledby="recent-heading" className="mt-16">
      <h2
        id="recent-heading"
        className="font-display text-xl font-semibold text-bone"
      >
        Recent scans
      </h2>
      {scans.length === 0 ? (
        <p className="mt-3 text-sm text-bone-dim">
          No scans yet in this browser. Your scans will appear here.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-white/8 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
          {scans.map((scan) => (
            <li key={scan.address}>
              <Link
                href={`/scan/${scan.address}`}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-bone">
                    {scan.name ?? "Unknown token"}
                    {scan.symbol ? ` (${scan.symbol})` : ""}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-bone-dim">
                    <Clock size={12} strokeWidth={1.5} aria-hidden />
                    {timeAgo(scan.scannedAt)}
                    <span aria-hidden>·</span>
                    <span className="truncate">
                      {scan.address.slice(0, 6)}…
                      {scan.address.slice(-4)}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-sm">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: BAND_COLOR[scan.band] ?? "#a78bfa",
                    }}
                    aria-hidden
                  />
                  <span className="font-mono text-bone tabular-nums">
                    {scan.score}
                  </span>
                  <span className="hidden text-bone-dim sm:inline">
                    {scan.band}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
