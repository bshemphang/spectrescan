// SpectreScan — bulk scan: up to 10 addresses, scanned one at a
// time, in order, with honest per-token progress. A failed scan
// leaves its row marked failed, never blank and never faked, and
// the finished rows stay visible. Sequential on purpose: the free
// RPC quota and the 60 scans per minute server limit are never hit
// by a burst of ten at once.

"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Layers } from "lucide-react";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { shortAddress } from "@/lib/format";
import type { ScanResult } from "@/lib/engine/types";

const MAX_ADDRESSES = 10;

type RowResult =
  | { status: "queued" }
  | { status: "scanning" }
  | { status: "done"; score: number; band: string; label: string }
  | { status: "failed"; message: string };

const BAND_COLOR: Record<string, string> = {
  "Resting in peace": "#7fe0b2",
  "Mildly haunted": "#a78bfa",
  Haunted: "#f0a35e",
  Possessed: "#f26d6d",
};

function parseAddresses(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[\s,]+/)) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export default function BulkPage() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Array<{ address: string; result: RowResult }> | null>(null);
  const [running, setRunning] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const addresses = parseAddresses(input);
    if (addresses.length === 0) {
      setError("Paste at least one token address, 0x followed by 40 hex characters.");
      return;
    }
    if (addresses.length > MAX_ADDRESSES) {
      setError(
        `That is ${addresses.length} addresses. Bulk scan takes at most ${MAX_ADDRESSES} at a time, so the free RPC quota is never burned in one go.`,
      );
      return;
    }
    const bad = addresses.filter(
      (a) => !/^0x[0-9a-fA-F]{40}$/.test(a),
    );
    if (bad.length > 0) {
      setError(`Not a token address: ${bad[0]}. Every line needs 0x plus 40 hex characters.`);
      return;
    }
    setError(null);
    setRunning(true);
    const initial = addresses.map((address) => ({
      address,
      result: { status: "queued" } as RowResult,
    }));
    setRows(initial);
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      setRows((prev) =>
        (prev ?? []).map((row, j) =>
          j === i ? { ...row, result: { status: "scanning" } } : row,
        ),
      );
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        });
        const json = (await res.json()) as ScanResult & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Scan failed.");
        if (json.isEOA) throw new Error("That address is a wallet, not a token.");
        setRows((prev) =>
          (prev ?? []).map((row, j) =>
            j === i
              ? {
                  ...row,
                  result: {
                    status: "done",
                    score: json.score,
                    band: json.band,
                    label:
                      json.token.name ?? json.token.symbol ?? "Unknown token",
                  },
                }
              : row,
          ),
        );
      } catch (err: unknown) {
        setRows((prev) =>
          (prev ?? []).map((row, j) =>
            j === i
              ? {
                  ...row,
                  result: {
                    status: "failed",
                    message:
                      err instanceof Error ? err.message : "Scan failed.",
                  },
                }
              : row,
          ),
        );
      }
    }
    setRunning(false);
  }

  const doneCount = rows?.filter((r) => r.result.status !== "queued" && r.result.status !== "scanning").length ?? 0;

  return (
    <div className="relative z-[2] mx-auto w-full max-w-6xl px-5 sm:px-8">
      <SiteHeader />
      <main id="main" className="pb-16">
        <section aria-labelledby="bulk-heading" className="pt-12">
          <p className="font-mono text-xs tracking-widest text-spectral">
            $ spectre bulk --max 10
          </p>
          <h1
            id="bulk-heading"
            className="mt-3 font-haunt text-4xl font-medium text-bone sm:text-5xl"
          >
            Bulk scan
          </h1>
          <p className="mt-4 max-w-[65ch] leading-relaxed text-bone-dim">
            Paste up to 10 token addresses, one per line or separated
            by commas. They are scanned one at a time, in order, with
            each result shown as it lands. A scan that fails stays
            failed on its row, never silently dropped.
          </p>
        </section>

        <form onSubmit={submit} className="mt-8 max-w-[36rem]" noValidate>
          <label
            htmlFor="bulk-addresses"
            className="mb-2 block text-sm font-medium text-bone"
          >
            Token addresses (up to {MAX_ADDRESSES})
          </label>
          <textarea
            id="bulk-addresses"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={6}
            placeholder={"0x…\n0x…\n0x…"}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "bulk-error" : undefined}
            className="w-full resize-y rounded-lg border border-white/15 bg-[#0c0a12]/70 px-4 py-3 font-mono text-sm text-bone placeholder:text-bone-dim focus:border-spectral focus:outline-2 focus:outline-offset-2 focus:outline-spectral"
          />
          <button
            type="submit"
            disabled={running}
            className={`btn-boo mt-3 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-spectral px-6 text-sm font-semibold text-white hover:bg-[#8b5cf6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral disabled:opacity-60 ${running ? "btn-loading" : ""}`}
          >
            <Layers size={16} strokeWidth={1.5} aria-hidden />
            {running
              ? `Scanning ${doneCount} of ${rows?.length ?? 0}…`
              : "Scan all"}
          </button>
          {error && (
            <p
              id="bulk-error"
              role="alert"
              className="mt-3 text-sm text-[#f26d6d]"
            >
              {error}
            </p>
          )}
        </form>

        {rows && (
          <section aria-label="Bulk results" className="mt-8">
            <p className="font-mono text-xs text-bone-dim">
              {doneCount} of {rows.length} finished
            </p>
            <ul className="mt-3 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
              {rows.map((row) => (
                <li
                  key={row.address.toLowerCase()}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <span className="min-w-0 flex-1 font-mono text-sm break-all text-bone">
                    {shortAddress(row.address)}
                  </span>
                  {row.result.status === "queued" && (
                    <span className="font-mono text-xs text-bone-dim">Queued…</span>
                  )}
                  {row.result.status === "scanning" && (
                    <span className="font-mono text-xs text-bone-dim">Scanning…</span>
                  )}
                  {row.result.status === "failed" && (
                    <span className="font-mono text-xs text-[#f26d6d]">
                      Failed: {row.result.message}
                    </span>
                  )}
                  {row.result.status === "done" && (
                    <span className="flex shrink-0 items-center gap-2 text-sm">
                      <span className="text-bone-dim">{row.result.label}</span>
                      <span className="font-mono font-semibold text-bone tabular-nums">
                        {row.result.score}
                      </span>
                      <span
                        style={{
                          color: BAND_COLOR[row.result.band] ?? "#a78bfa",
                        }}
                      >
                        {row.result.band}
                      </span>
                      <Link
                        href={`/scan/${row.address}`}
                        className="font-medium text-spectral hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
                      >
                        Open
                      </Link>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
