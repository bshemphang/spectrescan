// SpectreScan — bubble-map packing tests. Regression for the CAKE
// case (2026-11-26): for a large-supply token every holder's share
// of total supply truncates to 0, and sizing by share divided 0 by
// 0, so every bubble but the first got r = NaN and React logged
// "<circle> attribute r: Expected length, NaN". Packing now sizes
// by relative net balance, so all radii are finite even when every
// share is 0.

import { describe, expect, it } from "vitest";
import { pack } from "../src/components/BubbleMap";

const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";
const C = "0x3333333333333333333333333333333333333333";

describe("pack", () => {
  it("gives finite radii when every share is 0 (CAKE case)", () => {
    const bubbles = pack(
      [
        { address: A, share: 0, netBalance: "288250739624", kind: "holder" },
        { address: B, share: 0, netBalance: "150000000000", kind: "holder" },
        { address: C, share: 0, netBalance: "50000000000", kind: "holder" },
      ],
      600,
      380,
    );
    expect(bubbles).toHaveLength(3);
    for (const b of bubbles) {
      expect(Number.isFinite(b.x)).toBe(true);
      expect(Number.isFinite(b.y)).toBe(true);
      expect(Number.isFinite(b.r)).toBe(true);
      expect(b.r).toBeGreaterThan(0);
    }
    // Largest mover gets the largest bubble, smallest mover the smallest.
    const byAddress = new Map(bubbles.map((b) => [b.address, b]));
    const rA = byAddress.get(A)!.r;
    const rB = byAddress.get(B)!.r;
    const rC = byAddress.get(C)!.r;
    expect(rA).toBeGreaterThan(rB);
    expect(rB).toBeGreaterThan(rC);
    expect(rA).toBeLessThanOrEqual(64);
    expect(rC).toBeGreaterThanOrEqual(22);
  });

  it("gives a single holder the full-size bubble", () => {
    const [b] = pack(
      [{ address: A, share: null, netBalance: "100", kind: "holder" }],
      600,
      380,
    );
    expect(b.r).toBe(64);
    expect(Number.isFinite(b.x)).toBe(true);
    expect(Number.isFinite(b.y)).toBe(true);
  });

  it("gives equal bubbles when every net balance is equal", () => {
    const bubbles = pack(
      [
        { address: A, share: 0, netBalance: "100", kind: "holder" },
        { address: B, share: 0, netBalance: "100", kind: "holder" },
      ],
      600,
      380,
    );
    expect(bubbles[0].r).toBe(bubbles[1].r);
    expect(Number.isFinite(bubbles[0].r)).toBe(true);
  });

  it("keeps every bubble inside the frame", () => {
    const bubbles = pack(
      Array.from({ length: 12 }, (_, i) => ({
        address: `0x${String(i + 1).padStart(40, "0")}`,
        share: 0,
        netBalance: String(1_000_000_000 - i * 80_000_000),
        kind: "holder" as const,
      })),
      600,
      380,
    );
    expect(bubbles).toHaveLength(12);
    for (const b of bubbles) {
      expect(b.x - b.r).toBeGreaterThanOrEqual(0);
      expect(b.x + b.r).toBeLessThanOrEqual(600);
      expect(b.y - b.r).toBeGreaterThanOrEqual(0);
      expect(b.y + b.r).toBeLessThanOrEqual(380);
    }
  });
});
