// SpectreScan — shareable results route /scan/[address].
// The address in the URL is the scan: anyone opening the link sees the
// same result. An invalid address renders a friendly inline error with a
// link home, not a 404.

import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import ScanPageClient from "./ScanPageClient";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { isValidAddress, scanContract } from "@/lib/engine/scan";
import { metaCacheGet, metaCachePut, rateLimited } from "@/lib/scanCache";

// Social crawlers that read OpenGraph tags. A human visit must never
// pay for a server-side scan just to fill metadata: the page already
// scans in the browser, so only these user agents get the engine run
// in generateMetadata. The engine run here is deterministic only, no
// LLM verdict, and its result is not cached in the scan cache:
// caching an explanation-less result would hand the API a scan with
// no verdict for five minutes. The title and description are cached
// separately in a small metadata cache instead, and the gate is
// rate-limited per IP like the API, because a user agent string is
// fully attacker controlled and anyone can send "twitterbot" with
// curl to force a full engine run.
const BOT_UA =
  /twitterbot|facebookexternalhit|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|googlebot/i;

const SITE_URL = "https://spectrescan.onrender.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>;
}): Promise<Metadata> {
  const { address } = await params;
  const generic: Metadata = {
    title: `Scan ${address} | SpectreScan`,
    description:
      "SpectreScan reads a BNB Chain contract's verified source and on-chain footprint and tells you what is wrong with it, with the evidence cited.",
  };
  if (!isValidAddress(address)) return generic;
  let ua = "";
  let ip = "unknown";
  try {
    const h = await headers();
    ua = h.get("user-agent") ?? "";
    const forwarded = h.get("x-forwarded-for");
    ip = forwarded?.split(",")[0]?.trim() || "unknown";
  } catch {
    return generic;
  }
  if (!BOT_UA.test(ua)) return generic;
  // A cached title and description answer a repeated crawl without
  // re-running the engine. A spoofed UA still hits the per-IP rate
  // limit, and a limited bot gets the generic tags, not an error.
  const metaKey = address.toLowerCase();
  const cached = metaCacheGet(metaKey);
  if (cached) {
    return {
      title: cached.title,
      description: cached.description,
      openGraph: {
        title: cached.title,
        description: cached.description,
        url: `${SITE_URL}/scan/${address}`,
        siteName: "SpectreScan",
        type: "website",
      },
      twitter: {
        card: "summary",
        title: cached.title,
        description: cached.description,
      },
    };
  }
  if (rateLimited(`meta:${ip}`)) return generic;
  let result;
  try {
    result = await scanContract(address);
  } catch {
    return generic;
  }
  if (result.isEOA) {
    return {
      title: `${address} is a wallet, not a token | SpectreScan`,
      description:
        "That address holds no contract code, so there is no token to score. SpectreScan reads a BNB Chain contract's verified source and on-chain footprint.",
      openGraph: {
        title: `${address} is a wallet, not a token | SpectreScan`,
        description:
          "That address holds no contract code, so there is no token to score.",
        url: `${SITE_URL}/scan/${address}`,
        siteName: "SpectreScan",
        type: "website",
      },
      twitter: {
        card: "summary",
        title: `${address} is a wallet, not a token | SpectreScan`,
        description:
          "That address holds no contract code, so there is no token to score.",
      },
    };
  }
  const name =
    result.token.name || result.token.symbol || result.address;
  const title = `${name}: ${result.score}/100, ${result.band} | SpectreScan`;
  const description = `SpectreScan scored ${name} ${result.score} out of 100: ${result.band}. ${result.findings.length} ${result.findings.length === 1 ? "finding" : "findings"} from nine deterministic checks on the verified source and on-chain footprint. SpectreScan is not an audit.`;
  metaCachePut(metaKey, { title, description });
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/scan/${address}`,
      siteName: "SpectreScan",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default function ScanPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  // The address is runtime data, so the part that reads it lives behind
  // a Suspense boundary: the shell (header, footer) prerenders and the
  // scan streams in. Without the boundary Next.js 16 logs a blocking
  // prerender error for this route.
  return (
    <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
      <SiteHeader />
      <main id="main" className="pb-16">
        <Suspense
          fallback={
            <p className="mt-8 text-sm text-bone-dim">Loading the scan…</p>
          }
        >
          <ScanPageContent params={params} />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

async function ScanPageContent({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;

  if (!isValidAddress(address)) {
    return (
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
          <p className="text-sm text-bone">
            That is not a contract address. Use 0x followed by 40 hex
            characters.
          </p>
          <p className="mt-1 font-mono text-xs break-all text-bone-dim">
            {address}
          </p>
          <Link
            href="/"
            className="mt-3 inline-block text-sm font-medium text-spectral hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
          >
            Back to the home page
          </Link>
        </div>
      </div>
    );
  }

  // The client component is keyed by address, so navigating to a new
  // scan remounts it from a blank slate: no stale result under a fresh
  // error, even when moving between scan pages.
  return <ScanPageClient key={address} address={address} />;
}
