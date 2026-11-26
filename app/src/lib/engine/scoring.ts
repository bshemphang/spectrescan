// SpectreScan rules engine — deterministic scoring (spec REQ-4).
// The score is a sum of fixed, non-negative severity weights, so:
//  - adding a finding can NEVER lower the score (monotonic),
//  - the same findings ALWAYS produce the same score (deterministic),
//  - no findings → 0.

import type { Finding, RiskBand, Severity } from "./types";

export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 40,
  high: 25,
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
  if (score <= 24) return "Resting in peace";
  if (score <= 49) return "Mildly haunted";
  if (score <= 74) return "Haunted";
  return "Possessed — do not touch";
}
