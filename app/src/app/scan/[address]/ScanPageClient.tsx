// SpectreScan — scan page (client): fetches POST /api/scan for the
// address in the URL and renders the progress, the report, or an error.
// A new scan always starts from a blank slate: no stale result under a
// fresh error, even when navigating between scan pages.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import TerminalRun from "@/components/TerminalRun";
import ScanReport from "@/components/ScanReport";
import { saveRecent } from "@/lib/recent";
import type { ScanResult } from "@/lib/engine/types";

export default function ScanPageClient({ address }: { address: string }) {
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    })
      .then(async (res) => {
        const json = (await res.json()) as ScanResult & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Scan failed.");
        return json;
      })
      .then((json) => {
        if (cancelled) return;
        setResult(json);
        setElapsed((Date.now() - started) / 1000);
        setScanning(false);
        // Wallet lookups are not contract scans: they never enter the
        // recent-scans list or the registry.
        if (!json.isEOA) {
          saveRecent({
            address: json.address,
            name: json.token.name,
            symbol: json.token.symbol,
            score: json.score,
            band: json.band,
            scannedAt: json.scannedAt,
          });
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Scan failed. Try again.");
        setScanning(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  return (
    <>
      {scanning && <TerminalRun address={address} />}
      {error && (
        <div
          className="mt-8 flex items-start gap-3 rounded-xl border border-blood/40 bg-blood/10 p-4"
          role="alert"
        >
          <TriangleAlert
            size={18}
            strokeWidth={1.5}
            className="mt-0.5 shrink-0 text-blood"
            aria-hidden
          />
          <div>
            <p className="text-sm text-bone">{error}</p>
            <Link
              href="/"
              className="mt-3 inline-block text-sm font-medium text-spectral hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
            >
              Scan a different address
            </Link>
          </div>
        </div>
      )}
      {result && <ScanReport result={result} elapsed={elapsed} />}
    </>
  );
}
