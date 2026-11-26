// SpectreScan — the bubble map: holder distribution as bubbles,
// sized by net movement in the last 20,000 blocks, built from the
// same Transfer-log scan as the transfer flow. The map is honest
// about what it is: net balance change inside the last 20,000 blocks
// (about 17 hours on BSC), not lifetime holdings. An address that
// bought before the window and held still shows nothing here, and
// the card says so. The deployer (first minter), the contract
// itself, and the pair get their own rings. If no logs could be
// read at all, the map says data unavailable. When the scan stopped
// early but collected logs, the map shows what was collected and
// says the window is partial. It never draws a fake map.

import type { DossierData } from "../lib/engine/types";
import { BURN_ADDRESSES } from "../lib/engine/fetchers";
import { formatShare, shortAddress } from "../lib/format";

const BURN_SET = new Set(BURN_ADDRESSES.map((a) => a.toLowerCase()));

type Kind = "minter" | "contract" | "pair" | "burn" | "holder";

const KIND_STYLE: Record<Kind, { stroke: string; label: string; fill: string }> = {
  minter: { stroke: "var(--accent)", label: "first minter", fill: "rgba(167,139,250,0.16)" },
  contract: { stroke: "#34d399", label: "contract", fill: "rgba(52,211,153,0.12)" },
  pair: { stroke: "#fbbf24", label: "pair", fill: "rgba(251,191,36,0.12)" },
  burn: { stroke: "#6b7280", label: "burn", fill: "rgba(107,114,128,0.12)" },
  holder: { stroke: "var(--line)", label: "", fill: "rgba(148,163,184,0.10)" },
};

interface Bubble {
  x: number;
  y: number;
  r: number;
  address: string;
  share: number | null;
  kind: Kind;
}

// Simple spiral packing: largest first at the centre, each next
// bubble walks outward until it clears every placed circle. With at
// most 12 bubbles this converges fast and never overlaps.
// Size by net movement in the window, relative to the largest mover.
// The share of total supply truncates to 0 for large-supply tokens
// (bigint division in the engine), so sizing by share would make
// every bubble the same size, or NaN when the largest share is 0;
// the raw net balance keeps the true proportions. The share shown
// under each bubble is still its share of total supply.
export function pack(
  items: Array<{ address: string; share: number | null; netBalance: string; kind: Kind }>,
  width: number,
  height: number,
): Bubble[] {
  const maxR = 64;
  const minR = 22;
  const sorted = [...items].sort((a, b) => {
    const d = BigInt(b.netBalance) - BigInt(a.netBalance);
    return d > 0n ? 1 : d < 0n ? -1 : 0;
  });
  const maxBal = Math.max(
    ...items.map((i) => Math.max(0, Number(BigInt(i.netBalance)))),
    0,
  );
  const placed: Bubble[] = [];
  const cx = width / 2;
  const cy = height / 2;
  for (const item of sorted) {
    const bal = Math.max(0, Number(BigInt(item.netBalance)));
    const ratio = maxBal > 0 ? bal / maxBal : 0.5;
    const r =
      sorted.length === 1
        ? maxR
        : minR + (maxR - minR) * Math.sqrt(ratio);
    let x = cx;
    let y = cy;
    if (placed.length > 0) {
      let dist = r + placed[0].r + 8;
      let angle = 0;
      let found = false;
      for (let attempt = 0; attempt < 4000 && !found; attempt++) {
        angle = (attempt * 2.399963) % (Math.PI * 2);
        x = cx + Math.cos(angle) * dist;
        y = cy + Math.sin(angle) * dist * 0.82;
        const clear = placed.every((p) => {
          const dx = p.x - x;
          const dy = p.y - y;
          return Math.hypot(dx, dy) >= p.r + r + 6;
        });
        const inside =
          x - r >= 4 && x + r <= width - 4 && y - r >= 4 && y + r <= height - 4;
        if (clear && inside) {
          found = true;
        } else {
          dist += 0.6;
          if (dist > width) {
            x = cx;
            y = cy;
            found = true;
          }
        }
      }
    }
    placed.push({ x, y, r, address: item.address, share: item.share, kind: item.kind });
  }
  return placed;
}

