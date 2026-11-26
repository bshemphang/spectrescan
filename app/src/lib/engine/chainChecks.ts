// SpectreScan rules engine — on-chain checks R1, R5–R9 (spec: design.md).
// Every check is defensive: a failed data source produces an "unknown"
// finding (weight 0), never a crash and never a guessed value.

import type { DexPair, Finding } from "./types";
import { weightFor } from "./scoring";
import { type TransferAnalysis } from "./holders";
import {
  BURN_ADDRESSES,
  bestPair,
  callBalanceOf,
  callSlot0,
  callTotalSupply,
} from "./fetchers";

function finding(
  id: string,
  check: string,
  severity: Finding["severity"],
  title: string,
  detail: string,
  evidence: string[],
): Finding {
  return { id, check, severity, title, detail, evidence, weight: weightFor(severity) };
}

// R1 — verification status (source already fetched by the caller).
export function verificationFinding(
  status: "perfect" | "partial" | "none",
): Finding {
  if (status === "perfect") {
    return finding(
      "verified-source",
      "R1",
      "info",
      "Source code verified on Sourcify",
      "The contract source is published and matches the deployed bytecode, so the checks below read real code, not guesses.",
      ["sourcify: exact match"],
    );
  }
  if (status === "partial") {
    return finding(
      "verified-partial",
      "R1",
      "low",
      "Source code partially verified",
      "Only part of the source matches the deployed bytecode. The checks below may miss code that was not verified.",
      ["sourcify: partial match"],
    );
  }
  return finding(
    "unverified",
    "R1",
    "medium",
    "Contract source NOT verified",
    "Nobody has published the source code for this contract, so its behaviour cannot be read. Only its on-chain footprint can be checked.",
    ["sourcify: no match"],
  );
}

// R5/R6 — owner checks. The caller fetches the owner once and, when the
// owner is a contract, checks whether THAT contract is verified on
// Sourcify. A verified owner contract is transparent — its rules are public
// code — so it scores low; an unverified owner contract hides its controller
// and scores high.
export async function ownerFindings(
  address: string,
  owner: string | null,
  ownerIsContract: boolean | null,
  ownerVerified: boolean,
): Promise<Finding[]> {
  if (owner === null) {
    return [
      finding(
        "owner-unknown",
        "R5",
        "info",
        "No owner() function found",
        "This contract exposes no owner() function, so there is no single owner address to check. Ownership may still exist under a different pattern.",
        ["eth_call owner() returned no data"],
      ),
    ];
  }
  if (owner === "0x0000000000000000000000000000000000000000") {
    return [
      finding(
        "owner-renounced",
        "R6",
        "info",
        "Ownership renounced",
        "owner() returns the zero address, so no one can call owner-only functions any more. Minting, pausing and fee changes are locked out.",
        ["owner() = 0x000…000"],
      ),
    ];
  }
  if (ownerIsContract === true) {
    if (ownerVerified) {
      return [
        finding(
          "owner-verified-contract",
          "R5",
          "low",
          "Owner is a verified contract",
          "The owner is a contract whose source is published and readable, so its rules are public code rather than one person's discretion. Read that contract before trusting it.",
          [`owner() = ${owner}`, "owner contract verified on Sourcify"],
        ),
      ];
    }
    return [
      finding(
        "hidden-owner",
        "R5",
        "high",
        "Owner is an unverified smart contract",
        "The owner is itself a contract whose source is not published. Its real controller is hidden behind another layer, and owner powers may be exercised by code you cannot see here.",
        [`owner() = ${owner}`, "owner address holds contract code"],
      ),
    ];
  }
  return [
    finding(
      "owner-live",
      "R5",
      "medium",
      "Live owner wallet",
      "Ownership has not been renounced. One wallet can still call every owner-only function in this contract.",
      [`owner() = ${owner}`],
    ),
  ];
}

