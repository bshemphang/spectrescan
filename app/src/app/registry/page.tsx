// SpectreScan — the registry: a graveyard of real scans. Every scan
// this browser has run, plus the three filed cases. Nothing here is
// invented, seeded, or estimated. A wallet lookup never enters the
// registry: it is not a contract scan.

import type { Metadata } from "next";
import CaseFile from "@/components/CaseFile";
import RecentScans from "@/components/RecentScans";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { CASE_FILES } from "@/lib/cases";

export const metadata: Metadata = {
  title: "The registry | SpectreScan",
  description:
    "Every scan this browser has run, plus the three filed cases. Real scans only, nothing invented.",
};

export default function RegistryPage() {
  return (
    <div className="relative z-[2] mx-auto w-full max-w-6xl px-5 sm:px-8">
      <SiteHeader />
      <main id="main" className="pb-16">
        <section aria-labelledby="registry-heading" className="pt-12">
          <p className="font-mono text-xs tracking-widest text-spectral">
            $ spectre registry --list
          </p>
          <h1
            id="registry-heading"
            className="mt-3 font-display text-4xl font-medium text-bone sm:text-5xl"
          >
            The registry
          </h1>
          <p className="mt-4 max-w-[65ch] leading-relaxed text-bone-dim">
            A graveyard of real scans. Everything below is a scan this
            browser actually ran, or one of the three filed cases. No
            seeded activity, no invented usage, no estimates dressed up
            as results.
          </p>
        </section>

        <RecentScans />

        <section aria-labelledby="filed-heading" className="mt-16">
          <h2
            id="filed-heading"
            className="font-display text-2xl font-semibold text-bone"
          >
            Filed cases
          </h2>
          <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-bone-dim">
            The three cases the site ships with. Their findings are the
            engine&apos;s own output, copied verbatim from live scans.
          </p>
          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {CASE_FILES.map((file) => (
              <CaseFile key={file.address} file={file} />
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
