// SpectreScan — GET /api/badge?address=
// An embeddable SVG badge showing a token's band and score. The
// badge reads the shared scan cache, and runs a full scan on a miss,
// warming the cache for the dossier too. It never says audited or
// safe: the band is a risk band from a rules scan. Rate-limited with
// the same shared limiter as /api/scan, and browsers may cache the
// image for 5 minutes.

import { isValidAddress } from "@/lib/engine/scan";
import {
  cacheGet,
  cachePut,
  clientIp,
  rateLimited,
  RATE_LIMIT_MESSAGE,
} from "@/lib/scanCache";
import { runScan } from "@/lib/scanApi";

const BAND_COLOR: Record<string, string> = {
  "Resting in peace": "#7fe0b2",
  "Mildly haunted": "#a78bfa",
  Haunted: "#f0a35e",
  Possessed: "#f26d6d",
};

// Escape text for an SVG text node: ampersand, angle brackets, both
// quote kinds, control characters, and a closing ]]> sequence, which
// would otherwise make the badge unparseable. The label goes into a
// text element, never an attribute, but the extra escapes cost
// nothing and keep a crafted token symbol from breaking the image.
function escapeXml(s: string): string {
  return s
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/]]>/g, "]]&gt;")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// The badge is an image, never a page. Its Content-Security-Policy
// is set in next.config.ts, where a per-path rule for /api/badge
// overrides the site-wide policy with default-src 'none'; sandbox:
// a route-level CSP header is overwritten by the config headers,
// so it is set there instead. An SVG opened directly cannot run
// script in the site origin, even if a future interpolation slips.
const BADGE_HEADERS = {
  "Content-Type": "image/svg+xml",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const address = (url.searchParams.get("address") ?? "").trim();
  // Validate before rate limiting: an invalid address must never
  // burn budget, or garbage requests alone could lock everyone out.
  if (!isValidAddress(address)) {
    return new Response("That is not a valid contract address.", {
      status: 400,
      headers: { "Content-Type": "text/plain" },
    });
  }
  if (rateLimited(clientIp(request))) {
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="28"><rect width="220" height="28" rx="6" fill="#16121f"/><text x="10" y="19" font-family="monospace" font-size="12" fill="#b8b3c4">SpectreScan: ${escapeXml(RATE_LIMIT_MESSAGE)}</text></svg>`,
      {
        status: 429,
        headers: {
          ...BADGE_HEADERS,
          "Cache-Control": "public, max-age=60",
        },
      },
    );
  }
  const key = address.toLowerCase();
  let result = cacheGet(key);
  if (!result) {
    try {
      result = await runScan(address);
      cachePut(key, result);
    } catch {
      return new Response(
        `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="28"><rect width="220" height="28" rx="6" fill="#16121f"/><text x="10" y="19" font-family="monospace" font-size="12" fill="#b8b3c4">SpectreScan: scan failed, try again</text></svg>`,
        {
          status: 502,
          headers: {
            ...BADGE_HEADERS,
            "Cache-Control": "public, max-age=60",
          },
        },
      );
    }
  }
  if (result.isEOA) {
    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="28"><rect width="220" height="28" rx="6" fill="#16121f"/><text x="10" y="19" font-family="monospace" font-size="12" fill="#f2f0ea">SpectreScan: wallet, not a token</text></svg>`,
      {
        headers: {
          ...BADGE_HEADERS,
          "Cache-Control": "public, max-age=300",
        },
      },
    );
  }
  const color = BAND_COLOR[result.band] ?? "#a78bfa";
  const label = `${result.token.symbol ?? "Token"} ${result.score}/100 ${result.band}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="28"><rect width="320" height="28" rx="6" fill="#16121f"/><circle cx="14" cy="14" r="5" fill="${color}"/><text x="26" y="19" font-family="monospace" font-size="12" fill="#f2f0ea">SpectreScan: ${escapeXml(label)}</text></svg>`;
  return new Response(svg, {
    headers: {
      ...BADGE_HEADERS,
      "Cache-Control": "public, max-age=300",
    },
  });
}
