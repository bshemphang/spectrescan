// SpectreScan — transfer analysis tests. summarizeLogs and
// detectProxy are pure, so they are tested with fabricated logs:
// a mint, two transfers, and a burn. The live behaviour (scores,
// real chains) is covered by the fixture tests.

import { describe, expect, it } from "vitest";
import {
  detectProxy,
  summarizeLogs,
} from "../src/lib/engine/holders";
import { formatAmount, formatAgeAtLeast, formatShare } from "../src/lib/format";
import type { TransferLog } from "../src/lib/engine/fetchers";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO = "0x0000000000000000000000000000000000000000";
const DEAD = "0x000000000000000000000000000000000000dEaD";
const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";
const C = "0x3333333333333333333333333333333333333333";
const TOKEN = "0x4444444444444444444444444444444444444444";
const PAIR = "0x5555555555555555555555555555555555555555";

function topic(addr: string): string {
  return "0x000000000000000000000000" + addr.slice(2).toLowerCase();
}

function log(
  from: string,
  to: string,
  value: bigint,
  blockNumber: number,
): TransferLog {
  return {
    topics: [TRANSFER_TOPIC, topic(from), topic(to)],
    data: "0x" + value.toString(16),
    blockNumber,
  };
}

const LOGS = [
  log(ZERO, A, 1000n, 100), // mint: A is the first minter
  log(A, B, 400n, 101),
  log(B, C, 100n, 102),
  log(A, DEAD, 50n, 103), // burn
];

const EXCLUDED = new Set([TOKEN.toLowerCase(), PAIR.toLowerCase()]);

describe("summarizeLogs", () => {
  it("reconstructs net balances and shares", () => {
    const s = summarizeLogs(LOGS, 1000n, null, false, EXCLUDED);
    expect(s.holders).toHaveLength(4);
    expect(s.holders[0]).toMatchObject({ address: A.toLowerCase(), share: 55 });
    expect(s.holders[1]).toMatchObject({ address: B.toLowerCase(), share: 30 });
    expect(s.holders[2]).toMatchObject({ address: C.toLowerCase(), share: 10 });
    expect(s.holders[3]).toMatchObject({
      address: DEAD.toLowerCase(),
      share: 5,
    });
    expect(s.topHolderShare).toBe(55);
  });

  it("keeps a tiny share to four decimals instead of rounding it to zero", () => {
    const logs = [log(ZERO, A, 90n, 100)];
    const s = summarizeLogs(logs, 1000000n, null, false, EXCLUDED);
    expect(s.holders).toHaveLength(1);
    expect(s.holders[0].share).toBe(0.009);
    expect(formatShare(s.holders[0].share)).toBe("0.0090%");
  });

  it("finds the first minter and the first seen block", () => {
    const s = summarizeLogs(LOGS, 1000n, null, false, EXCLUDED);
    expect(s.firstMinter).toBe(A.toLowerCase());
    expect(s.firstSeenBlock).toBe(100);
    expect(s.eventsProcessed).toBe(4);
  });

  it("ranks senders and receivers by volume", () => {
    const s = summarizeLogs(LOGS, 1000n, null, false, EXCLUDED);
    expect(s.senders[0]).toMatchObject({
      address: A.toLowerCase(),
      volume: "450",
    });
    expect(s.senders[1]).toMatchObject({
      address: B.toLowerCase(),
      volume: "100",
    });
    expect(s.receivers[0]).toMatchObject({
      address: A.toLowerCase(),
      volume: "1000",
    });
    expect(s.receivers[1]).toMatchObject({
      address: B.toLowerCase(),
      volume: "400",
    });
    expect(s.totalMoved).toBe("1550");
    expect(s.biggestMoves[0]).toMatchObject({
      from: ZERO,
      to: A.toLowerCase(),
      value: "1000",
    });
  });

  it("excludes the token and pair from the R8 top-10 set only", () => {
    const logs = [...LOGS, log(ZERO, TOKEN, 5000n, 104)];
    const s = summarizeLogs(logs, 6000n, null, false, EXCLUDED);
    expect(s.holders[0].address).toBe(TOKEN.toLowerCase());
    expect(
      s.topHoldersExcluding.map((h) => h.address),
    ).not.toContain(TOKEN.toLowerCase());
    expect(s.topHoldersExcluding[0].address).toBe(A.toLowerCase());
  });

  it("reports no valid transfers for empty logs", () => {
    const s = summarizeLogs([], 1000n, null, false, EXCLUDED);
    expect(s.hadValidTransfers).toBe(false);
    expect(s.holders).toHaveLength(0);
    expect(s.firstSeenBlock).toBeNull();
    expect(s.firstMinter).toBeNull();
    expect(s.totalMoved).toBe("0");
  });

  it("a partial log set still yields holders and flow", () => {
    // Regression for the CAKE case (2026-11-26): the log scan stopped
    // early under PublicNode rate-limiting, and the dossier hid the
    // bubble map and flow entirely. Logs collected before the stop
    // are real data: the map and flow render from them, labelled
    // partial, instead of showing nothing.
    const partial = LOGS.slice(0, 2);
    const s = summarizeLogs(partial, 1000n, null, false, EXCLUDED);
    expect(s.eventsProcessed).toBe(2);
    expect(s.hadValidTransfers).toBe(true);
    expect(s.holders.length).toBeGreaterThan(0);
    expect(s.senders.length).toBeGreaterThan(0);
    expect(s.receivers.length).toBeGreaterThan(0);
    expect(s.firstMinter).toBe(A.toLowerCase());
    expect(s.firstSeenBlock).toBe(100);
  });

  it("ignores logs that do not parse", () => {
    const bad: TransferLog[] = [
      { topics: [TRANSFER_TOPIC], data: "0x10", blockNumber: 100 },
      { topics: [TRANSFER_TOPIC, topic(A), topic(B)], data: "not-hex", blockNumber: 101 },
    ];
    const s = summarizeLogs(bad, 1000n, null, false, EXCLUDED);
    expect(s.hadValidTransfers).toBe(false);
    expect(s.eventsProcessed).toBe(2);
  });
});

