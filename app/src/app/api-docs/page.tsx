// SpectreScan — API docs: the public API and the embeddable badge.
// The docs state plainly what the API is and is not: a public
// read-only scan, rate limited like the web scan, with no
// authentication and no guarantees. SpectreScan is not an audit and
// the badge never says it is.

import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

const ENDPOINTS: Array<{
  method: string;
  path: string;
  what: string;
  curl: string;
}> = [
  {
    method: "GET",
    path: "/api/scan?address=0x…",
    what: "Scan a token and get the score, band, and findings as JSON. Same result as the web scan, including the ghost's verdict. Responses are cached for 5 minutes.",
    curl: `curl "https://spectrescan.onrender.com/api/scan?address=0x000000000000000000000000000000000000dEaD"`,
  },
  {
    method: "POST",
    path: "/api/scan",
    what: "Scan a token from a JSON body. The web scan uses this. Send { \"address\": \"0x…\" } with a retryExplainer flag to retry only the AI explanation when it failed. Uses the same cache as GET.",
    curl: `curl -X POST "https://spectrescan.onrender.com/api/scan" -H "Content-Type: application/json" -d '{"address":"0x000000000000000000000000000000000000dEaD"}'`,
  },
  {
    method: "GET",
    path: "/api/badge?address=0x…",
    what: "An SVG badge any site can embed, showing the token's score and band in the band color. Cached for 5 minutes, rate limited like the scan. On failure it still returns an SVG, never a broken image.",
    curl: `curl "https://spectrescan.onrender.com/api/badge?address=0x000000000000000000000000000000000000dEaD"`,
  },
];

export default function ApiDocsPage() {
  return (
    <div className="relative z-[2] mx-auto w-full max-w-6xl px-5 sm:px-8">
      <SiteHeader />
      <main id="main" className="pb-16">
        <section aria-labelledby="api-heading" className="pt-12">
          <p className="font-mono text-xs tracking-widest text-spectral">
            $ spectre api --docs
          </p>
          <h1
            id="api-heading"
            className="mt-3 font-haunt text-4xl font-medium text-bone sm:text-5xl"
          >
            The public API
          </h1>
          <p className="mt-4 max-w-[65ch] leading-relaxed text-bone-dim">
            A read-only API for the scanner. No key, no sign-up, no
            account. Rate limited to 60 scans a minute, shared with
            the web scan, and cached for 5 minutes. What it returns is
            a scan: a score, a band, and the findings behind them. It
            is not an audit, and nothing it returns is financial
            advice.
          </p>
        </section>

        <section aria-label="Endpoints" className="mt-10 space-y-6">
          {ENDPOINTS.map((ep) => (
            <article
              key={ep.path}
              className="rounded-2xl border border-haunt-border bg-haunt-panel p-5 sm:p-6"
            >
              <p className="font-mono text-sm">
                <span className="font-semibold text-spectral">
                  {ep.method}
                </span>{" "}
                <span className="break-all text-bone">{ep.path}</span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-bone-dim">
                {ep.what}
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs text-bone-dim">
                <code>{ep.curl}</code>
              </pre>
            </article>
          ))}
        </section>

        <section
          aria-labelledby="badge-heading"
          className="mt-12 rounded-2xl border border-haunt-border bg-haunt-panel p-5 sm:p-6"
        >
          <h2
            id="badge-heading"
            className="font-display text-xl font-semibold text-bone"
          >
            Embed the badge
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-bone-dim">
            Drop this image tag into any page. It shows the
            token&apos;s band and score, fetched live from the API.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs text-bone-dim">
            <code>
              {`<img src="https://spectrescan.onrender.com/api/badge?address=0xYOUR_TOKEN_ADDRESS" alt="SpectreScan score" />`}
            </code>
          </pre>
        </section>

        <section aria-label="Limits" className="mt-6 text-sm leading-relaxed text-bone-dim">
          <p>
            Rate limit: 60 scans per minute across all endpoints. A
            429 answer means slow down and try again in a minute.
            Responses are cached for 5 minutes, so repeated scans of
            the same token return the same answer. SpectreScan is not
            an audit. Never invest more than you can afford to lose.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
