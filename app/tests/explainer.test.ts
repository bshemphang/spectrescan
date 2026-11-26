// SpectreScan — unit tests for the explainer safety filter.
// The filter is phrase-level: it blocks reassurance ("is safe") but
// allows warnings ("this is not safe"), because a correct verdict
// warns the reader instead of reassuring them.

import { describe, expect, it } from "vitest";
import {
  buildExplainerPrompt,
  buildLocalVerdict,
  hasBannedReassurance,
  stripMarkdown,
} from "../src/lib/explainer";
import type { Finding, ScanResult } from "../src/lib/engine/types";

describe("hasBannedReassurance", () => {
  it("rejects a reassuring verdict", () => {
    expect(hasBannedReassurance("This token is safe and secure.")).toBe(true);
  });

  it("rejects safe-to-buy and secure-investment phrasing", () => {
    expect(hasBannedReassurance("It looks safe to buy right now.")).toBe(true);
    expect(hasBannedReassurance("A secure investment for holders.")).toBe(true);
    expect(hasBannedReassurance("Safe to hold for the long term.")).toBe(true);
  });

  it("rejects audited and risk-free claims", () => {
    expect(hasBannedReassurance("The contract is audited.")).toBe(true);
    expect(hasBannedReassurance("This is a risk-free opportunity.")).toBe(true);
    expect(hasBannedReassurance("Guaranteed safe returns.")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(hasBannedReassurance("THIS TOKEN IS SAFE.")).toBe(true);
  });

  it("allows a warning verdict", () => {
    expect(
      hasBannedReassurance(
        "This is not safe, do not touch. One address holds everything.",
      ),
    ).toBe(false);
  });

  it("allows the bare words safe and secure inside a warning", () => {
    expect(
      hasBannedReassurance(
        "The contract is not secure and the mint is unsafe.",
      ),
    ).toBe(false);
  });
});

describe("stripMarkdown", () => {
  // The exact verdict a user pasted back from the live site: the LLM
  // had wrapped every lead phrase in ** bold markers and the UI showed
  // them raw. After the fix the same text must render as plain
  // sentences with no markdown markers left.
  const PASTED_VERDICT = [
    "The contract at 0x4f0682d407ffb296068941480c09490c8e9720a2 on BSC (chain 56) shows a few key points:",
    "- **Source code missing** - Nobody has published the contract's source, so we can't read its logic. The only evidence is that Sourcify found no match.",
    "- **No owner function** - The contract doesn't expose an `owner()` function, so there's no obvious single-owner address to check. An `eth_call` to `owner()` returned no data.",
    "- **No liquidity pair** - The token has no trading pair on any DEX, meaning it can't be sold or traded. DexScreener shows no pairs.",
    "- **Holder distribution unknown** - We couldn't read the token supply or the latest block, so we can't determine how many holders or how the tokens are distributed. RPC read failed.",
    "- **No liquidity, no trading** - Reiterating that without a DEX pair, the token has no market liquidity at present. DexScreener confirms no pairs.",
    "These findings give a snapshot of the contract's current state, but they do not constitute a full audit.",
  ].join("\n");

  it("strips the bold markers from the pasted live verdict", () => {
    const clean = stripMarkdown(PASTED_VERDICT);
    expect(clean).not.toContain("**");
    expect(clean).not.toContain("*");
    expect(clean).not.toContain("`");
    expect(clean).toContain("Source code missing");
    expect(clean).toContain("No owner function");
    expect(clean).toContain("owner() function");
    expect(clean).toContain("These findings give a snapshot");
  });

  it("strips headings, lists, links, and italic markers", () => {
    const clean = stripMarkdown(
      "# Verdict\n- *First* point\n- Second [point](https://example.com)\n> A quote",
    );
    expect(clean).not.toContain("#");
    expect(clean).not.toContain("*");
    expect(clean).not.toContain("[");
    expect(clean).not.toContain("https://example.com");
    expect(clean).toContain("Verdict");
    expect(clean).toContain("First point");
    expect(clean).toContain("Second point");
    expect(clean).toContain("A quote");
  });

  it("leaves plain sentences untouched", () => {
    const plain = "One address holds everything. Do not touch this token.";
    expect(stripMarkdown(plain)).toBe(plain);
  });

  it("does not mangle snake_case identifiers", () => {
    expect(stripMarkdown("The mint_to_owner function is public.")).toBe(
      "The mint_to_owner function is public.",
    );
  });
});

describe("buildLocalVerdict", () => {
  function makeResult(findings: Finding[]): ScanResult {
    return {
      address: "0x0000000000000000000000000000000000000000",
      chainId: 56,
      scannedAt: new Date().toISOString(),
      score: 100,
      band: "Possessed",
      token: { name: "Sexy Lobster", symbol: "SELO", decimals: 18, totalSupply: "10000000" },
      verified: false,
      verificationStatus: "partial",
      findings,
      explanation: null,
      explainerFailed: true,
      sources: { sourcify: true, dexscreener: false, rpc: true },
    };
  }

  function makeFinding(
    id: string,
    severity: Finding["severity"],
    detail: string,
  ): Finding {
    return {
      id,
      check: "R1",
      severity,
      title: id,
      detail,
      evidence: [],
      weight: 50,
    };
  }

  it("opens with the score and band and quotes the worst findings first", () => {
    const verdict = buildLocalVerdict(
      makeResult([
        makeFinding("low-note", "low", "Only part of the source matches the deployed bytecode."),
        makeFinding("deployer-mint", "high", "The deployer minted the entire supply at launch."),
        makeFinding("no-pair", "medium", "No trading pair exists for this token."),
      ]),
    );
    expect(verdict).toContain("Sexy Lobster scores 100 out of 100, Possessed.");
    // High severity first, then medium, then low.
    const mintAt = verdict.indexOf("deployer minted the entire supply");
    const pairAt = verdict.indexOf("No trading pair exists");
    const sourceAt = verdict.indexOf("Only part of the source matches");
    expect(mintAt).toBeGreaterThan(-1);
    expect(pairAt).toBeGreaterThan(mintAt);
    expect(sourceAt).toBeGreaterThan(pairAt);
    expect(verdict).toContain("This is not an audit");
  });

  it("uses at most three findings", () => {
    const verdict = buildLocalVerdict(
      makeResult([
        makeFinding("a", "high", "First finding."),
        makeFinding("b", "high", "Second finding."),
        makeFinding("c", "high", "Third finding."),
        makeFinding("d", "high", "Fourth finding."),
      ]),
    );
    expect(verdict).not.toContain("Fourth finding.");
    expect(verdict).toContain("First finding.");
    expect(verdict).toContain("Second finding.");
    expect(verdict).toContain("Third finding.");
  });

  it("works with no findings and with an unnamed contract", () => {
    const result = makeResult([]);
    result.token.name = null;
    result.token.symbol = null;
    result.score = 0;
    result.band = "Resting in peace";
    const verdict = buildLocalVerdict(result);
    expect(verdict).toContain("This contract scores 0 out of 100, Resting in peace.");
    expect(verdict).toContain("This is not an audit");
  });

  it("never contains banned reassurance", () => {
    const verdict = buildLocalVerdict(
      makeResult([
        makeFinding("mint", "high", "The owner can mint new tokens at any time."),
        makeFinding("pair", "medium", "Only a tiny share of supply sits in the pool."),
      ]),
    );
    expect(hasBannedReassurance(verdict)).toBe(false);
    expect(verdict).not.toContain("**");
  });

  it("falls back to a neutral subject when the token name itself is a reassurance", () => {
    const result = makeResult([
      makeFinding("mint", "high", "The owner can mint new tokens at any time."),
    ]);
    result.token.name = "Audited Safe Token";
    result.token.symbol = "AUDIT";
    const verdict = buildLocalVerdict(result);
    expect(verdict).toContain("This contract scores 100 out of 100, Possessed.");
    expect(verdict).not.toContain("Audited Safe Token");
    expect(hasBannedReassurance(verdict)).toBe(false);
  });
});

describe("buildExplainerPrompt", () => {
  it("tells the model to write plain sentences with no markdown", () => {
    const result: ScanResult = {
      address: "0x0000000000000000000000000000000000000000",
      chainId: 56,
      scannedAt: new Date().toISOString(),
      score: 0,
      band: "Resting in peace",
      token: { name: null, symbol: null, decimals: null, totalSupply: null },
      verified: false,
      verificationStatus: "none",
      findings: [],
      explanation: null,
      explainerFailed: false,
      sources: { sourcify: false, dexscreener: false, rpc: false },
    };
    const prompt = buildExplainerPrompt(result);
    expect(prompt).toContain("Do not use markdown");
    expect(prompt).toContain("plain sentences");
  });
});