describe("detectProxy", () => {
  it("reads the EIP-1967 implementation slot", () => {
    const impl = "0x" + "0".repeat(24) + B.slice(2).toLowerCase();
    expect(
      detectProxy("0x60006000", impl, "0x" + "0".repeat(64)),
    ).toEqual({ kind: "eip1967", implementation: B.toLowerCase() });
  });

  it("reads the EIP-1822 slot when 1967 is empty", () => {
    const impl = "0x" + "0".repeat(24) + C.slice(2).toLowerCase();
    expect(
      detectProxy("0x60006000", "0x" + "0".repeat(64), impl),
    ).toEqual({ kind: "eip1822", implementation: C.toLowerCase() });
  });

  it("recognises a minimal proxy by its code prefix", () => {
    expect(
      detectProxy(
        "0x363d3d373d3d3d363d73" + A.slice(2) + "5af43d82803e903d91602b57fd5bf3",
        "0x" + "0".repeat(64),
        "0x" + "0".repeat(64),
      ),
    ).toEqual({ kind: "minimal", implementation: null });
  });

  it("says none detected for plain code and empty slots", () => {
    expect(
      detectProxy("0x6080604052", "0x" + "0".repeat(64), "0x" + "0".repeat(64)),
    ).toEqual({ kind: "none", implementation: null });
  });

  it("says unknown when every read failed", () => {
    expect(detectProxy(null, null, null)).toEqual({
      kind: "unknown",
      implementation: null,
    });
  });
});

describe("formatAmount", () => {
  it("applies decimals and shortens big numbers", () => {
    expect(formatAmount("1000000", 6)).toBe("1");
    expect(formatAmount("1234567", 6, "SELO")).toBe("1.23 SELO");
    expect(formatAmount("1240000000000", 6, "SELO")).toBe("1.24M SELO");
    expect(formatAmount("5000000000000000", 6)).toBe("5B");
    expect(formatAmount("0", 18, "CAKE")).toBe("0 CAKE");
  });

  it("shortens the raw number when decimals are unknown", () => {
    expect(formatAmount("1234567", null)).toBe("1.23M");
  });

  it("says unknown for an unparseable amount", () => {
    expect(formatAmount("nope", 18)).toBe("unknown");
  });
});

describe("formatShare", () => {
  it("never rounds a real share to 0.0%", () => {
    expect(formatShare(55)).toBe("55.0%");
    expect(formatShare(0.5)).toBe("0.50%");
    expect(formatShare(0.0001)).toBe("0.0001%");
    expect(formatShare(0.00001)).toBe("<0.0001%");
    expect(formatShare(null)).toBe("?");
  });
});

describe("formatAgeAtLeast", () => {
  it("states a lower bound, never an exact age", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(formatAgeAtLeast(now - 1800)).toBe("at least 30m");
    expect(formatAgeAtLeast(now - 90000)).toBe("at least 1d 1h");
  });
});
