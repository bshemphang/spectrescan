// SpectreScan — ghost meter: an SVG arc dial for the 0–100 risk score.
// Colour follows the band: green (resting) → violet (mild) → amber
// (haunted) → red (possessed). The arc draws itself on load via a CSS
// animation (see .meter-arc in globals.css): no JS state, so the arc
// still draws if hydration fails, and the stroke-dashoffset attribute
// already holds the final value, so no-JS and reduced-motion both render
// the finished arc.

"use client";

import type { CSSProperties } from "react";
import type { RiskBand } from "@/lib/engine/types";

const BAND_COLOR: Record<RiskBand, string> = {
  "Resting in peace": "#7fe0b2",
  "Mildly haunted": "#a78bfa",
  Haunted: "#f0a35e",
  "Possessed": "#f26d6d",
};

export default function GhostMeter({
  score,
  band,
}: {
  score: number;
  band: RiskBand;
}) {
  const color = BAND_COLOR[band];
  // Arc: semicircle from 180° to 0°, radius 80, centre (100, 100).
  const r = 80;
  const startAngle = Math.PI; // left
  const frac = Math.max(0, Math.min(1, score / 100));
  const endAngle = Math.PI - frac * Math.PI;
  const x1 = 100 + r * Math.cos(startAngle);
  const y1 = 100 - r * Math.sin(startAngle);
  const x2 = 100 + r * Math.cos(endAngle);
  const y2 = 100 - r * Math.sin(endAngle);
  const largeArc = frac > 0.5 ? 1 : 0;
  const arcPath =
    frac <= 0
      ? ""
      : `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;

  // Draw-in: the CSS animation runs from offset 100 (hidden) to the
  // final offset in --meter-to. The attribute below already holds the
  // final value, so the arc is correct even before the animation runs
  // or if CSS animations are disabled.
  const offset = 100 - frac * 100;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 115" className="w-56 sm:w-64" role="img"
        aria-label={`Risk score ${score} out of 100, ${band}`}>
        {/* track */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#2c2440"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* value arc */}
        {arcPath && (
          <path
            d={arcPath}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={offset}
            className="meter-arc"
            style={{ "--meter-to": offset } as CSSProperties}
          />
        )}
        <text
          x="100"
          y="88"
          textAnchor="middle"
          fill="#f2f0ea"
          fontSize="34"
          fontWeight="600"
          fontFamily="var(--font-fraunces), Georgia, serif"
          className="tabular-nums"
        >
          {score}
        </text>
        <text
          x="100"
          y="108"
          textAnchor="middle"
          fill="#b8b3c4"
          fontSize="12"
          fontFamily="var(--font-inter), system-ui, sans-serif"
        >
          Ectoplasm level / 100
        </text>
      </svg>
      <p
        className="mt-1 font-display text-xl font-semibold sm:text-2xl"
        style={{ color }}
      >
        {band}
      </p>
    </div>
  );
}
