"use client";

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
//
// Color fix (2026-11-26): the old fills were 0.10 to 0.16 alpha over
// a near-black background, so every bubble read as the same dark
// disc and only a thin stroke carried the category color, while the
// legend showed solid dots. Fills are now solid. Each category also
// has a second cue that is not color: the first minter gets a double
// ring, the pair a dashed stroke, the burn a dotted stroke, and each
// special bubble a letter badge. The legend draws the same fill,
// stroke and dash as the bubbles, so legend and map always match.
//
// Connecting lines come only from the real Transfer logs: the top 8
// biggest moves, drawn only where both ends are shown bubbles.
// Clicking a bubble opens a detail panel with real data only:
// address, category, share, net movement, totals, transfer count,
// a BscScan link, a copy button, and labelled web-search links.
// On-chain addresses carry no X or Telegram links, so the panel
// never invents one; it says so plainly.

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Search, X } from "lucide-react";
import type { DossierData } from "../lib/engine/types";
import { BURN_ADDRESSES } from "../lib/engine/fetchers";
import { formatAmount, formatShare, shortAddress } from "../lib/format";

const BURN_SET = new Set(BURN_ADDRESSES.map((a) => a.toLowerCase()));

type Kind = "minter" | "contract" | "pair" | "burn" | "holder";

const KIND_STYLE: Record<
  Kind,
  {
    fill: string;
    stroke: string;
    strokeWidth: number;
    dash: string | undefined;
    ring: boolean; // second outer ring, the minter's extra cue
    text: string; // text color on the solid fill
    label: string;
    badge: string | null; // letter badge inside big enough bubbles
    blurb: string; // plain-English meaning for the legend
  }
> = {
  minter: {
    fill: "#a78bfa",
    stroke: "#7c5cf0",
    strokeWidth: 3,
    dash: undefined,
    ring: true,
    text: "#17112a",
    label: "first minter",
    badge: "M",
    blurb: "the wallet that first received new tokens",
  },
  contract: {
    fill: "#34d399",
    stroke: "#059669",
    strokeWidth: 2.5,
    dash: undefined,
    ring: false,
    text: "#06281c",
    label: "contract",
    badge: "C",
    blurb: "the token contract itself",
  },
  pair: {
    fill: "#fbbf24",
    stroke: "#b45309",
    strokeWidth: 2.5,
    dash: "7 4",
    ring: false,
    text: "#2b1d05",
    label: "pair",
    badge: "P",
    blurb: "the trading pool where people buy and sell",
  },
  burn: {
    fill: "#6b7280",
    stroke: "#374151",
    strokeWidth: 2.5,
    dash: "2 4",
    ring: false,
    text: "#f2f0ea",
    label: "burn",
    badge: "B",
    blurb: "tokens sent to an address nobody can spend from",
  },
  holder: {
    fill: "#475569",
    stroke: "#94a3b8",
    strokeWidth: 1.5,
    dash: undefined,
    ring: false,
    text: "#f2f0ea",
    label: "",
    badge: null,
    blurb: "a wallet holding the token",
  },
};

interface Bubble {
  x: number;
  y: number;
  r: number;
  address: string;
  share: number | null;
  kind: Kind;
}

export interface MapEdge {
  from: Bubble;
  to: Bubble;
  value: string;
}

// Edges for the map: the biggest moves, but only where both ends
// are shown bubbles. Self transfers are skipped. At most 8, so the
// map never turns into spaghetti. Pure, so it is unit-testable.
export function visibleEdges(
  bubbles: Bubble[],
  moves: Array<{ from: string; to: string; value: string }>,
): MapEdge[] {
  const byAddress = new Map(
    bubbles.map((b) => [b.address.toLowerCase(), b]),
  );
  const edges: MapEdge[] = [];
  for (const m of moves) {
    if (edges.length >= 8) break;
    const from = byAddress.get(m.from.toLowerCase());
    const to = byAddress.get(m.to.toLowerCase());
    if (!from || !to) continue;
    if (from.address.toLowerCase() === to.address.toLowerCase()) continue;
    edges.push({ from, to, value: m.value });
  }
  return edges;
}

