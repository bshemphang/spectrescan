// SpectreScan — the three filed cases, with the real findings from
// live scans (verified 2026-11-26 against the local dev server).
// These are the only sample cases on the site. Scores, severities,
// titles, and evidence are copied verbatim from the engine output;
// if the engine changes a score, this file must be re-verified, not
// edited to match. Case files render from here on the home page and
// the registry.

import type { Finding, RiskBand } from "@/lib/engine/types";

export interface CaseFileData {
  caseNo: string;
  address: string;
  label: string;
  tagline: string;
  score: number;
  band: RiskBand;
  findings: Finding[];
}

function f(
  id: string,
  check: string,
  severity: Finding["severity"],
  title: string,
  evidence: string[],
): Finding {
  const weight = { critical: 75, high: 50, medium: 12, low: 5, info: 0 }[
    severity
  ];
  return {
    id,
    check,
    severity,
    title,
    detail: "",
    evidence,
    weight,
  };
}

export const CASE_FILES: CaseFileData[] = [
  {
    caseNo: "CASE 001",
    address: "0x903449fdca80acec639941dc3c84f439cbad5df7",
    label: "SELO",
    tagline: "Creator holds 100% of the supply",
    score: 100,
    band: "Possessed",
    findings: [
      f("verified-partial", "R1", "low", "Source code partially verified", [
        "sourcify: partial match",
      ]),
      f(
        "deployer-mint",
        "R2",
        "high",
        "Entire supply minted to the deployer at launch",
        ["DigitalToken.sol:22"],
      ),
      f("owner-unknown", "R5", "info", "No owner() function found", [
        "eth_call owner() returned no data",
      ]),
      f("lp-unknown", "R7", "info", "No liquidity pair found", [
        "dexscreener: no pairs",
      ]),
      f(
        "holders-unknown",
        "R8",
        "info",
        "Holder distribution could not be read",
        ["dexscreener: no pairs"],
      ),
      f(
        "no-pair",
        "R9",
        "high",
        "No trading pair, and the deployer holds everything",
        ["dexscreener: no pairs"],
      ),
    ],
  },
  {
    caseNo: "CASE 002",
    address: "0x07D1554f450bE9158993180Dd0494A00C5c696dA",
    label: "AGIO",
    tagline: "Honeypot flags, mintable, pausable",
    score: 100,
    band: "Possessed",
    findings: [
      f("verified-partial", "R1", "low", "Source code partially verified", [
        "sourcify: partial match",
      ]),
      f(
        "trading-gate",
        "R2",
        "high",
        "Owner-controlled trading switch",
        ["AGIOToken.sol:24", "AGIOToken.sol:29", "AGIOToken.sol:70"],
      ),
      f("mintable", "R2", "high", "Owner can mint new tokens", [
        "AGIOToken.sol:65",
        "interfaces/IPancake.sol:14",
      ]),
      f("owner-unknown", "R5", "info", "No owner() function found", [
        "eth_call owner() returned no data",
      ]),
      f("lp-unknown", "R7", "info", "No liquidity pair found", [
        "dexscreener: no pairs",
      ]),
      f(
        "holders-unknown",
        "R8",
        "info",
        "Holder distribution could not be read",
        ["dexscreener: no pairs"],
      ),
      f("no-pair", "R9", "medium", "No trading pair, no liquidity", [
        "dexscreener: no pairs",
      ]),
    ],
  },
  {
    caseNo: "CASE 003",
    address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
    label: "CAKE",
    tagline: "PancakeSwap's token",
    score: 46,
    band: "Mildly haunted",
    findings: [
      f("verified-partial", "R1", "low", "Source code partially verified", [
        "sourcify: partial match",
      ]),
      f("mintable", "R2", "medium", "Owner can mint new tokens", [
        "CakeToken.sol:746",
        "CakeToken.sol:858",
      ]),
      f(
        "owner-verified-contract",
        "R5",
        "low",
        "Owner is a verified contract",
        [
          "owner() = 0x73feaa1ee314f8c655e354234017be2193c9e24e",
          "owner contract verified on Sourcify",
        ],
      ),
      f(
        "lp-v3-unverified",
        "R7",
        "medium",
        "Concentrated-liquidity (V3) pool, lock status unknown",
        [
          "pair 0x7f51c8AaA6B0599aBd16674e2b17FEc7a9f674A1",
          "slot0() present, totalSupply() reverts",
        ],
      ),
      f(
        "holders-outside-pool",
        "R8",
        "medium",
        "Only 0.0% of supply sits in the pool",
        [
          "pair holds 0.0% of total supply",
          "pair 0x7f51c8AaA6B0599aBd16674e2b17FEc7a9f674A1",
        ],
      ),
      f("liquidity-ok", "R9", "info", "Liquidity $4,723,807", [
        "liquidity = $4723806.94",
        "pair 0x7f51c8AaA6B0599aBd16674e2b17FEc7a9f674A1",
      ]),
    ],
  },
];