// R7 — LP burn share of the best-liquidity pair.
export async function lpBurnFinding(
  tokenAddress: string,
  pairs: DexPair[] | null,
): Promise<Finding> {
  const pair = bestPair(pairs);
  if (!pair) {
    return finding(
      "lp-unknown",
      "R7",
      "info",
      "No liquidity pair found",
      "No trading pair was found for this token, so LP lock status could not be checked. A token with no pair cannot be sold on a DEX.",
      ["dexscreener: no pairs"],
    );
  }
  const lpTotal = await callTotalSupply(pair.pairAddress);
  if (lpTotal === null || lpTotal === 0n) {
    // V3-style concentrated-liquidity pools have no totalSupply; slot0()
    // exists only on them. A V3 pool has no LP token to burn-check — but
    // that is NOT a clean bill of health. Liquidity sits in NFT positions
    // owned by individual providers, and those positions cannot be
    // enumerated from public RPC data (no Transfer-log access), so their
    // lock status is unknown. Never present that as "nothing to see here".
    const slot0 = await callSlot0(pair.pairAddress);
    if (slot0 !== null) {
      return finding(
        "lp-v3-unverified",
        "R7",
        "medium",
        "Concentrated-liquidity (V3) pool, lock status unknown",
        "This pair is a V3-style pool, so there is no LP token to burn or lock. Liquidity sits in concentrated NFT positions owned by individual providers, and those positions cannot be checked from public data. Providers can withdraw their liquidity at any time, so do not treat this liquidity as locked.",
        [`pair ${pair.pairAddress}`, "slot0() present, totalSupply() reverts"],
      );
    }
    return finding(
      "lp-unknown",
      "R7",
      "info",
      "LP supply could not be read",
      "The pair contract did not return a total LP supply, so the burn share could not be computed.",
      [`pair ${pair.pairAddress}`],
    );
  }
  let burned = 0n;
  for (const burn of BURN_ADDRESSES) {
    const bal = await callBalanceOf(pair.pairAddress, burn);
    if (bal !== null) burned += bal;
  }
  const share = Number((burned * 10000n) / lpTotal) / 100; // percent, 2dp
  if (share >= 90) {
    return finding(
      "lp-burned",
      "R7",
      "info",
      `LP mostly burned (${share.toFixed(1)}%)`,
      "Almost all of the pair's LP tokens sit in burn addresses, so the liquidity cannot be pulled by the deployer.",
      [`burned LP share = ${share.toFixed(1)}%`, `pair ${pair.pairAddress}`],
    );
  }
  if (share >= 50) {
    return finding(
      "lp-partial",
      "R7",
      "low",
      `LP only partly burned (${share.toFixed(1)}%)`,
      "Only part of the LP tokens are burned. Some liquidity could still be removed by whoever holds the remaining LP tokens.",
      [`burned LP share = ${share.toFixed(1)}%`, `pair ${pair.pairAddress}`],
    );
  }
  return finding(
    "lp-unlocked",
    "R7",
    "medium",
    `LP barely burned (${share.toFixed(1)}%)`,
    "Almost none of the LP tokens are burned, so whoever holds them can pull the liquidity at any time. That is the classic rug-pull setup.",
    [`burned LP share = ${share.toFixed(1)}%`, `pair ${pair.pairAddress}`],
  );
}

