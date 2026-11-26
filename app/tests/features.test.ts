// SpectreScan — tests for the features round: explorer merge and
// sort, snapshot diffs, markdown export, watchlist storage, the
// shared scan rate limiter, and the bubble-map rank passthrough.
// The scorer, weights, bands, and fixture scores are covered by
// tests/fixtures.test.ts and are not re-tested here.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  filterExplorerEntries,
  mergeExplorerEntries,
  sortExplorerEntries,
} from "../src/lib/explorer";
import type { CaseFileData } from "../src/lib/cases";
import type { RecentScan } from "../src/lib/recent";
import {
  diffSnapshots,
  loadSnapshot,
  saveSnapshot,
  toSnapshot,
  type ScanSnapshot,
} from "../src/lib/snapshots";
import { buildMarkdownReport } from "../src/lib/exportReport";
import {
  isWatched,
  loadWatchlist,
  unwatchToken,
  watchToken,
} from "../src/lib/watchlist";
import { rateLimited, metaCacheGet, metaCachePut } from "../src/lib/scanCache";
import { pack } from "../src/components/BubbleMap";
import type { Finding, ScanResult } from "../src/lib/engine/types";

const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";
const C = "0x3333333333333333333333333333333333333333";

// In-memory localStorage for the node test environment. The
// watchlist and snapshot helpers read window.localStorage directly,
// so both globals are stubbed with the same store before they run.
function installStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { localStorage: storage });
}

function caseFile(
  address: string,
  score: number,
  band: CaseFileData["band"],
  label = "Filed token",
): CaseFileData {
  return {
    caseNo: "CASE-TEST",
    address,
    label,
    tagline: "A filed case.",
    score,
    band,
    findings: [],
  };
}

function recentScan(
  address: string,
  score: number,
  band: RecentScan["band"],
  scannedAt = "2026-11-27T00:00:00.000Z",
): RecentScan {
  return { address, name: null, symbol: null, score, band, scannedAt };
}

function finding(id: string, title: string): Finding {
  return {
    id,
    check: "R1",
    severity: "high",
    title,
    detail: "Detail.",
    evidence: [],
    weight: 50,
  };
}

function snapshot(
  score: number,
  band: ScanSnapshot["band"],
  findings: Array<{ id: string; title: string }>,
  scannedAt = "2026-11-27T00:00:00.000Z",
): ScanSnapshot {
  return { address: A, score, band, findings, scannedAt };
}

function scanResult(score: number, band: ScanResult["band"]): ScanResult {
  return {
    address: A,
    chainId: 56,
    scannedAt: "2026-11-27T00:00:00.000Z",
    score,
    band,
    token: { name: "Test Token", symbol: "TEST", decimals: 18, totalSupply: "1000" },
    verified: false,
    verificationStatus: "none",
    findings: [finding("f1", "Source code missing")],
    explanation: null,
    explainerFailed: true,
    sources: { sourcify: false, dexscreener: true, rpc: true },
  };
}

