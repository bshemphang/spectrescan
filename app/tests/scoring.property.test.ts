// SpectreScan — property tests for the deterministic scorer (spec REQ-4, REQ-9).
// Proves with fast-check: score ∈ [0,100], determinism, monotonicity,
// and empty findings → 0.

import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { bandFor, scoreFindings, weightFor } from "../src/lib/engine/scoring";
import type { Finding, Severity } from "../src/lib/engine/types";

const severityArb: fc.Arbitrary<Severity> = fc.constantFrom(
  "critical",
  "high",
  "medium",
  "low",
  "info",
);

const findingArb: fc.Arbitrary<Finding> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  check: fc.constantFrom("R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9"),
  severity: severityArb,
  title: fc.string({ minLength: 1, maxLength: 30 }),
  detail: fc.string({ minLength: 0, maxLength: 50 }),
  evidence: fc.array(fc.string({ maxLength: 20 }), { maxLength: 3 }),
  weight: fc.integer({ min: 0, max: 40 }),
});

describe("scoreFindings", () => {
  it("always lands in [0, 100]", () => {
    fc.assert(
      fc.property(fc.array(findingArb, { maxLength: 12 }), (findings) => {
        const score = scoreFindings(findings);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }),
      { numRuns: 500 },
    );
  });

  it("is deterministic: same findings, any order, same score", () => {
    fc.assert(
      fc.property(fc.array(findingArb, { maxLength: 10 }), (findings) => {
        const a = scoreFindings(findings);
        const shuffled = [...findings].reverse();
        expect(scoreFindings(shuffled)).toBe(a);
      }),
      { numRuns: 300 },
    );
  });

  it("is monotonic: adding findings never lowers the score", () => {
    fc.assert(
      fc.property(
        fc.array(findingArb, { maxLength: 8 }),
        fc.array(findingArb, { maxLength: 4 }),
        (base, extra) => {
          expect(scoreFindings([...base, ...extra])).toBeGreaterThanOrEqual(
            scoreFindings(base),
          );
        },
      ),
      { numRuns: 300 },
    );
  });

  it("empty findings score 0", () => {
    expect(scoreFindings([])).toBe(0);
  });

  it("weights are non-negative and match the severity table", () => {
    for (const severity of ["critical", "high", "medium", "low", "info"] as Severity[]) {
      expect(weightFor(severity)).toBeGreaterThanOrEqual(0);
    }
    expect(weightFor("critical")).toBe(75);
    expect(weightFor("high")).toBe(50);
    expect(weightFor("medium")).toBe(12);
    expect(weightFor("low")).toBe(5);
    expect(weightFor("info")).toBe(0);
  });

  it("one critical finding alone reaches Possessed", () => {
    const crit: Finding = {
      id: "x",
      check: "R2",
      severity: "critical",
      title: "x",
      detail: "x",
      evidence: [],
      weight: weightFor("critical"),
    };
    expect(bandFor(scoreFindings([crit]))).toBe("Possessed — do not touch");
  });

  it("one high finding alone reaches Haunted", () => {
    const high: Finding = {
      id: "x",
      check: "R2",
      severity: "high",
      title: "x",
      detail: "x",
      evidence: [],
      weight: weightFor("high"),
    };
    expect(bandFor(scoreFindings([high]))).toBe("Haunted");
  });
});

describe("bandFor", () => {
  it("maps the documented thresholds", () => {
    expect(bandFor(0)).toBe("Resting in peace");
    expect(bandFor(12)).toBe("Resting in peace");
    expect(bandFor(13)).toBe("Mildly haunted");
    expect(bandFor(49)).toBe("Mildly haunted");
    expect(bandFor(50)).toBe("Haunted");
    expect(bandFor(74)).toBe("Haunted");
    expect(bandFor(75)).toBe("Possessed — do not touch");
    expect(bandFor(100)).toBe("Possessed — do not touch");
  });

  it("two medium findings land at least in Mildly haunted", () => {
    // One medium is 12, the edge of Resting. Two mediums (24) must read
    // as more than one quiet issue, never Resting in peace.
    const medium = (): Finding => ({
      id: "x",
      check: "R2",
      severity: "medium",
      title: "x",
      detail: "x",
      evidence: [],
      weight: weightFor("medium"),
    });
    expect(scoreFindings([medium(), medium()])).toBe(24);
    expect(bandFor(scoreFindings([medium(), medium()]))).toBe(
      "Mildly haunted",
    );
  });
});
