// SpectreScan rules engine — deterministic scoring (spec REQ-4).
// The score is a sum of fixed, non-negative severity weights, so:
//  - adding a finding can NEVER lower the score (monotonic),
//  - the same findings ALWAYS produce the same score (deterministic),
//  - no findings → 0.
//
// The weights are calibrated so a single finding of the top severities
// lands where it should: one Critical alone reaches Possessed (75+),
// one High alone reaches Haunted (50+). A backdoor must never read as
// "mildly scary". Medium and low stay small so a clean token that
// accumulates a few mediums (e.g. CAKE: mintable + V3-unverified +
// holders-outside-pool) still reads Mildly haunted, not Haunted.
//
// The bands are drawn so "Resting in peace" means at most one
// medium-strength signal and nothing else: two medium findings (24)
// already read Mildly haunted, because two real risk signals are never
// "resting". A single medium alone (12) is the edge of Resting.

import type { Finding, RiskBand, Severity } from "./types";

export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 75,
  high: 50,
  medium: 12,
  low: 5,
  info: 0,
};

export function weightFor(severity: Severity): number {
  return SEVERITY_WEIGHTS[severity];
}

export function scoreFindings(findings: Finding[]): number {
  const total = findings.reduce((sum, f) => sum + f.weight, 0);
  return Math.min(100, Math.max(0, total));
}

export function bandFor(score: number): RiskBand {
  if (score <= 12) return "Resting in peace";
  if (score <= 49) return "Mildly haunted";
  if (score <= 74) return "Haunted";
  return "Possessed";
}
