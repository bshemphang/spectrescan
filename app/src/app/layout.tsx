import type { Metadata } from "next";
import { Creepster, Fraunces, Geist_Mono } from "next/font/google";
import "./globals.css";
import EffectsCanvas from "@/components/EffectsCanvas";
import GhostToTop from "@/components/GhostToTop";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Halloween display face for the dossier headings. Creepster only
// ships weight 400, so it is used for short headings at 24px and
// up, never for body text. The dossier page then uses two families
// (Geist Mono plus Creepster); home and how-it-works keep Fraunces.
const creepster = Creepster({
  variable: "--font-creepster",
  subsets: ["latin"],
  weight: "400",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SpectreScan: Is this contract haunted?",
  description:
    "Paste any BSC contract address and get a plain-English haunting report: honeypot flags, hidden owners, LP locks, holder concentration, with the exact source lines cited. SpectreScan is not an audit.",
  openGraph: {
    title: "SpectreScan: Is this contract haunted?",
    description:
      "A ghost-hunter for smart contracts. Paste a BSC address, get a plain-English haunting report with cited evidence.",
    type: "website",
  },
};

export default function RootLayout(props: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${creepster.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="haunt-bg min-h-full">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-spectral focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        {/* One canvas effects layer over the page (z-1): mist, particles
            and the drifting ghost, above the hero video (z-0), below the
            page content (z-2). Colours come from the CSS variables. */}
        <EffectsCanvas />
        <div aria-hidden className="atmosphere">
          <div className="atmosphere-grid" />
          <div className="atmosphere-glow" />
          <div className="atmosphere-grain" />
        </div>
        {props.children}
        <GhostToTop />
      </body>
    </html>
  );
}
