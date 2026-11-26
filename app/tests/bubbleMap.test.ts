// SpectreScan — bubble-map packing tests. Regression for the CAKE
// case (2026-11-26): for a large-supply token every holder's share
// of total supply truncates to 0, and sizing by share divided 0 by
// 0, so every bubble but the first got r = NaN and React logged
// "<circle> attribute r: Expected length, NaN". Packing now sizes
// by relative net balance, so all radii are finite even when every
// share is 0.

import { describe, expect, it } from "vitest";
import {
  absentSpecialKinds,
  ghostStops,
  KIND_STYLE,
  pack,
  visibleEdges,
} from "../src/components/BubbleMap";

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

describe("visibleEdges", () => {
  const bubbles = [
    { x: 100, y: 100, r: 40, address: A, share: 10, kind: "holder" as const },
    { x: 300, y: 100, r: 30, address: B, share: 5, kind: "holder" as const },
    { x: 500, y: 100, r: 20, address: C, share: 1, kind: "holder" as const },
  ];
  const D = "0x4444444444444444444444444444444444444444";

  it("keeps only moves where both ends are shown bubbles", () => {
    const edges = visibleEdges(bubbles, [
      { from: A, to: B, value: "100" },
      { from: A, to: D, value: "999" },
      { from: D, to: C, value: "999" },
    ]);
    expect(edges).toHaveLength(1);
    expect(edges[0].from.address).toBe(A);
    expect(edges[0].to.address).toBe(B);
    expect(edges[0].value).toBe("100");
  });

  it("skips self transfers", () => {
    const edges = visibleEdges(bubbles, [
      { from: A, to: A, value: "100" },
      { from: B, to: C, value: "50" },
    ]);
    expect(edges).toHaveLength(1);
    expect(edges[0].from.address).toBe(B);
  });

  it("caps edges at 8", () => {
    const moves = Array.from({ length: 12 }, (_, i) => ({
      from: i % 2 === 0 ? A : B,
      to: i % 2 === 0 ? B : C,
      value: String(100 - i),
    }));
    expect(visibleEdges(bubbles, moves)).toHaveLength(8);
  });

  it("matches addresses case-insensitively", () => {
    const edges = visibleEdges(bubbles, [
      { from: A.toUpperCase(), to: B.toLowerCase(), value: "7" },
    ]);
    expect(edges).toHaveLength(1);
  });
});

describe("pack ranks", () => {
  it("assigns rank 1 to the biggest mover and 1..N in order", () => {
    const bubbles = pack(
      [
        { address: A, share: 0, netBalance: "100", kind: "holder" },
        { address: B, share: 0, netBalance: "300", kind: "holder" },
        { address: C, share: 0, netBalance: "200", kind: "holder" },
      ],
      600,
      380,
    );
    const rankOf = new Map(bubbles.map((b) => [b.address, b.rank]));
    expect(rankOf.get(B)).toBe(1);
    expect(rankOf.get(C)).toBe(2);
    expect(rankOf.get(A)).toBe(3);
  });

  it("gives a single holder rank 1", () => {
    const [b] = pack(
      [{ address: A, share: null, netBalance: "100", kind: "holder" }],
      600,
      380,
    );
    expect(b.rank).toBe(1);
  });
});

describe("category styles", () => {
  it("burn and holder fills differ, and holder is blue not grey", () => {
    expect(KIND_STYLE.burn.fill).not.toBe(KIND_STYLE.holder.fill);
    expect(KIND_STYLE.holder.fill).toBe("#3b82f6");
    expect(KIND_STYLE.burn.fill).toBe("#0c0a12");
    expect(KIND_STYLE.burn.stroke).toBe("#f97316");
  });

  it("every kind has a non-empty label so no bubble is a mystery", () => {
    for (const k of ["minter", "contract", "pair", "burn", "holder"] as const) {
      expect(KIND_STYLE[k].label.length).toBeGreaterThan(0);
    }
  });

  it("burn carries ember dots and a badge", () => {
    expect(KIND_STYLE.burn.dots).toBe(true);
    expect(KIND_STYLE.burn.badge).toBe("B");
    expect(KIND_STYLE.holder.dots).toBe(false);
  });
});

describe("absentSpecialKinds", () => {
  it("lists missing special kinds and never lists holder", () => {
    expect(absentSpecialKinds(["holder"])).toEqual([
      "minter",
      "contract",
      "pair",
      "burn",
    ]);
    expect(absentSpecialKinds(["holder", "minter", "burn"])).toEqual([
      "contract",
      "pair",
    ]);
  });

  it("returns empty when all four special kinds are present", () => {
    expect(
      absentSpecialKinds(["minter", "contract", "pair", "burn", "holder"]),
    ).toEqual([]);
  });
});

describe("ghostStops", () => {
  it("spaces 3 ghosts along a 270px horizontal edge, facing right", () => {
    const stops = ghostStops(0, 0, 270, 0);
    expect(stops).toHaveLength(3);
    expect(stops[0]).toEqual({ x: 45, y: 0, angle: 0 });
    expect(stops[1]).toEqual({ x: 135, y: 0, angle: 0 });
    expect(stops[2]).toEqual({ x: 225, y: 0, angle: 0 });
  });

  it("gives 2 ghosts for a short edge and caps at 4 for a long one", () => {
    expect(ghostStops(0, 0, 50, 0)).toHaveLength(2);
    expect(ghostStops(0, 0, 900, 0)).toHaveLength(4);
  });

  it("faces downward on a vertical edge", () => {
    const stops = ghostStops(0, 0, 0, 180);
    expect(stops).toHaveLength(2);
    for (const s of stops) expect(s.angle).toBe(90);
    expect(stops[0].y).toBeLessThan(stops[1].y);
  });

  it("faces backwards on a leftward edge", () => {
    const stops = ghostStops(200, 50, 20, 50);
    expect(stops).toHaveLength(2);
    for (const s of stops) expect(s.angle).toBe(180);
  });

  it("returns one stop for a zero-length edge", () => {
    expect(ghostStops(10, 10, 10, 10)).toEqual([
      { x: 10, y: 10, angle: 0 },
    ]);
  });
});
