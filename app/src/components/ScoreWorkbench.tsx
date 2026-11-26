// SpectreScan — the scoring workbench: the deterministic scorer you
// can touch. Pick findings and the score is computed live by the real
// scoring functions (scoreFindings and bandFor from the engine), the
// same ones that score every live scan. Every row is a real finding
// the engine can emit, with its real severity and weight. Shuffle the
// order and the score does not move: same findings, same score, every
// time. That is the property the property tests prove.

"use client";

import { useMemo, useState } from "react";
import { Shuffle } from "lucide-react";
import { bandFor, scoreFindings, weightFor } from "@/lib/engine/scoring";
import type { Finding, Severity } from "@/lib/engine/types";

interface Row {
  id: string;
  severity: Severity;
  title: string;
  note: string;
}

const ROWS: Row[] = [
  {
    id: "deployer-mint",
    severity: "high",
    title: "Deployer minted the entire supply at launch",
    note: "SELO, DigitalToken.sol:22",
  },
  {
    id: "trading-gate",
    severity: "high",
    title: "Owner-controlled trading switch",
    note: "AGIO, AGIOToken.sol:24",
  },
  {
    id: "hidden-owner",
    severity: "high",
    title: "Owner is an unverified smart contract",
    note: "The controller hides behind another layer",
  },
  {
    id: "holders-outside-pool",
    severity: "medium",
    title: "Only a small share of supply sits in the pool",
    note: "Pair-share proxy, Dexscreener pair data",
  },
  {
    id: "unverified",
    severity: "medium",
    title: "Contract source not verified",
    note: "Sourcify found no match",
  },
  {
    id: "no-pair",
    severity: "medium",
    title: "No trading pair, no liquidity",
    note: "Dexscreener found no pairs",
  },
  {
    id: "mintable-governed",
    severity: "medium",
    title: "Mintable, governed by a verified contract",
    note: "CAKE, CakeToken.sol:746. High with a wallet owner, medium here",
  },
  {
    id: "verified-partial",
    severity: "low",
    title: "Source code partially verified",
    note: "Only part of the source matches the bytecode",
  },
  {
    id: "owner-unknown",
    severity: "info",
    title: "No owner() function found",
    note: "Weight 0. An info finding never moves the score",
  },
];

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "#f26d6d",
  high: "#f0a35e",
  medium: "#e8c85a",
  low: "#a78bfa",
  info: "#7fe0b2",
};

const BAND_COLOR: Record<string, string> = {
  "Resting in peace": "#7fe0b2",
  "Mildly haunted": "#a78bfa",
  Haunted: "#f0a35e",
  Possessed: "#f26d6d",
};

function toFinding(row: Row): Finding {
  return {
    id: row.id,
    check: "workbench",
    severity: row.severity,
    title: row.title,
    detail: row.note,
    evidence: [],
    weight: weightFor(row.severity),
  };
}

export default function ScoreWorkbench() {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(["deployer-mint", "no-pair"]),
  );
  const [order, setOrder] = useState<string[]>(ROWS.map((r) => r.id));
  const [shuffled, setShuffled] = useState(false);

  const picked = useMemo(
    () =>
      order
        .map((id) => ROWS.find((r) => r.id === id))
        .filter((r): r is Row => r !== undefined && selected.has(r.id))
        .map(toFinding),
    [order, selected],
  );
  const score = scoreFindings(picked);
  const band = bandFor(score);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function shuffle() {
    setOrder((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
    setShuffled(true);
  }

  return (
    <div className="rounded-2xl border border-haunt-border bg-haunt-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-bone">
          Try the scorer
        </h3>
        <p className="font-mono text-xs text-bone-dim">
          weights: critical 75, high 50, medium 12, low 5, info 0
        </p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-bone-dim">
        Pick findings. The score is the sum of fixed weights, computed by
        the same functions that score a live scan. Shuffle the order and
        the score does not move.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_220px]">
        <ul className="space-y-2">
          {order.map((id) => {
            const row = ROWS.find((r) => r.id === id);
            if (!row) return null;
            const color = SEVERITY_COLOR[row.severity];
            const on = selected.has(row.id);
            return (
              <li key={row.id}>
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-[background-color,border-color] ${
                    on
                      ? "border-white/25 bg-white/[0.05]"
                      : "border-white/10 bg-transparent hover:border-white/20"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(row.id)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#a78bfa]"
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-sm text-bone">
                      {row.title}
                      <span
                        className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                        style={{
                          backgroundColor: `${color}33`,
                          borderColor: `${color}55`,
                          color,
                        }}
                      >
                        {row.severity} +{weightFor(row.severity)}
                      </span>
                    </span>
                    <span className="mt-0.5 block font-mono text-xs text-bone-dim">
                      {row.note}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center">
          <span className="font-mono text-xs tracking-wide text-bone-dim">
            SCORE
          </span>
          <span className="mt-1 font-display text-6xl font-semibold tabular-nums text-bone">
            {score}
          </span>
          <span
            className="mt-1 text-sm font-semibold"
            style={{ color: BAND_COLOR[band] }}
          >
            {band}
          </span>
          <span className="mt-2 font-mono text-xs text-bone-dim">
            {picked.length} {picked.length === 1 ? "finding" : "findings"}{" "}
            selected
          </span>
          <button
            type="button"
            onClick={shuffle}
            className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 px-3 text-xs font-medium text-bone transition-[background-color,border-color] hover:border-white/30 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
          >
            <Shuffle size={13} strokeWidth={1.5} aria-hidden />
            Shuffle order
          </button>
          {shuffled && (
            <p role="status" className="mt-2 text-xs text-bone-dim">
              Order shuffled. Same findings, same score.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
