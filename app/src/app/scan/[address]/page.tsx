// SpectreScan — shareable results route /scan/[address].
// The address in the URL is the scan: anyone opening the link sees the
// same result. An invalid address renders a friendly inline error with a
// link home, not a 404.

import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import ScanPageClient from "./ScanPageClient";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { isValidAddress } from "@/lib/engine/scan";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>;
}): Promise<Metadata> {
  const { address } = await params;
  return {
    title: `Scan ${address} | SpectreScan`,
    description:
      "SpectreScan reads a BNB Chain contract's verified source and on-chain footprint and tells you what is wrong with it, with the evidence cited.",
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
