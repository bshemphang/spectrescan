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
// Legibility fix (2026-11-27): a live all-holders scan showed 12
// identical slate-grey bubbles, every one "<0.0001%", with no minter,
// contract, or pair anywhere. Burn (#6b7280) and holder (#475569)
// were both grey, holders printed no label, absent categories were
// silent, and the share text was identical on every bubble. Burn is
// now charred near-black with an ember-orange dashed stroke, ember
// dots, and a B badge at any size; holder is a real blue with the
// word "holder" printed under every holder bubble; the map says
// plainly which special categories did not move in the window and
// dims their legend entries; every bubble carries its rank by net
// movement (#1 to #12) next to the share, or alone on micro
// bubbles, so two bubbles never look identical.
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
import GhostShape from "./GhostShape";
import type { DossierData } from "../lib/engine/types";
import { BURN_ADDRESSES } from "../lib/engine/fetchers";
import { formatAmount, formatShare, shortAddress } from "../lib/format";

const BURN_SET = new Set(BURN_ADDRESSES.map((a) => a.toLowerCase()));

type Kind = "minter" | "contract" | "pair" | "burn" | "holder";

export const KIND_STYLE: Record<
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
    dots: boolean; // ember dots inside a burn bubble
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
    dots: false,
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
    dots: false,
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
    dots: false,
  },
  burn: {
    fill: "#0c0a12",
    stroke: "#f97316",
    strokeWidth: 2.5,
    dash: "6 3",
    ring: false,
    text: "#f2f0ea",
    label: "burn",
    badge: "B",
    blurb: "tokens sent to an address nobody can spend from",
    dots: true,
  },
  holder: {
    fill: "#3b82f6",
    stroke: "#93c5fd",
    strokeWidth: 1.5,
    dash: undefined,
    ring: false,
    text: "#f2f0ea",
    label: "holder",
    badge: null,
    blurb: "a wallet holding the token",
    dots: false,
  },
};

interface Bubble {
  x: number;
  y: number;
  r: number;
  address: string;
  share: number | null;
  kind: Kind;
  // Rank by net movement in the window, 1 for the biggest mover.
  // pack() assigns it from the sorted order it already uses, so no
  // new data is invented. Optional so test fixtures that build
  // bubbles by hand for visibleEdges keep working.
  rank?: number;
}

export interface MapEdge {
  from: Bubble;
  to: Bubble;
  value: string;
}

