// SpectreScan — POST /api/scan (spec REQ-1, REQ-5, NFR-2).
// Validates the address, runs the deterministic engine, adds the LLM
// verdict, caches for 5 minutes. The scan result never depends on the LLM:
// if the explainer fails, the findings still ship.

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

export async function POST(request: Request) {
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
  if (!isValidAddress(address)) {
    return Response.json(
      { error: "That is not a valid contract address. Use 0x followed by 40 hex characters." },
      { status: 400 },
    );
  }
  const key = address.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return Response.json(hit.result);
  }

  const result = await scanContract(address);
  const explanation = await explainScan(result);
  result.explanation = explanation;
  result.explainerFailed = explanation === null;
  cache.set(key, { at: Date.now(), result });
  return Response.json(result);
}
