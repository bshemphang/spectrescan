// SpectreScan — the scan ritual: the scan shown as an agent run.
// Terminal lines appear one at a time while the engine works, each
// line naming a real step the engine performs (spec load, Sourcify,
// Dexscreener, RPC reads, evidence weighing, verdict). The lines are
// timed, not streamed from the server, because the engine does not
// stream progress: the note underneath says so in plain words.

"use client";

import { useEffect, useState } from "react";

const LINES = [
  "$ spectre run --chain 56",
  "> spec loaded: 9 checks, R1 to R9",
  "> sourcify: fetching verified source",
  "> dexscreener: fetching pairs and liquidity",
  "> rpc: eth_getCode, then name, symbol, decimals, totalSupply",
  "> rpc: eth_blockNumber and Transfer logs, last 20,000 blocks",
  "> weighing evidence: fixed weights, critical 75, high 50, medium 12",
  "> writing the ghost's verdict",
];

export default function TerminalRun({ address }: { address: string }) {
  const [shown, setShown] = useState(1);

  useEffect(() => {
    const id = window.setInterval(() => {
      setShown((s) => Math.min(s + 1, LINES.length));
    }, 950);
    return () => window.clearInterval(id);
  }, []);

  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div className="mx-auto mt-8 max-w-2xl" aria-live="polite">
      <div className="overflow-hidden rounded-xl border border-haunt-border bg-[#0a0810] shadow-[0_0_60px_rgba(139,92,246,0.12)]">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-blood/70" />
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-ember/70" />
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-ectoplasm/70" />
          <span className="ml-2 font-mono text-xs text-bone-dim">
            spectre run {short}
          </span>
        </div>
        <ol className="space-y-2 px-4 py-4 font-mono text-[13px] leading-relaxed">
          {LINES.slice(0, shown).map((line, i) => {
            const current = i === shown - 1 && shown < LINES.length;
            return (
              <li
                key={line}
                className={`terminal-line ${i === 0 ? "text-spectral" : "text-bone"}`}
              >
                {line}
                {current && (
                  <span
                    aria-hidden
                    className="terminal-cursor ml-1 inline-block h-3.5 w-2 translate-y-0.5 bg-spectral"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <p className="mt-3 text-center text-xs text-bone-dim">
        Agent run log. The lines are timed, the engine does not stream
        progress. A full scan usually takes about 35 seconds.
      </p>
    </div>
  );
}