// R8 — holder concentration, pair-share proxy only (design.md).
// The design defines R8 as the pair-share proxy: the share of total
// supply sitting in the main DEX pair. The Transfer-log scan feeds
// the dossier (bubble map, transfer flow, first seen, first minter),
// never this score: a 20,000-block window of movement is not a
// holder list, and for a large token the top-10 window movement is a
// rounding error of supply, so scoring it as "distributed" would be
// wrong. Pair share < 10% -> medium, >= 10% -> info (inconclusive).
// No pair -> unknown. The analysis argument only supplies the
// totalSupply and latest-block reads (and names which read failed).
export async function holderConcentrationFinding(
  analysis: TransferAnalysis,
  tokenAddress: string,
  pairs: DexPair[] | null,
): Promise<Finding> {
  const total =
    analysis.totalSupply === null ? null : BigInt(analysis.totalSupply);
  const latest = analysis.window?.toBlock ?? null;
  if (total === null || total === 0n || latest === null) {
    // Say which read failed: "the token supply or the latest block
    // could not be read" hides whether the chain was unreachable or
    // the address simply has no token code.
    const failed =
      total === null
        ? "totalSupply() read failed on all public RPCs"
        : latest === null
          ? "eth_blockNumber read failed on all public RPCs"
          : "totalSupply() returned zero";
    return finding(
      "holders-unknown",
      "R8",
      "info",
      "Holder distribution could not be read",
      "The token supply or the latest block could not be read, so holder concentration is unknown.",
      [failed],
    );
  }
  const pair = bestPair(pairs);
  if (!pair) {
    return finding(
      "holders-unknown",
      "R8",
      "info",
      "Holder distribution could not be read",
      "There is no trading pair to measure, so holder concentration is unknown rather than guessed.",
      ["dexscreener: no pairs"],
    );
  }
  const pairBalance = await callBalanceOf(tokenAddress, pair.pairAddress);
  if (pairBalance === null) {
    return finding(
      "holders-unknown",
      "R8",
      "info",
      "Holder distribution could not be read",
      "The pair balance could not be read, so holder concentration is unknown rather than guessed.",
      ["balanceOf(pair) read failed on all public RPCs"],
    );
  }
  const pairShare = Number((pairBalance * 10000n) / total) / 100;
  if (pairShare < 10) {
    return finding(
      "holders-outside-pool",
      "R8",
      "medium",
      `Only ${pairShare.toFixed(1)}% of supply sits in the pool`,
      "Most of the token supply is held outside the trading pair, usually by the deployer or early insiders, so a small group can move the price hard.",
      [`pair holds ${pairShare.toFixed(1)}% of total supply`, `pair ${pair.pairAddress}`],
    );
  }
  return finding(
    "holders-in-pool",
    "R8",
    "info",
    `${pairShare.toFixed(1)}% of supply sits in the pool`,
    "This is a pair-share proxy, not a full holder list. A pool share in this range says little about who holds the rest of the supply, so this reading is inconclusive. It does not mean holders are distributed.",
    [`pair holds ${pairShare.toFixed(1)}% of total supply`, `pair ${pair.pairAddress}`],
  );
}

// R9 — liquidity & pair health from Dexscreener.
export function pairHealthFindings(pairs: DexPair[] | null): Finding[] {
  const pair = bestPair(pairs);
  if (!pair) {
    return [
      finding(
        "no-pair",
        "R9",
        "medium",
        "No trading pair, no liquidity",
        "No DEX pair exists for this token, so there is nowhere to sell it right now.",
        ["dexscreener: no pairs"],
      ),
    ];
  }
  const findings: Finding[] = [];
  const liq = pair.liquidity?.usd ?? 0;
  if (liq < 1000) {
    findings.push(
      finding(
        "liquidity-tiny",
        "R9",
        "medium",
        `Liquidity only $${Math.round(liq).toLocaleString()}`,
        "Liquidity is tiny. Even a small sell can move the price hard, and the pool may not survive a large exit.",
        [`liquidity = $${liq}`, `pair ${pair.pairAddress}`],
      ),
    );
  } else if (liq < 10000) {
    findings.push(
      finding(
        "liquidity-thin",
        "R9",
        "low",
        `Liquidity $${Math.round(liq).toLocaleString()}`,
        "Liquidity is thin. Selling a meaningful amount will cost real slippage.",
        [`liquidity = $${liq}`, `pair ${pair.pairAddress}`],
      ),
    );
  } else {
    findings.push(
      finding(
        "liquidity-ok",
        "R9",
        "info",
        `Liquidity $${Math.round(liq).toLocaleString()}`,
        "Liquidity looks workable for normal-sized trades.",
        [`liquidity = $${liq}`, `pair ${pair.pairAddress}`],
      ),
    );
  }
  const buys = pair.txns?.h24?.buys ?? 0;
  const sells = pair.txns?.h24?.sells ?? 0;
  if (buys + sells > 0 && sells > buys * 3) {
    findings.push(
      finding(
        "sell-pressure",
        "R9",
        "low",
        "Heavy sell pressure in the last 24h",
        `Sells (${sells}) outnumber buys (${buys}) more than 3-to-1 in the last 24 hours. Holders are heading for the exit.`,
        [`24h buys = ${buys}, sells = ${sells}`],
      ),
    );
  }
  return findings;
}
