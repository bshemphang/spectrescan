import type { Metadata } from "next";
import { Fraunces, Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SpectreScan — Is this contract haunted?",
  description:
    "Paste any BSC contract address and get a plain-English haunting report: honeypot flags, hidden owners, LP locks, holder concentration — with the exact source lines cited. SpectreScan is not an audit.",
  openGraph: {
    title: "SpectreScan — Is this contract haunted?",
    description:
      "A ghost-hunter for smart contracts. Paste a BSC address, get a plain-English haunting report with cited evidence.",
    type: "website",
  },
};

export default function RootLayout(props: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="haunt-bg min-h-full">{props.children}</body>
    </html>
  );
}
