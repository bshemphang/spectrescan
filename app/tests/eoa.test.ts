// SpectreScan — EOA (wallet address) handling tests.
// A wallet address holds no contract code, so it must never be scored
// as a haunted token. The regression: the user's own wallet
// 0x4f0682d407ffb296068941480c09490c8e9720a2 was once scanned as a
// token and came back with "source code missing", "no owner", and
// "no liquidity pair" findings.

import { describe, expect, it } from "vitest";
import { buildEoaResult, scanContract } from "../src/lib/engine/scan";

const USER_WALLET = "0x4f0682d407ffb296068941480c09490c8e9720a2";

describe("buildEoaResult", () => {
  it("marks the result as a wallet, with no haunted score", () => {
    const result = buildEoaResult(USER_WALLET, new Date().toISOString());
    expect(result.isEOA).toBe(true);
    expect(result.score).toBe(0);
    expect(result.band).toBe("Resting in peace");
    expect(result.explanation).toBeNull();
  });

  it("carries exactly one finding that says it is a wallet", () => {
    const result = buildEoaResult(USER_WALLET, new Date().toISOString());
    expect(result.findings).toHaveLength(1);
    const [finding] = result.findings;
    expect(finding.id).toBe("not-a-contract");
    expect(finding.severity).toBe("info");
    expect(finding.weight).toBe(0);
    expect(finding.title).toContain("wallet");
    expect(finding.detail).toContain("no contract code");
  });

  it("carries no token metadata and no misleading findings", () => {
    const result = buildEoaResult(USER_WALLET, new Date().toISOString());
    expect(result.token.name).toBeNull();
    expect(result.token.symbol).toBeNull();
    expect(result.token.totalSupply).toBeNull();
    const ids = result.findings.map((f) => f.id);
    expect(ids).not.toContain("unverified");
    expect(ids).not.toContain("owner-unknown");
    expect(ids).not.toContain("no-pair");
    expect(ids).not.toContain("holders-unknown");
  });
});

describe("live EOA scan", () => {
  it("the user's wallet scans as a wallet, not a token", async ({
    skip,
  }) => {
    const result = await scanContract(USER_WALLET);
    const online =
      result.sources.sourcify || result.sources.dexscreener || result.sources.rpc;
    if (!online) {
      skip();
      return;
    }
    expect(result.isEOA).toBe(true);
    expect(result.score).toBe(0);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].id).toBe("not-a-contract");
  });
});
