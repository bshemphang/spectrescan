// SpectreScan — shared scan cache and rate limiter for the API
// routes. Both POST /api/scan and GET /api/scan share one cache and
// one limiter, and the badge route reads the same cache, so a
// repeated scan never re-runs the engine and a badge never scans
// twice in five minutes. The cache is bounded (200 entries, oldest
// first out) so it cannot grow without limit. The limiter is
// per-instance and fail-open by design: it only slows casual abuse,
// it is not a security boundary.

import type { ScanResult } from "@/lib/engine/types";

const cache = new Map<string, { at: number; result: ScanResult }>();
const CACHE_MS = 5 * 60 * 1000;
const CACHE_MAX = 200;

export function cacheGet(key: string): ScanResult | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at >= CACHE_MS) {
    cache.delete(key);
    return null;
  }
  return hit.result;
}

export function cachePut(key: string, result: ScanResult): void {
  if (!cache.has(key) && cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), result });
}

// Minimal per-IP rate limit: 60 scans per rolling minute per
// client, not one global bucket. A single global bucket lets one
// actor lock every visitor out, and lets the watchlist page lock
// itself out by re-scanning 50 starred tokens in sequence. The IP
// comes from x-forwarded-for behind the Render proxy; without it
// the bucket is "unknown". Per instance in memory, so it resets on
// restart and does not coordinate across instances: it only slows
// casual abuse, it is not a security boundary.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60;
const rateBuckets = new Map<string, { start: number; count: number }>();

export function rateLimited(key = "global"): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.start >= RATE_WINDOW_MS) {
    rateBuckets.set(key, { start: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  // Prune stale buckets so the map cannot grow without limit.
  if (rateBuckets.size > 1000) {
    for (const [k, b] of rateBuckets) {
      if (now - b.start >= RATE_WINDOW_MS) rateBuckets.delete(k);
    }
  }
  return bucket.count > RATE_MAX;
}

// Client IP for rate limiting. Behind the Render proxy the real
// address is the first entry in x-forwarded-for; direct requests
// have no header and share the "unknown" bucket.
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first ? first : "unknown";
}

export const RATE_LIMIT_MESSAGE =
  "Too many scans. Wait a minute and try again.";

// Small metadata-only cache for the scan page's OpenGraph tags.
// The social-bot gate runs the engine for a bot user agent, so a
// repeated crawl of the same address must not re-run the engine,
// and a spoofed UA must hit the same per-IP rate limit as the API.
// Only the title and description are stored, never a scan result:
// caching a verdict-less result here would hand the API a scan
// with no verdict for five minutes.
const META_CACHE_MS = 5 * 60 * 1000;
const META_CACHE_MAX = 200;
const metaCache = new Map<
  string,
  { at: number; title: string; description: string }
>();

export function metaCacheGet(
  key: string,
): { title: string; description: string } | null {
  const hit = metaCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at >= META_CACHE_MS) {
    metaCache.delete(key);
    return null;
  }
  return { title: hit.title, description: hit.description };
}

export function metaCachePut(
  key: string,
  value: { title: string; description: string },
): void {
  if (!metaCache.has(key) && metaCache.size >= META_CACHE_MAX) {
    const oldest = metaCache.keys().next().value;
    if (oldest !== undefined) metaCache.delete(oldest);
  }
  metaCache.set(key, { at: Date.now(), ...value });
}