// Special categories not among the shown bubbles, for the plain
// "not in this window" note and dimmed legend entries. Holder is
// never absent: every shown bubble that is not special is a holder.
// Pure, so it is unit-testable.
export function absentSpecialKinds(present: Kind[]): Kind[] {
  return (["minter", "contract", "pair", "burn"] as Kind[]).filter(
    (k) => !present.includes(k),
  );
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

// Ghost stops along an edge: small friendly ghosts spaced along
// the transfer path, facing the direction of flow. Count scales
// with length, 2 to 4, so short hops get 2 ghosts and long hauls
// get 4, never more. Positions are rounded like pack() so hydration
// cannot differ in the last bits. Pure, so it is unit-testable.
export interface GhostStop {
  x: number;
  y: number;
  angle: number;
}

export function ghostStops(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): GhostStop[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return [{ x: round2(x1), y: round2(y1), angle: 0 }];
  const n = Math.min(4, Math.max(2, Math.round(len / 90)));
  const angle = round2((Math.atan2(dy, dx) * 180) / Math.PI);
  const stops: GhostStop[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    stops.push({
      x: round2(x1 + dx * t),
      y: round2(y1 + dy * t),
      angle,
    });
  }
  return stops;
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
  items: Array<{ address: string; share: number | null; netBalance: string; kind: Kind; rank?: number }>,
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
      // A rank passed in (from the full set, before any category
      // filter) is kept, so filtering never renumbers the bubbles:
      // #1 stays #1 even when only holders are shown. Without one,
      // the position in the placed list is the rank by net movement.
      rank: item.rank ?? placed.length + 1,
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
      {s.dots && (
        <g fill="#f97316">
          <circle cx="5.5" cy="6" r="1" />
          <circle cx="10.5" cy="6.5" r="1" />
          <circle cx="8" cy="10.5" r="1" />
        </g>
      )}
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
  // Category filter: null means show everything. A set means show
  // only those kinds. There is no dev-wallet category: the engine
  // cannot identify the deployer from the data it fetches, so the
  // first minter is the closest match and is already a category.
  const [filter, setFilter] = useState<Set<Kind> | null>(null);

  function toggleKind(kind: Kind) {
    setSelected(null);
    setCopied("idle");
    setFilter((prev) => {
      if (prev === null) return new Set([kind]);
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      if (next.size === 0 || next.size === 5) return null;
      return next;
    });
  }

  // Escape closes the detail panel. Nothing else on the page binds it.
  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  // The ghost back-to-top button hides while this panel is open, so
  // it never covers the panel on a phone. It reads this attribute.
  useEffect(() => {
    document.body.dataset.panelOpen = selected !== null ? "true" : "false";
    return () => {
      document.body.dataset.panelOpen = "false";
    };
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
      <h2 className="font-haunt text-2xl leading-tight">
        Who moved in the last 20,000 blocks
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Bigger bubble means more tokens. Little ghosts show tokens
        moved between wallets. Bubbles are sized by net movement in
        the window; the share under each bubble is its share of total
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
  // Ranks are fixed on the full set before any filter, with the
  // same comparator pack() uses, so a filtered view never
  // renumbers: #1 stays #1 when only holders are shown.
  const rankedItems = [...items]
    .sort((a, b) => {
      const d = BigInt(b.netBalance) - BigInt(a.netBalance);
      return d > 0n ? 1 : d < 0n ? -1 : 0;
    })
    .map((item, i) => ({ ...item, rank: i + 1 }));
  const shownItems =
    filter === null
      ? rankedItems
      : rankedItems.filter((i) => filter.has(i.kind));
  const bubbles = pack(shownItems, 600, 380);
  const edges = visibleEdges(bubbles, summary.biggestMoves);
  // Special categories that are not among the shown bubbles. The map
  // says so plainly instead of leaving the user hunting for purple,
  // green, yellow, or ember that is not there. Holder is never
  // absent: every shown bubble that is not special is a holder.
  // Absence is judged on the full set, never on a filtered view:
  // hiding holders with the filter must not claim the minter is
  // missing from the window.
  const absentSpecial = absentSpecialKinds(rankedItems.map((b) => b.kind));
  const shownShare = shownItems.reduce((s, i) => s + (i.share ?? 0), 0);
  // The remainder is always judged on the full set, never on a
  // filtered view: hiding bubbles with the filter must not inflate
  // the "did not move" share.
  const fullShare = items.reduce((s, i) => s + (i.share ?? 0), 0);
  const remainder = Math.max(0, 100 - fullShare);
  // formatShare rounds 99.9996% to "100.0%", which reads wrong next
  // to a shown share of 0.0004%. Near 100, print four decimals.
  const remainderLabel =
    remainder > 99.9 ? `${remainder.toFixed(4)}%` : formatShare(remainder);
  // Same rounding trap as the remainder: formatShare prints 1
  // decimal over 10, so a shown 99.9% next to a 0.14% remainder
  // summed to 100.04%. Over 99, print four decimals for both.
  const shownLabel =
    shownShare > 99 ? `${shownShare.toFixed(4)}%` : formatShare(shownShare);
  const active = hovered ?? selected;
  const selectedEntry = selected
    ? rankedItems.find((i) => i.address.toLowerCase() === selected.toLowerCase())
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
      {filter === null && absentSpecial.length > 0 && (
        <p className="mb-3 font-mono text-xs leading-relaxed text-[var(--muted)]">
          No {absentSpecial.map((k) => KIND_STYLE[k].label).join(", ")}{" "}
          moved in this window, so those colors are not on this map.
        </p>
      )}
      {/* Category filter: show only the kinds picked. Chips carry a
          count, kinds missing from the window are disabled, and the
          active chip glows ember on a violet border. Ranks never
          renumber: they are fixed on the full set. */}
      <div
        className="mb-3 flex flex-wrap gap-2"
        role="group"
        aria-label="Show only these kinds of wallets"
      >
        <button
          type="button"
          onClick={() => {
            setFilter(null);
            setSelected(null);
          }}
          aria-pressed={filter === null}
          className={`rounded-full border px-3 py-1.5 font-mono text-xs transition-[border-color,color,box-shadow] ${
            filter === null
              ? "border-spectral text-ember shadow-[0_0_16px_rgba(240,163,94,0.35)]"
              : "border-white/15 text-bone-dim hover:border-white/30 hover:text-bone"
          }`}
        >
          All ({items.length})
        </button>
        {(["minter", "contract", "pair", "burn", "holder"] as Kind[]).map(
          (k) => {
            const count = items.filter((i) => i.kind === k).length;
            const active = filter !== null && filter.has(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleKind(k)}
                disabled={count === 0}
                aria-pressed={active}
                title={
                  count === 0
                    ? `${KIND_STYLE[k].label} did not move in this window`
                    : `Show only ${KIND_STYLE[k].label}`
                }
                className={`rounded-full border px-3 py-1.5 font-mono text-xs transition-[border-color,color,box-shadow] disabled:cursor-not-allowed disabled:opacity-40 ${
                  active
                    ? "border-spectral text-ember shadow-[0_0_16px_rgba(240,163,94,0.35)]"
                    : "border-white/15 text-bone-dim hover:border-white/30 hover:text-bone"
                }`}
              >
                {KIND_STYLE[k].label} ({count})
              </button>
            );
          },
        )}
      </div>
      {filter !== null && (
        <p className="mb-3 font-mono text-xs leading-relaxed text-[var(--muted)]">
          Showing only{" "}
          {[...filter].map((k) => KIND_STYLE[k].label).join(", ")}:{" "}
          {shownItems.length} of {items.length} bubbles. Ranks are from
          the full set, so #1 stays #1.
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
          const stops = ghostStops(line.x1, line.y1, line.x2, line.y2);
          const isActive =
            active !== null &&
            (e.from.address.toLowerCase() === active.toLowerCase() ||
              e.to.address.toLowerCase() === active.toLowerCase());
          const dimmed = active !== null && !isActive;
          // Ghosts drift along the path instead of a plain line: a
          // faint dotted trail, 2 to 4 little ghosts facing the flow,
          // and the arrowhead at the end so direction stays readable.
          // Idle ghosts are faint; the active edge brightens them.
          return (
            <g
              key={`${e.from.address}-${e.to.address}`}
              opacity={dimmed ? 0.08 : 1}
            >
              <line
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={isActive ? "var(--accent)" : "rgba(242,240,234,0.35)"}
                strokeWidth={isActive ? 3 : 2}
                strokeDasharray="0.1 7"
                strokeLinecap="round"
                markerEnd={
                  isActive ? "url(#edge-arrow-hot)" : "url(#edge-arrow)"
                }
              >
                <title>
                  {`${shortAddress(e.from.address)} sent ${formatAmount(e.value, decimals ?? null, symbol ?? null)} to ${shortAddress(e.to.address)}`}
                </title>
              </line>
              {stops.map((s, i) => (
                <g
                  key={i}
                  transform={`translate(${s.x} ${s.y}) rotate(${s.angle}) scale(0.75) translate(-12 -12)`}
                  style={{
                    color: isActive ? "#c4b5fd" : "#f2f0ea",
                    opacity: isActive ? 0.95 : 0.6,
                  }}
                >
                  <GhostShape />
                </g>
              ))}
            </g>
          );
        })}
        {bubbles.map((b, idx) => {
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
          const ariaName = `#${b.rank ?? idx + 1} ${style.label} ${shortAddress(b.address)}, ${formatShare(b.share)} of supply. Press Enter for details.`;
          return (
            <g
              key={b.address}
              tabIndex={0}
              role="button"
              aria-label={ariaName}
              className="ghost-bob"
              style={{
                opacity: isDimmed ? 0.35 : 1,
                outline: "none",
                // Staggered bob so the orbs drift out of step.
                // Deterministic from the index, so server and client
                // render the same delay and hydration stays clean.
                animationDelay: `${(idx % 6) * 0.6}s`,
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
              {/* Soft halo: the ghost-orb glow, low opacity so it
                  never fights the bubble itself. */}
              <circle
                cx={b.x}
                cy={b.y}
                r={b.r + 7}
                fill={style.fill}
                opacity={0.1}
              />
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
              {style.dots && (
                <g fill="#f97316" opacity={0.9}>
                  <circle
                    cx={b.x - b.r * 0.5}
                    cy={b.y - b.r * 0.35}
                    r={2.2}
                  />
                  <circle
                    cx={b.x + b.r * 0.45}
                    cy={b.y - b.r * 0.4}
                    r={2.2}
                  />
                  <circle
                    cx={b.x + b.r * 0.45}
                    cy={b.y + b.r * 0.5}
                    r={2.2}
                  />
                </g>
              )}
              {style.badge && (
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
                fontWeight={b.r < 38 ? 700 : undefined}
                fill={style.text}
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {b.r >= 38
                  ? `#${b.rank ?? idx + 1} ${formatShare(b.share)}`
                  : `#${b.rank ?? idx + 1}`}
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
          (k) => {
            const absent = k !== "holder" && absentSpecial.includes(k);
            return (
              <span
                key={k}
                className="inline-flex items-start gap-1.5"
                style={absent ? { opacity: 0.45 } : undefined}
              >
                <LegendSwatch kind={k} />
                <span className="font-mono leading-tight">
                  {KIND_STYLE[k].label}
                  {absent && (
                    <span className="block text-[var(--muted)]">
                      not in this window
                    </span>
                  )}
                  <span className="block text-[var(--muted)]">
                    {KIND_STYLE[k].blurb}
                  </span>
                </span>
              </span>
            );
          },
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
                Rank in window
              </p>
              <p className="mt-0.5 font-mono text-sm text-[var(--ink)]">
                #{selectedBubble?.rank ?? "?"}
              </p>
            </div>
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

      <p
        data-ghost-hide
        className="mt-3 font-mono text-xs leading-relaxed text-[var(--muted)]"
      >
        {filter === null ? (
          <>
            Top {items.length} holders shown, {shownLabel} of supply. The
            remaining {remainderLabel} did not move in the scanned
            window or sits with smaller holders.
          </>
        ) : (
          <>
            Showing {shownItems.length} of {items.length} bubbles,{" "}
            {shownLabel} of supply. The remaining {remainderLabel} did
            not move in the scanned window or sits with smaller
            holders.
          </>
        )}{" "}
        This is movement, not lifetime holdings: an address that bought
        before the window and held still shows nothing here. Little
        ghosts show the biggest moves between the wallets above. A
        ghost is movement, not proof of anything wrong.
      </p>
    </section>
  );
}
