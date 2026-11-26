// SpectreScan — watchlist: the tokens you starred, re-scanned on
// open. Every row shows the score and band now, and an arrow when
// either moved since the last scan. Re-scans happen on open only,
// never in the background: each re-scan costs public RPC calls, and
// a page that scans by itself would burn the free quota. The stored
// values update after each re-scan, so the next visit compares
// against this one.

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Star, Trash2 } from "lucide-react";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import {
  loadWatchlist,
  unwatchToken,
  updateWatched,
  type WatchEntry,
} from "@/lib/watchlist";
import { shortAddress } from "@/lib/format";
import type { ScanResult } from "@/lib/engine/types";

type RowState =
  | { status: "queued" }
  | { status: "scanning" }
  | {
      status: "done";
      score: number;
      band: string;
      prevScore: number;
      prevBand: string;
    }
  | { status: "failed"; message: string };

const BAND_COLOR: Record<string, string> = {
  "Resting in peace": "#7fe0b2",
  "Mildly haunted": "#a78bfa",
  Haunted: "#f0a35e",
  Possessed: "#f26d6d",
};

export default function WatchlistPage() {
  const [entries, setEntries] = useState<WatchEntry[] | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const list = loadWatchlist();
    setEntries(list);
    const initial: Record<string, RowState> = {};
    for (const e of list) initial[e.address.toLowerCase()] = { status: "queued" };
    setRows(initial);
    // Sequential re-scan: one address at a time, so the free RPC
    // quota and the 60 scans per minute server limit are never hit
    // by a burst. A failed re-scan keeps the stored values and says
    // so, instead of pretending the token is unchanged.
    void (async () => {
      for (const entry of list) {
        const key = entry.address.toLowerCase();
        setRows((r) => ({ ...r, [key]: { status: "scanning" } }));
        try {
          const res = await fetch("/api/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: entry.address }),
          });
          const json = (await res.json()) as ScanResult & { error?: string };
          if (!res.ok) throw new Error(json.error ?? "Scan failed.");
          if (json.isEOA) throw new Error("That address is a wallet now, not a token.");
          setRows((r) => ({
            ...r,
            [key]: {
              status: "done",
              score: json.score,
              band: json.band,
              prevScore: entry.score,
              prevBand: entry.band,
            },
          }));
          updateWatched({
            ...entry,
            score: json.score,
            band: json.band,
            lastScannedAt: json.scannedAt,
          });
        } catch (err: unknown) {
          setRows((r) => ({
            ...r,
            [key]: {
              status: "failed",
              message:
                err instanceof Error ? err.message : "Re-scan failed.",
            },
          }));
        }
      }
    })();
  }, []);

  function remove(address: string) {
    unwatchToken(address);
    setEntries((list) =>
      (list ?? []).filter(
        (e) => e.address.toLowerCase() !== address.toLowerCase(),
      ),
    );
    setRows((r) => {
      const next = { ...r };
      delete next[address.toLowerCase()];
      return next;
    });
  }

  return (
    <div className="relative z-[2] mx-auto w-full max-w-6xl px-5 sm:px-8">
      <SiteHeader />
      <main id="main" className="pb-16">
        <section aria-labelledby="watchlist-heading" className="pt-12">
          <p className="font-mono text-xs tracking-widest text-spectral">
            $ spectre watch --list
          </p>
          <h1
            id="watchlist-heading"
            className="mt-3 font-haunt text-4xl font-medium text-bone sm:text-5xl"
          >
            Your watchlist
          </h1>
          <p className="mt-4 max-w-[65ch] leading-relaxed text-bone-dim">
            Tokens you starred on their dossiers. Opening this page
            re-scans each one, in order, and shows what moved since
            the last scan. Nothing re-scans in the background.
          </p>
        </section>

        {entries === null ? (
          <p className="mt-8 text-sm text-bone-dim">Loading the list…</p>
        ) : entries.length === 0 ? (
          <p className="mt-8 rounded-xl border border-haunt-border bg-haunt-panel p-5 text-sm text-bone-dim">
            Nothing starred yet. Open any scan and tap the star to
            watch a token here.
          </p>
        ) : (
          <ul className="mt-8 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
            {entries.map((entry) => {
              const row = rows[entry.address.toLowerCase()] ?? {
                status: "queued" as const,
              };
              return (
                <li
                  key={entry.address}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <Star
                    size={16}
                    strokeWidth={1.5}
                    className="shrink-0 text-ember"
                    aria-hidden
                  />
                  <Link
                    href={`/scan/${entry.address}`}
                    className="min-w-0 flex-1 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
                  >
                    <span className="block truncate text-sm font-medium text-bone">
                      {entry.name ?? "Unknown token"}
                      {entry.symbol ? ` (${entry.symbol})` : ""}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-xs text-bone-dim">
                      {shortAddress(entry.address)}
                    </span>
                  </Link>
                  {row.status === "queued" && (
                    <span className="font-mono text-xs text-bone-dim">
                      Queued…
                    </span>
                  )}
                  {row.status === "scanning" && (
                    <span className="font-mono text-xs text-bone-dim">
                      Re-scanning…
                    </span>
                  )}
                  {row.status === "failed" && (
                    <span className="font-mono text-xs text-[#f26d6d]">
                      Re-scan failed, kept {entry.score} {entry.band}
                    </span>
                  )}
                  {row.status === "done" && (
                    <span className="flex shrink-0 items-center gap-2 text-sm">
                      <span className="font-mono font-semibold text-bone tabular-nums">
                        {row.score}
                      </span>
                      <span
                        className="hidden sm:inline"
                        style={{ color: BAND_COLOR[row.band] ?? "#a78bfa" }}
                      >
                        {row.band}
                      </span>
                      {row.score !== row.prevScore ? (
                        <span
                          className="font-mono text-xs"
                          style={{
                            color:
                              row.score > row.prevScore
                                ? "#f26d6d"
                                : "#7fe0b2",
                          }}
                        >
                          {row.score > row.prevScore ? "▲" : "▼"}{" "}
                          {row.prevScore} to {row.score}
                        </span>
                      ) : row.band !== row.prevBand ? (
                        <span className="font-mono text-xs text-bone-dim">
                          band changed: {row.prevBand} to {row.band}
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-bone-dim">
                          unchanged
                        </span>
                      )}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(entry.address)}
                    aria-label={`Remove ${entry.name ?? entry.address} from the watchlist`}
                    className="rounded-md border border-white/15 p-2 text-bone-dim hover:border-white/30 hover:text-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
                  >
                    <Trash2 size={15} strokeWidth={1.5} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
