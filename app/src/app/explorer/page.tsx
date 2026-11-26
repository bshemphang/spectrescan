// SpectreScan — the haunted-token explorer: the front door for
// browsing instead of scanning. Most haunted first, built from the
// curated filed cases shipped in the repo plus the scans this
// browser has run. It is labelled as curated scanned tokens, never
// as a live ranking of the whole chain. The registry is the full
// searchable database; this page is the most-haunted-first way in.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ExplorerTable from "@/components/ExplorerTable";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import {
  filterExplorerEntries,
  mergeExplorerEntries,
  sortExplorerEntries,
  type ExplorerEntry,
} from "@/lib/explorer";
import { CASE_FILES } from "@/lib/cases";
import { loadRecent } from "@/lib/recent";

export default function ExplorerPage() {
  const [entries, setEntries] = useState<ExplorerEntry[] | null>(null);

  useEffect(() => {
    // localStorage exists only in the browser; read it after mount
    // so the server render and the first client paint agree.
    const raf = requestAnimationFrame(() => {
      const merged = mergeExplorerEntries(CASE_FILES, loadRecent());
      setEntries(
        sortExplorerEntries(
          filterExplorerEntries(merged, "", "all"),
          "haunted",
        ),
      );
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative z-[2] mx-auto w-full max-w-6xl px-5 sm:px-8">
      <SiteHeader />
      <main id="main" className="pb-16">
        <section aria-labelledby="explorer-heading" className="pt-12">
          <p className="font-mono text-xs tracking-widest text-spectral">
            $ spectre explore --most-haunted
          </p>
          <h1
            id="explorer-heading"
            className="mt-3 font-haunt text-4xl font-medium text-bone sm:text-5xl"
          >
            The haunted explorer
          </h1>
          <p className="mt-4 max-w-[65ch] leading-relaxed text-bone-dim">
            Browse the tokens this site has actually scanned and filed,
            most haunted first. These are curated scanned tokens, not a
            live ranking of the whole chain: every row is either a filed
            case from the repo or a scan this browser ran.
          </p>
          <p className="mt-4">
            <Link
              href="/registry"
              className="text-sm font-medium text-spectral hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
            >
              Open the full registry to search and sort everything
            </Link>
          </p>
        </section>
        {entries === null ? (
          <p className="mt-8 text-sm text-bone-dim">Loading the list…</p>
        ) : (
          <ExplorerTable entries={entries} />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