describe("explorer merge, sort, filter", () => {
  it("a filed case wins over a scan of the same address", () => {
    const merged = mergeExplorerEntries(
      [caseFile(A, 100, "Possessed")],
      [recentScan(A, 46, "Mildly haunted")],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe("case");
    expect(merged[0].score).toBe(100);
  });

  it("sorts most haunted first, then by score", () => {
    const merged = mergeExplorerEntries(
      [caseFile(A, 100, "Possessed"), caseFile(B, 46, "Mildly haunted")],
      [recentScan(C, 0, "Resting in peace")],
    );
    const sorted = sortExplorerEntries(merged, "haunted");
    expect(sorted.map((e) => e.address)).toEqual([A, B, C]);
  });

  it("filters by band and by query, case-insensitively", () => {
    const merged = mergeExplorerEntries(
      [caseFile(A, 100, "Possessed", "Selophane"), caseFile(B, 46, "Mildly haunted", "Cake Token")],
      [],
    );
    expect(
      filterExplorerEntries(merged, "", "Possessed").map((e) => e.address),
    ).toEqual([A]);
    expect(
      filterExplorerEntries(merged, "cake", "all").map((e) => e.address),
    ).toEqual([B]);
    expect(
      filterExplorerEntries(merged, "0x2222", "all").map((e) => e.address),
    ).toEqual([B]);
  });
});

describe("snapshot diff", () => {
  it("reports the score delta, band change, and gained and lost findings", () => {
    const diff = diffSnapshots(
      snapshot(46, "Mildly haunted", [
        { id: "f1", title: "Source code missing" },
      ]),
      snapshot(100, "Possessed", [
        { id: "f1", title: "Source code missing" },
        { id: "f2", title: "Owner can mint" },
      ]),
    );
    expect(diff.scoreDelta).toBe(54);
    expect(diff.bandChanged).toBe(true);
    expect(diff.previousScore).toBe(46);
    expect(diff.previousBand).toBe("Mildly haunted");
    expect(diff.gained.map((f) => f.id)).toEqual(["f2"]);
    expect(diff.gained.map((f) => f.title)).toEqual(["Owner can mint"]);
    expect(diff.lost).toEqual([]);
  });

  it("reports no change when the findings are identical", () => {
    const diff = diffSnapshots(
      snapshot(46, "Mildly haunted", [
        { id: "f1", title: "Source code missing" },
      ]),
      snapshot(46, "Mildly haunted", [
        { id: "f1", title: "Source code missing" },
      ]),
    );
    expect(diff.scoreDelta).toBe(0);
    expect(diff.bandChanged).toBe(false);
    expect(diff.gained).toEqual([]);
    expect(diff.lost).toEqual([]);
  });

  it("round-trips a snapshot through localStorage", () => {
    installStorage();
    saveSnapshot(toSnapshot(scanResult(46, "Mildly haunted")));
    const loaded = loadSnapshot(A);
    expect(loaded?.score).toBe(46);
    expect(loaded?.findings.map((f) => f.id)).toEqual(["f1"]);
    expect(loaded?.findings.map((f) => f.title)).toEqual([
      "Source code missing",
    ]);
  });
});

describe("markdown export", () => {
  it("carries the token, score, band, findings, and the not-an-audit note", () => {
    const md = buildMarkdownReport(scanResult(100, "Possessed"));
    expect(md).toContain("Test Token");
    expect(md).toContain("100");
    expect(md).toContain("Possessed");
    expect(md).toContain("Source code missing");
    expect(md).toContain("not an audit");
    expect(md).toContain("never calls a contract safe");
    expect(md).not.toMatch(/\baudited\b/i);
    expect(md).not.toMatch(/is safe/i);
  });

  it("escapes a crafted token name so it cannot ship as a live markdown link", () => {
    const result = scanResult(100, "Possessed");
    result.token.name = "[x](https://evil.example/track)";
    result.token.symbol = null;
    const md = buildMarkdownReport(result);
    expect(md).toContain("\\[x\\]\\(https://evil.example/track\\)");
    expect(md).not.toContain("[x](https://evil.example/track)");
  });
});

describe("watchlist", () => {
  beforeEach(() => {
    installStorage();
  });

  it("adds, finds, and removes a token", () => {
    expect(isWatched(A)).toBe(false);
    watchToken({
      address: A,
      name: "Test Token",
      symbol: "TEST",
      score: 46,
      band: "Mildly haunted",
      addedAt: "2026-11-27T00:00:00.000Z",
      lastScannedAt: "2026-11-27T00:00:00.000Z",
    });
    expect(isWatched(A)).toBe(true);
    expect(loadWatchlist()).toHaveLength(1);
    unwatchToken(A);
    expect(isWatched(A)).toBe(false);
    expect(loadWatchlist()).toHaveLength(0);
  });

  it("upserts instead of duplicating on re-watch", () => {
    watchToken({ address: A, name: null, symbol: null, score: 46, band: "Mildly haunted", addedAt: "2026-11-27T00:00:00.000Z", lastScannedAt: "2026-11-27T00:00:00.000Z" });
    watchToken({ address: A, name: null, symbol: null, score: 100, band: "Possessed", addedAt: "2026-11-27T00:00:00.000Z", lastScannedAt: "2026-11-27T01:00:00.000Z" });
    const list = loadWatchlist();
    expect(list).toHaveLength(1);
    expect(list[0].score).toBe(100);
  });

  it("caps at 50 entries, dropping the oldest", () => {
    for (let i = 0; i < 51; i++) {
      const address = `0x${String(i + 1).padStart(40, "0")}`;
      watchToken({ address, name: null, symbol: null, score: 0, band: "Resting in peace", addedAt: "2026-11-27T00:00:00.000Z", lastScannedAt: "2026-11-27T00:00:00.000Z" });
    }
    expect(loadWatchlist()).toHaveLength(50);
  });
});

describe("scan rate limiter", () => {
  it("allows 60 scans in a minute and blocks the 61st", () => {
    for (let i = 0; i < 60; i++) expect(rateLimited()).toBe(false);
    expect(rateLimited()).toBe(true);
  });

  it("limits per key, so one actor cannot lock everyone out", () => {
    for (let i = 0; i < 60; i++) expect(rateLimited("ip-a")).toBe(false);
    expect(rateLimited("ip-a")).toBe(true);
    expect(rateLimited("ip-b")).toBe(false);
  });
});

describe("metadata cache", () => {
  it("round-trips a title and description, and misses on other keys", () => {
    metaCachePut("0xabc", { title: "T: 1/100", description: "D" });
    expect(metaCacheGet("0xabc")).toEqual({ title: "T: 1/100", description: "D" });
    expect(metaCacheGet("0xdef")).toBeNull();
  });
});

describe("pack rank passthrough", () => {
  it("keeps a pre-assigned rank instead of renumbering", () => {
    const bubbles = pack(
      [
        { address: A, share: 50, netBalance: "100", kind: "holder", rank: 7 },
        { address: B, share: 30, netBalance: "60", kind: "holder", rank: 9 },
      ],
      600,
      380,
    );
    expect(bubbles.find((b) => b.address === A)?.rank).toBe(7);
    expect(bubbles.find((b) => b.address === B)?.rank).toBe(9);
  });
});