export default function BubbleMap({
  dossier,
  tokenAddress,
}: {
  dossier: DossierData;
  tokenAddress: string;
}) {
  const analysis = dossier.analysis;
  const summary = analysis.summary;
  const windowLabel = analysis.window
    ? `blocks ${analysis.window.fromBlock.toLocaleString()} to ${analysis.window.toBlock.toLocaleString()}`
    : "window unknown";
  const header = (
    <header className="mb-2">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
        Bubble map
      </p>
      <h2 className="font-display text-2xl leading-tight">
        Who moved in the last 20,000 blocks
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Bubbles are sized by net movement in the window; the share under
        each bubble is its share of total supply. The window is{" "}
        {windowLabel}, about 17 hours on BSC.
      </p>
    </header>
  );

  // Partial data still renders: when the log scan stopped early but
  // collected logs, the map shows what was collected and says so.
  // Only a scan with no logs at all hides the map.
  if (!summary || (summary.eventsProcessed === 0 && analysis.logsFailed)) {
    return (
      <section aria-label="Bubble map" className="dossier-card">
        {header}
        <p className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4 font-mono text-sm text-[var(--muted)]">
          Bubble map unavailable: the Transfer-log scan failed, so there
          is no holder data to draw. The scan does not invent holders.
        </p>
      </section>
    );
  }
  if (summary.holders.length === 0) {
    return (
      <section aria-label="Bubble map" className="dossier-card">
        {header}
        <p className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4 font-mono text-sm text-[var(--muted)]">
          No holder movement in the scanned window: no address gained a
          positive net balance in the last 20,000 blocks.
        </p>
      </section>
    );
  }

  const pairAddress = dossier.pair?.pairAddress.toLowerCase() ?? null;
  const firstMinter = summary.firstMinter;
  const items = summary.holders.map((h) => {
    const lower = h.address.toLowerCase();
    const kind: Kind = lower === firstMinter
      ? "minter"
      : lower === tokenAddress.toLowerCase()
        ? "contract"
        : lower === pairAddress
          ? "pair"
          : BURN_SET.has(lower)
            ? "burn"
            : "holder";
    return { address: h.address, share: h.share, netBalance: h.netBalance, kind };
  });
  const bubbles = pack(items, 600, 380);
  const shownShare = items.reduce((s, i) => s + (i.share ?? 0), 0);
  const remainder = Math.max(0, 100 - shownShare);

  return (
    <section aria-label="Bubble map" className="dossier-card">
      {header}
      {!analysis.complete && (
        <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 font-mono text-xs text-amber-200">
          {analysis.logsFailed
            ? "Partial window: the Transfer-log scan stopped early, so these bubbles cover only part of the window."
            : "Partial window: the scan stopped at the event cap, so these bubbles cover only part of the window."}
        </p>
      )}
      <svg
        viewBox="0 0 600 380"
        role="img"
        aria-label="Bubble map of top holders by net movement in the scanned window"
        className="w-full"
      >
        {bubbles.map((b) => {
          const style = KIND_STYLE[b.kind];
          return (
            <g key={b.address}>
              <circle
                cx={b.x}
                cy={b.y}
                r={b.r}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={b.kind === "holder" ? 1 : 2}
              />
              <text
                x={b.x}
                y={b.y - 2}
                textAnchor="middle"
                className="fill-[var(--ink)]"
                fontSize={b.r > 40 ? 13 : 11}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {formatShare(b.share)}
              </text>
              <text
                x={b.x}
                y={b.y + 13}
                textAnchor="middle"
                className="fill-[var(--muted)]"
                fontSize={10}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {shortAddress(b.address)}
              </text>
              {style.label && (
                <text
                  x={b.x}
                  y={b.y + 26}
                  textAnchor="middle"
                  className="fill-[var(--muted)]"
                  fontSize={9}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {style.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-[var(--muted)]">
        <span><span className="text-[var(--accent)]">●</span> first minter</span>
        <span><span className="text-emerald-400">●</span> contract</span>
        <span><span className="text-amber-400">●</span> pair</span>
        <span><span className="text-gray-400">●</span> burn</span>
      </div>
      <p className="mt-3 font-mono text-xs leading-relaxed text-[var(--muted)]">
        Top {items.length} holders shown, {formatShare(shownShare)} of
        supply. The remaining {formatShare(remainder)} did not move in the
        scanned window or sits with smaller holders. This is movement,
        not lifetime holdings: an address that bought before the window
        and held still shows nothing here.
      </p>
    </section>
  );
}