// Round to 0.01px: pack() does float math whose last bits can
// differ between the server and client JS engines, and React
// hydration fails on the mismatch. Two decimals is far more
// precision than a bubble position needs.
const round2 = (v: number) => Math.round(v * 100) / 100;

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
    placed.push({
      x: round2(x),
      y: round2(y),
      r: round2(r),
      address: item.address,
      share: item.share,
      kind: item.kind,
    });
  }
  return placed;
}

// One legend swatch: an inline SVG circle drawn with the exact fill,
// stroke and dash of its bubbles, so the legend can never drift from
// the map the way the old solid dots did.
function LegendSwatch({ kind }: { kind: Kind }) {
  const s = KIND_STYLE[kind];
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="shrink-0"
    >
      {s.ring && (
        <circle cx="8" cy="8" r="7" fill="none" stroke={s.stroke} strokeWidth="1" />
      )}
      <circle
        cx="8"
        cy="8"
        r="5.5"
        fill={s.fill}
        stroke={s.stroke}
        strokeWidth="1.5"
        strokeDasharray={s.dash}
      />
    </svg>
  );
}

export default function BubbleMap({
  dossier,
  tokenAddress,
  decimals,
  symbol,
}: {
  dossier: DossierData;
  tokenAddress: string;
  decimals?: number | null;
  symbol?: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [copied, setCopied] = useState<"idle" | "ok" | "failed">("idle");

  // Escape closes the detail panel. Nothing else on the page binds it.
  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

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
        Bigger bubble means more tokens. Lines show tokens moved
        between wallets. Bubbles are sized by net movement in the
        window; the share under each bubble is its share of total
        supply. The window is {windowLabel}, about 17 hours on BSC.
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
    return { ...h, kind };
  });
  const bubbles = pack(items, 600, 380);
  const edges = visibleEdges(bubbles, summary.biggestMoves);
  const shownShare = items.reduce((s, i) => s + (i.share ?? 0), 0);
  const remainder = Math.max(0, 100 - shownShare);
  // formatShare rounds 99.9996% to "100.0%", which reads wrong next
  // to a shown share of 0.0004%. Near 100, print four decimals.
  const remainderLabel =
    remainder > 99.9 ? `${remainder.toFixed(4)}%` : formatShare(remainder);
  const active = hovered ?? selected;
  const selectedEntry = selected
    ? items.find((i) => i.address.toLowerCase() === selected.toLowerCase())
    : undefined;
  const selectedBubble = selected
    ? bubbles.find((b) => b.address.toLowerCase() === selected.toLowerCase())
    : undefined;

  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
    window.setTimeout(() => setCopied("idle"), 2000);
  };

  // Shorten an edge so its arrowhead stops at the target bubble's
  // rim instead of hiding under the bubble. Rounded like pack():
  // raw float endpoints can differ in the last bits between the
  // server and client engines and break hydration.
  const edgeLine = (e: MapEdge) => {
    const dx = e.to.x - e.from.x;
    const dy = e.to.y - e.from.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    return {
      x1: round2(e.from.x),
      y1: round2(e.from.y),
      x2: round2(e.to.x - ux * (e.to.r + 4)),
      y2: round2(e.to.y - uy * (e.to.r + 4)),
    };
  };

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
        aria-label="Bubble map of top holders by net movement in the scanned window. Tap a bubble to see that wallet."
        className="w-full"
      >
        <defs>
          <marker
            id="edge-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(242,240,234,0.35)" />
          </marker>
          <marker
            id="edge-arrow-hot"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
          </marker>
        </defs>
        {edges.map((e) => {
          const line = edgeLine(e);
          const isActive =
            active !== null &&
            (e.from.address.toLowerCase() === active.toLowerCase() ||
              e.to.address.toLowerCase() === active.toLowerCase());
          const dimmed = active !== null && !isActive;
          return (
            <line
              key={`${e.from.address}-${e.to.address}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={isActive ? "var(--accent)" : "rgba(242,240,234,0.35)"}
              strokeWidth={isActive ? 3 : 1.5}
              strokeOpacity={dimmed ? 0.08 : 1}
              markerEnd={isActive ? "url(#edge-arrow-hot)" : "url(#edge-arrow)"}
            >
              <title>
                {`${shortAddress(e.from.address)} sent ${formatAmount(e.value, decimals ?? null, symbol ?? null)} to ${shortAddress(e.to.address)}`}
              </title>
            </line>
          );
        })}
        {bubbles.map((b) => {
          const style = KIND_STYLE[b.kind];
          const isSelected =
            selected !== null &&
            b.address.toLowerCase() === selected.toLowerCase();
          // The accent ring is the focus indicator: the global
          // :focus-visible outline would draw a white rectangle
          // around the bubble's bounding box, so the bubble group
          // suppresses it (style below) and shows this ring on
          // hover and keyboard focus instead.
          const isHighlighted =
            isSelected ||
            (hovered !== null &&
              b.address.toLowerCase() === hovered.toLowerCase());
          const isDimmed =
            active !== null &&
            b.address.toLowerCase() !== active.toLowerCase() &&
            !edges.some(
              (e) =>
                (e.from.address.toLowerCase() === active.toLowerCase() ||
                  e.to.address.toLowerCase() === active.toLowerCase()) &&
                (e.from.address.toLowerCase() === b.address.toLowerCase() ||
                  e.to.address.toLowerCase() === b.address.toLowerCase()),
            );
          const ariaName = `${style.label || "holder"} ${shortAddress(b.address)}, ${formatShare(b.share)} of supply. Press Enter for details.`;
          return (
            <g
              key={b.address}
              tabIndex={0}
              role="button"
              aria-label={ariaName}
              style={{
                cursor: "pointer",
                opacity: isDimmed ? 0.35 : 1,
                outline: "none",
              }}
              onClick={() => {
                setSelected(isSelected ? null : b.address);
                setCopied("idle");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(isSelected ? null : b.address);
                  setCopied("idle");
                }
              }}
              onMouseEnter={() => setHovered(b.address)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(b.address)}
              onBlur={() => setHovered(null)}
            >
              <title>{ariaName}</title>
              {style.ring && (
                <circle
                  cx={b.x}
                  cy={b.y}
                  r={b.r + 5}
                  fill="none"
                  stroke={style.stroke}
                  strokeWidth={1}
                />
              )}
              {isHighlighted && (
                <circle
                  cx={b.x}
                  cy={b.y}
                  r={b.r + 4}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={2}
                />
              )}
              <circle
                cx={b.x}
                cy={b.y}
                r={b.r}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                strokeDasharray={style.dash}
              />
              {style.badge && b.r >= 30 && (
                <g>
                  <circle
                    cx={b.x}
                    cy={b.y - b.r + 11}
                    r={8}
                    fill="#0c0a12"
                    stroke={style.stroke}
                    strokeWidth={1}
                  />
                  <text
                    x={b.x}
                    y={b.y - b.r + 14.5}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={700}
                    fill={style.fill}
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {style.badge}
                  </text>
                </g>
              )}
              <text
                x={b.x}
                y={b.y - 2}
                textAnchor="middle"
                fontSize={b.r > 40 ? 13 : 11}
                fill={style.text}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {formatShare(b.share)}
              </text>
              <text
                x={b.x}
                y={b.y + 13}
                textAnchor="middle"
                fontSize={10}
                fill={style.text}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {shortAddress(b.address)}
              </text>
              {style.label && (
                <text
                  x={b.x}
                  y={b.y + 26}
                  textAnchor="middle"
                  fontSize={9}
                  // Inside the bubble for r >= 26, so it takes the
                  // on-fill text color; for the smallest bubbles it
                  // sits just below the rim on the dark background,
                  // so it stays muted there.
                  fill={b.r >= 26 ? style.text : "var(--muted)"}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {style.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[var(--muted)]">
        {(["minter", "contract", "pair", "burn", "holder"] as Kind[]).map(
          (k) => (
            <span key={k} className="inline-flex items-start gap-1.5">
              <LegendSwatch kind={k} />
              <span className="font-mono leading-tight">
                {KIND_STYLE[k].label || "holder"}
                <span className="block text-[var(--muted)]">
                  {KIND_STYLE[k].blurb}
                </span>
              </span>
            </span>
          ),
        )}
      </div>

      {selectedEntry && selectedBubble && (
        <div
          role="region"
          aria-label="Wallet details"
          className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <LegendSwatch kind={selectedEntry.kind} />
              <p className="font-mono text-sm text-[var(--ink)]">
                {KIND_STYLE[selectedEntry.kind].label || "holder"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close wallet details"
              className="rounded-md border border-[var(--line)] p-1.5 text-[var(--muted)] hover:text-[var(--ink)]"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {KIND_STYLE[selectedEntry.kind].blurb}. Numbers cover the
            scanned window only.
          </p>
          <p className="mt-3 break-all font-mono text-sm text-[var(--ink)]">
            {selectedEntry.address}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                Share of supply
              </p>
              <p className="mt-0.5 font-mono text-sm text-[var(--ink)]">
                {formatShare(selectedEntry.share)}
              </p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                Net movement
              </p>
              <p className="mt-0.5 font-mono text-sm text-[var(--ink)]">
                {formatAmount(
                  selectedEntry.netBalance,
                  decimals ?? null,
                  symbol ?? null,
                )}
              </p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                Transfers in window
              </p>
              <p className="mt-0.5 font-mono text-sm text-[var(--ink)]">
                {selectedEntry.transfers}
              </p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                Total received
              </p>
              <p className="mt-0.5 font-mono text-sm text-[var(--ink)]">
                {formatAmount(
                  selectedEntry.totalReceived,
                  decimals ?? null,
                  symbol ?? null,
                )}
              </p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                Total sent
              </p>
              <p className="mt-0.5 font-mono text-sm text-[var(--ink)]">
                {formatAmount(
                  selectedEntry.totalSent,
                  decimals ?? null,
                  symbol ?? null,
                )}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copyAddress(selectedEntry.address)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] px-3 py-2 font-mono text-xs text-[var(--ink)] hover:border-[var(--accent)]"
            >
              {copied === "ok" ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <Copy size={14} aria-hidden="true" />
              )}
              {copied === "ok"
                ? "Copied"
                : copied === "failed"
                  ? "Copy did not work"
                  : "Copy address"}
            </button>
            <a
              href={`https://bscscan.com/address/${selectedEntry.address}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] px-3 py-2 font-mono text-xs text-[var(--ink)] hover:border-[var(--accent)]"
            >
              <ExternalLink size={14} aria-hidden="true" />
              View on BscScan
            </a>
            <a
              href={`https://x.com/search?q=${encodeURIComponent(selectedEntry.address)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] px-3 py-2 font-mono text-xs text-[var(--ink)] hover:border-[var(--accent)]"
            >
              <Search size={14} aria-hidden="true" />
              Search this address on X
            </a>
            <a
              href={`https://duckduckgo.com/?q=${encodeURIComponent(`"${selectedEntry.address}" telegram`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] px-3 py-2 font-mono text-xs text-[var(--ink)] hover:border-[var(--accent)]"
            >
              <Search size={14} aria-hidden="true" />
              Search on Telegram (web search)
            </a>
          </div>
          <p className="mt-3 font-mono text-xs leading-relaxed text-[var(--muted)]">
            No social links found on-chain for this address. The search
            links above look the address up on the public web. They are
            not verified profiles, and anyone can mention an address.
          </p>
        </div>
      )}

      <p className="mt-3 font-mono text-xs leading-relaxed text-[var(--muted)]">
        Top {items.length} holders shown, {formatShare(shownShare)} of
        supply. The remaining {remainderLabel} did not move in the
        scanned window or sits with smaller holders. This is movement,
        not lifetime holdings: an address that bought before the window
        and held still shows nothing here. Lines show the biggest moves
        between the wallets above. A line is movement, not proof of
        anything wrong.
      </p>
    </section>
  );
}
