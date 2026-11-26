// SpectreScan — the registry: a browsable database of real scans.
// Every row is a scan this browser has run, plus the filed cases
// shipped in the repo. Search by name or address, filter by band,
// sort by score or date. Nothing here is invented, seeded, or
// estimated. A wallet lookup never enters the registry: it is not a
// contract scan.

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ExplorerTable from "@/components/ExplorerTable";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import {
  EXPLORER_BANDS,
  filterExplorerEntries,
  mergeExplorerEntries,
  sortExplorerEntries,
  type ExplorerEntry,
  type ExplorerSort,
} from "@/lib/explorer";
import { CASE_FILES } from "@/lib/cases";
import { loadRecent } from "@/lib/recent";

const SORTS: Array<{ value: ExplorerSort; label: string }> = [
  { value: "haunted", label: "Most haunted first" },
  { value: "calm", label: "Calmest first" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

export default function RegistryPage() {
  const [entries, setEntries] = useState<ExplorerEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [band, setBand] = useState<string | "all">("all");
  const [sort, setSort] = useState<ExplorerSort>("haunted");

  useEffect(() => {
    // localStorage exists only in the browser; read it after mount
    // so the server render and the first client paint agree.
    const raf = requestAnimationFrame(() => {
      setEntries(mergeExplorerEntries(CASE_FILES, loadRecent()));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const shown = useMemo(() => {
    if (entries === null) return [];
    return sortExplorerEntries(
      filterExplorerEntries(entries, query, band),
      sort,
    );
  }, [entries, query, band, sort]);

  return (
    <div className="relative z-[2] mx-auto w-full max-w-6xl px-5 sm:px-8">
      <SiteHeader />
      <main id="main" className="pb-16">
        <section aria-labelledby="registry-heading" className="pt-12">
          <p className="font-mono text-xs tracking-widest text-spectral">
            $ spectre registry --list
          </p>
          <h1
            id="registry-heading"
            className="mt-3 font-haunt text-4xl font-medium text-bone sm:text-5xl"
          >
            The registry
          </h1>
          <p className="mt-4 max-w-[65ch] leading-relaxed text-bone-dim">
            A graveyard of real scans. Everything below is a scan this
            browser actually ran, or one of the filed cases. No seeded
            activity, no invented usage, no estimates dressed up as
            results. Search it, filter it by band, sort it.
          </p>
          <p className="mt-4">
            <Link
              href="/explorer"
              className="text-sm font-medium text-spectral hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
            >
              Or browse the most haunted first in the explorer
            </Link>
          </p>
        </section>

        <section aria-label="Search and filter" className="mt-8">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or address…"
              aria-label="Search the registry by name or address"
              autoComplete="off"
              spellCheck={false}
              className="h-11 min-w-0 flex-1 rounded-lg border border-white/15 bg-[#0c0a12]/70 px-4 font-mono text-sm text-bone placeholder:text-bone-dim focus:border-spectral focus:outline-2 focus:outline-offset-2 focus:outline-spectral"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as ExplorerSort)}
              aria-label="Sort the registry"
              className="h-11 shrink-0 rounded-lg border border-white/15 bg-[#0c0a12]/70 px-3 font-mono text-sm text-bone focus:border-spectral focus:outline-2 focus:outline-offset-2 focus:outline-spectral"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div
            className="mt-3 flex flex-wrap gap-2"
            role="group"
            aria-label="Filter by band"
          >
            <button
              type="button"
              onClick={() => setBand("all")}
              aria-pressed={band === "all"}
              className={`rounded-full border px-3 py-1.5 font-mono text-xs ${
                band === "all"
                  ? "border-spectral text-ember shadow-[0_0_16px_rgba(240,163,94,0.35)]"
                  : "border-white/15 text-bone-dim hover:border-white/30 hover:text-bone"
              }`}
            >
              All bands
            </button>
            {EXPLORER_BANDS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBand(b)}
                aria-pressed={band === b}
                className={`rounded-full border px-3 py-1.5 font-mono text-xs ${
                  band === b
                    ? "border-spectral text-ember shadow-[0_0_16px_rgba(240,163,94,0.35)]"
                    : "border-white/15 text-bone-dim hover:border-white/30 hover:text-bone"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </section>

        {entries === null ? (
          <p className="mt-8 text-sm text-bone-dim">Loading the list…</p>
        ) : (
          <>
            <p className="mt-4 font-mono text-xs text-bone-dim">
              {shown.length} of {entries.length} entries
            </p>
            <ExplorerTable entries={shown} />
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
