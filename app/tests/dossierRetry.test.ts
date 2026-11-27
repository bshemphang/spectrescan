// SpectreScan — dossier retry button tests. When the Transfer-log read
// fails, the dossier is empty and the report must offer a retry that
// re-runs the scan; when the dossier is healthy, no retry button may
// appear. Rendered with renderToString (node environment, no DOM):
// effects never run, so localStorage-backed helpers are never touched.

import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) =>
    React.createElement("a", { href, ...props }, children),
}));

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

import ScanReport from "../src/components/ScanReport";
import { EMPTY_SUMMARY } from "../src/lib/engine/holders";
import type { ScanResult } from "../src/lib/engine/types";

const CAKE = "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82";

function baseResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    address: CAKE,
    chainId: 56,
    scannedAt: "2026-11-27T03:00:00.000Z",
    score: 46,
    band: "Mildly haunted",
    token: { name: "PancakeSwap Token", symbol: "Cake", decimals: 18, totalSupply: "1000000" },
    verified: true,
    verificationStatus: "partial",
    findings: [],
    explanation: "PancakeSwap Token scores 46 out of 100, Mildly haunted.",
    explainerFailed: false,
    explanationLocal: false,
    sources: { sourcify: true, dexscreener: true, rpc: true },
    ...overrides,
  };
}

function failedAnalysis() {
  return {
    status: "unavailable" as const,
    complete: false,
    logsFailed: true,
    window: null,
    totalSupply: "1000000",
    summary: null,
  };
}

function healthyAnalysis() {
  return {
    status: "ok" as const,
    complete: true,
    logsFailed: false,
    window: { fromBlock: 1, toBlock: 20000 },
    totalSupply: "1000000",
    summary: { ...EMPTY_SUMMARY, eventsProcessed: 12, hadValidTransfers: true },
  };
}

function dossierFor(analysis: ReturnType<typeof failedAnalysis> | ReturnType<typeof healthyAnalysis>) {
  return { analysis, proxy: { kind: "none" as const, implementation: null }, pair: null };
}

describe("dossier retry button", () => {
  it("shows Retry the transfer scan when the dossier is null", () => {
    const html = renderToString(
      React.createElement(ScanReport, {
        result: baseResult({ dossier: null }),
        elapsed: 35,
        onRetryDossier: () => {},
      }),
    );
    expect(html).toContain("Retry the transfer scan");
    expect(html).toContain("Dossier data unavailable");
  });

  it("shows Retry the transfer scan when the analysis has no summary", () => {
    const html = renderToString(
      React.createElement(ScanReport, {
        result: baseResult({ dossier: dossierFor(failedAnalysis()) }),
        elapsed: 35,
        onRetryDossier: () => {},
      }),
    );
    expect(html).toContain("Retry the transfer scan");
  });

  it("hides the retry button when the dossier is healthy", () => {
    const html = renderToString(
      React.createElement(ScanReport, {
        result: baseResult({ dossier: dossierFor(healthyAnalysis()) }),
        elapsed: 35,
        onRetryDossier: () => {},
      }),
    );
    expect(html).not.toContain("Retry the transfer scan");
  });

  it("renders the unavailable message without a retry handler", () => {
    const html = renderToString(
      React.createElement(ScanReport, {
        result: baseResult({ dossier: null }),
        elapsed: 35,
      }),
    );
    expect(html).toContain("Dossier data unavailable");
    expect(html).not.toContain("Retry the transfer scan");
  });
});
