// SpectreScan — POST /api/scan (spec REQ-1, REQ-5, NFR-2).
// Validates the address, runs the deterministic engine, adds the LLM
// verdict, caches for 5 minutes (at most 200 entries, oldest first
// out). The scan result never depends on the LLM: if the explainer
// fails, the findings still ship. A retryExplainer flag re-runs only
// the explainer against a fresh cached result, so the verdict can be
// retried without a full rescan.

import { explainScan } from "@/lib/explainer";
import { isValidAddress, scanContract } from "@/lib/engine/scan";
import type { ScanResult } from "@/lib/engine/types";

// NOTE: no `runtime` / `dynamic` / `maxDuration` segment configs here —
// this Next.js 16 scaffold enables `cacheComponents`, which forbids them.
// A POST handler is dynamic by default, and the scan enforces its own
// internal timeouts (per-call fetch timeouts + a 15s holder-scan budget),
// so the route stays within normal serverless limits on hosts that allow
// ~60s functions (Render free tier; see README for deployment notes).

const cache = new Map<string, { at: number; result: ScanResult }>();
const CACHE_MS = 5 * 60 * 1000;
// Bounded cache: at most 200 entries, oldest first out. An unbounded
// Map would grow with every unique address scanned until the process
// ran out of memory.
const CACHE_MAX = 200;

function cachePut(key: string, result: ScanResult): void {
  if (!cache.has(key) && cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), result });
}

// Minimal per-instance rate limit: 60 scans per rolling minute. This is a
// public, unauthenticated tool, so the limit only slows casual abuse; it
// is not a security boundary. On multi-instance hosts it applies per
// instance. Fail-open by design: the limiter is three lines with no
// external dependency, so there is nothing to fail.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60;
let rateWindowStart = 0;
let rateCount = 0;

function rateLimited(): boolean {
  const now = Date.now();
  if (now - rateWindowStart >= RATE_WINDOW_MS) {
    rateWindowStart = now;
    rateCount = 0;
  }
  rateCount += 1;
  return rateCount > RATE_MAX;
}

export async function POST(request: Request) {
  if (rateLimited()) {
    return Response.json(
      { error: "Too many scans. Wait a minute and try again." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const address =
    typeof body === "object" && body !== null && "address" in body
      ? String((body as { address: unknown }).address ?? "")
      : "";
  const retryExplainer =
    typeof body === "object" && body !== null && "retryExplainer" in body
      ? (body as { retryExplainer?: unknown }).retryExplainer === true
      : false;
  if (!isValidAddress(address)) {
    return Response.json(
      { error: "That is not a valid contract address. Use 0x followed by 40 hex characters." },
      { status: 400 },
    );
  }
  const key = address.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    if (retryExplainer) {
      // Verdict-only retry: the engine result is still fresh, so only
      // re-run the explainer and update the cached verdict.
      const explanation = await explainScan(hit.result);
      hit.result.explanation = explanation;
      hit.result.explainerFailed = explanation === null;
    }
    return Response.json(hit.result);
  }

  const result = await scanContract(address);
  const explanation = await explainScan(result);
  result.explanation = explanation;
  result.explainerFailed = explanation === null;
  cachePut(key, result);
  return Response.json(result);
}
