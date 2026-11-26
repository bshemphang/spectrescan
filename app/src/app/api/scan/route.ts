// SpectreScan — /api/scan (spec REQ-1, REQ-5, NFR-2).
// POST validates the address, runs the deterministic engine, adds
// the LLM verdict, and caches for 5 minutes. GET does the same read
// for the public API and the badge route: one endpoint, one cache,
// one rate limit, so a badge or a docs example never scans twice.
// The scan result never depends on the LLM: if the explainer fails,
// the findings still ship. A retryExplainer flag re-runs only the
// explainer against a fresh cached result, so the verdict can be
// retried without a full rescan.

import { isValidAddress } from "@/lib/engine/scan";
import { runScan, retryVerdictOnly } from "@/lib/scanApi";
import {
  cacheGet,
  cachePut,
  clientIp,
  rateLimited,
  RATE_LIMIT_MESSAGE,
} from "@/lib/scanCache";
import type { ScanResult } from "@/lib/engine/types";

// NOTE: no `runtime` / `dynamic` / `maxDuration` segment configs here —
// this Next.js 16 scaffold enables `cacheComponents`, which forbids them.
// A POST handler is dynamic by default, and the scan enforces its own
// internal timeouts (per-call fetch timeouts + a 25s holder-scan budget),
// so the route stays within normal serverless limits on hosts that allow
// ~60s functions (Render free tier; see README for deployment notes).

function rateLimitResponse(): Response {
  return Response.json(
    { error: RATE_LIMIT_MESSAGE },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const address = (url.searchParams.get("address") ?? "").trim();
  // Validate before rate limiting: an invalid address must never
  // burn budget, or garbage requests alone could lock everyone out.
  if (!isValidAddress(address)) {
    return Response.json(
      { error: "That is not a valid contract address. Use 0x followed by 40 hex characters." },
      { status: 400 },
    );
  }
  if (rateLimited(clientIp(request))) return rateLimitResponse();
  const key = address.toLowerCase();
  const hit = cacheGet(key);
  if (hit) return Response.json(hit);
  const result = await runScan(address);
  cachePut(key, result);
  return Response.json(result);
}

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
  const retryExplainer =
    typeof body === "object" && body !== null && "retryExplainer" in body
      ? (body as { retryExplainer?: unknown }).retryExplainer === true
      : false;
  // Validate before rate limiting: an invalid address must never
  // burn budget, or garbage requests alone could lock everyone out.
  if (!isValidAddress(address)) {
    return Response.json(
      { error: "That is not a valid contract address. Use 0x followed by 40 hex characters." },
      { status: 400 },
    );
  }
  if (rateLimited(clientIp(request))) return rateLimitResponse();
  const key = address.trim().toLowerCase();
  const hit = cacheGet(key);
  if (hit) {
    if (retryExplainer && !hit.isEOA) {
      const updated = await retryVerdictOnly(hit);
      cachePut(key, updated);
      return Response.json(updated);
    }
    return Response.json(hit);
  }

  const result = await runScan(address);
  cachePut(key, result);
  return Response.json(result);
}
