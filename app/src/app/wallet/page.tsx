// SpectreScan — wallet check: known hauntings in a wallet. Paste a
// wallet address and the page reads its BNB balance and, for each
// token the site has actually filed, whether this wallet holds any
// of it. There is no holdings source for every token on the chain,
// so this page states plainly that it checks known tokens only, and
// a clean result means none of the known haunted tokens were found,
// not that the wallet is safe. A contract address is rejected here:
// scan it as a token instead.

"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { TriangleAlert, Wallet } from "lucide-react";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { formatAmount, shortAddress } from "@/lib/format";

interface Holding {
  address: string;
  label: string;
  symbol: string | null;
  balance: string;
  decimals: number | null;
  score: number;
  band: string;
}

interface WalletResult {
  address: string;
  bnb: string | null;
  checkedTokens: number;
  holdings: Holding[];
}

const BAND_COLOR: Record<string, string> = {
  "Resting in peace": "#7fe0b2",
  "Mildly haunted": "#a78bfa",
  Haunted: "#f0a35e",
  Possessed: "#f26d6d",
};

export default function WalletPage() {
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WalletResult | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = address.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
      setError("Enter a wallet address: 0x followed by 40 hex characters.");
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(
        `/api/wallet?address=${encodeURIComponent(value)}`,
      );
      const json = (await res.json()) as WalletResult & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Wallet check failed.");
      setResult(json);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Wallet check failed. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative z-[2] mx-auto w-full max-w-6xl px-5 sm:px-8">
      <SiteHeader />
      <main id="main" className="pb-16">
        <section aria-labelledby="wallet-heading" className="pt-12">
          <p className="font-mono text-xs tracking-widest text-spectral">
            $ spectre wallet --known-only
          </p>
          <h1
            id="wallet-heading"
            className="mt-3 font-haunt text-4xl font-medium text-bone sm:text-5xl"
          >
            Known hauntings in this wallet
          </h1>
          <p className="mt-4 max-w-[65ch] leading-relaxed text-bone-dim">
            Paste a wallet address. The page reads its BNB balance and
            checks, token by token, whether it holds any of the tokens
            this site has filed. It only knows the tokens it has filed:
            a clean result means none of the known haunted tokens were
            found here, not that the wallet is safe.
          </p>
        </section>

        <form onSubmit={submit} className="mt-8 max-w-[36rem]" noValidate>
          <label
            htmlFor="wallet-address"
            className="mb-2 block text-sm font-medium text-bone"
          >
            Wallet address
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="wallet-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "wallet-error" : undefined}
              className="h-12 min-w-0 flex-1 rounded-lg border border-white/15 bg-[#0c0a12]/70 px-4 font-mono text-sm text-bone placeholder:text-bone-dim focus:border-spectral focus:outline-2 focus:outline-offset-2 focus:outline-spectral"
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-spectral px-6 text-sm font-semibold text-white transition-[background-color,border-color,box-shadow,transform] hover:bg-[#8b5cf6] hover:shadow-[0_0_28px_rgba(139,92,246,0.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral active:scale-[0.97] disabled:opacity-60"
            >
              <Wallet size={16} strokeWidth={1.5} aria-hidden />
              {loading ? "Reading the wallet…" : "Check the wallet"}
            </button>
          </div>
          {error && (
            <p
              id="wallet-error"
              role="alert"
              className="mt-3 text-sm text-[#f26d6d]"
            >
              {error}
            </p>
          )}
        </form>

        {result && (
          <section
            aria-label="Wallet result"
            className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8"
          >
            <p className="font-mono text-xs break-all text-bone-dim">
              {result.address}
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  BNB balance
                </dt>
                <dd className="mt-1 font-mono text-sm text-[var(--ink)]">
                  {result.bnb === null
                    ? "Unknown"
                    : formatAmount(result.bnb, 18, "BNB")}
                </dd>
              </div>
              <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  Known tokens checked
                </dt>
                <dd className="mt-1 font-mono text-sm text-[var(--ink)]">
                  {result.checkedTokens}
                </dd>
              </div>
              <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  Known hauntings found
                </dt>
                <dd className="mt-1 font-mono text-sm text-[var(--ink)]">
                  {result.holdings.length}
                </dd>
              </div>
            </dl>
            {result.holdings.length === 0 ? (
              <p className="mt-5 max-w-[65ch] leading-relaxed text-bone">
                None of the known haunted tokens were found in this
                wallet. That is all this check can say: it only knows
                the {result.checkedTokens} tokens this site has filed,
                and it cannot see anything else the wallet holds.
              </p>
            ) : (
              <ul className="mt-5 space-y-3">
                {result.holdings.map((h) => (
                  <li
                    key={h.address}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-haunt-border bg-haunt-panel px-4 py-3"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-bone">
                        {h.label}
                      </span>
                      <span className="mt-0.5 block font-mono text-xs text-bone-dim">
                        {shortAddress(h.address)} · holds{" "}
                        {formatAmount(h.balance, h.decimals, h.label)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-mono font-semibold text-bone tabular-nums">
                        {h.score}
                      </span>
                      <span
                        className="text-sm"
                        style={{ color: BAND_COLOR[h.band] ?? "#a78bfa" }}
                      >
                        {h.band}
                      </span>
                      <Link
                        href={`/scan/${h.address}`}
                        className="text-sm font-medium text-spectral hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
                      >
                        Open the scan
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-bone-dim">
              <TriangleAlert
                size={14}
                strokeWidth={1.5}
                className="mt-0.5 shrink-0"
                aria-hidden
              />
              This is not a wallet audit. SpectreScan is not an audit.
              Never invest more than you can afford to lose.
            </p>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
