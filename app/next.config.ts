import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Security headers on every response. The CSP is pragmatic, not
  // maximal: the hero uses a local Three.js bundle and a local
  // video, fonts are self-hosted by next/font, and the only hosts
  // the browser itself talks to are this site's own API routes.
  // The RPC, Sourcify, Dexscreener, and Pollinations calls all run
  // server-side, so they need no browser allowlist. script-src
  // keeps 'unsafe-inline' on purpose: Next.js ships its hydration
  // payload as inline scripts, and their hashes rotate every
  // build, so a hash allowlist cannot work and 'self' alone breaks
  // hydration entirely (verified by QA: blocked inline scripts
  // stopped the client scan from running). React's escaping, not
  // the CSP, is what stops injected markup reaching the page. No
  // frame embedding, no MIME sniffing, no referrer leak, and the
  // browser is told not to expose camera, microphone, or
  // geolocation.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data:",
              "font-src 'self'",
              "connect-src 'self'",
              "media-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
      // The badge is an image, never a page: it gets the strictest
      // policy, and this later matching rule overrides the catch-all
      // CSP above for this one route. A badge opened directly cannot
      // run script in the site origin, even if a future
      // interpolation slips.
      {
        source: "/api/badge",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; sandbox",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
