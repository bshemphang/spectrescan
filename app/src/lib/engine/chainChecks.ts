// SpectreScan rules engine — on-chain checks R1, R5–R9 (spec: design.md).
// Every check is defensive: a failed data source produces an "unknown"
// finding (weight 0), never a crash and never a guessed value.

import type { DexPair, Finding } from "./types";
import { weightFor } from "./scoring";
import {
  BURN_ADDRESSES,
  bestPair,
  callBalanceOf,
  callSlot0,
  callTotalSupply,
  ethBlockNumber,
  ethGetLogs,
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
    "Nobody has published the source code for this contract, so its behaviour cannot be read — only its on-chain footprint can be checked.",
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
    // exists only on them. A V3 pool has no LP token to burn-check.
    const slot0 = await callSlot0(pair.pairAddress);
    if (slot0 !== null) {
      return finding(
        "lp-v3-pool",
        "R7",
        "info",
        "Concentrated-liquidity (V3) pool",
        "This pair is a V3-style pool, so there is no LP token to burn or lock. Liquidity sits in concentrated positions owned by individual providers.",
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
    "Almost none of the LP tokens are burned, so whoever holds them can pull the liquidity at any time — the classic rug-pull setup.",
    [`burned LP share = ${share.toFixed(1)}%`, `pair ${pair.pairAddress}`],
  );
}

// R8 — top-holder concentration from a bounded Transfer-log scan.
export async function holderConcentrationFinding(
  tokenAddress: string,
  pairs: DexPair[] | null,
): Promise<Finding> {
  const total = await callTotalSupply(tokenAddress);
  const latest = await ethBlockNumber();
  if (total === null || total === 0n || latest === null) {
    return finding(
      "holders-unknown",
      "R8",
      "info",
      "Holder distribution could not be read",
      "The token supply or the latest block could not be read, so holder concentration is unknown.",
      ["rpc read failed"],
    );
  }
  const pair = bestPair(pairs);
  const excluded = new Set<string>([
    ...BURN_ADDRESSES.map((a) => a.toLowerCase()),
    tokenAddress.toLowerCase(),
    ...(pair ? [pair.pairAddress.toLowerCase()] : []),
  ]);
  const BLOCK_WINDOW = 20000;
  const CHUNK = 2000;
  const fromBlock = Math.max(0, latest - BLOCK_WINDOW);
  const balances = new Map<string, bigint>();
  const deadline = Date.now() + 15000;
  let logsFailed = false;
  try {
    for (let from = fromBlock; from <= latest; from += CHUNK) {
      if (Date.now() > deadline) throw new Error("holder scan timed out");
      const to = Math.min(from + CHUNK - 1, latest);
      const logs = await ethGetLogs(tokenAddress, from, to);
      if (logs === null) throw new Error("eth_getLogs failed");
      for (const log of logs) {
        if (!log.topics || log.topics.length < 3) continue;
        const toAddr = "0x" + log.topics[2].slice(-40).toLowerCase();
        const fromAddr = "0x" + log.topics[1].slice(-40).toLowerCase();
        let value = 0n;
        try {
          value = BigInt(log.data);
        } catch {
          continue;
        }
        if (!excluded.has(toAddr)) {
          balances.set(toAddr, (balances.get(toAddr) ?? 0n) + value);
        }
        if (!excluded.has(fromAddr)) {
          balances.set(fromAddr, (balances.get(fromAddr) ?? 0n) - value);
        }
      }
    }
  } catch {
    logsFailed = true;
  }
  if (logsFailed || balances.size === 0) {
    // Fallback: public BSC RPCs refuse eth_getLogs, so measure the share of
    // supply sitting in the main pair instead. A pair holding only a small
    // slice means most supply sits elsewhere — usually with the deployer.
    if (!pair) {
      return finding(
        "holders-unknown",
        "R8",
        "info",
        "Holder distribution could not be read",
        "The Transfer-log scan failed and there is no trading pair to measure, so holder concentration is unknown rather than guessed.",
        ["eth_getLogs refused by public RPCs", "dexscreener: no pairs"],
      );
    }
    const pairBalance = await callBalanceOf(tokenAddress, pair.pairAddress);
    if (pairBalance === null) {
      return finding(
        "holders-unknown",
        "R8",
        "info",
        "Holder distribution could not be read",
        "The Transfer-log scan failed and the pair balance could not be read, so holder concentration is unknown rather than guessed.",
        ["eth_getLogs refused by public RPCs"],
      );
    }
    const pairShare = Number((pairBalance * 10000n) / total) / 100;
    if (pairShare < 10) {
      return finding(
        "holders-outside-pool",
        "R8",
        "medium",
        `Only ${pairShare.toFixed(1)}% of supply sits in the pool`,
        "Most of the token supply is held outside the trading pair — usually by the deployer or early insiders — so a small group can move the price hard.",
        [`pair holds ${pairShare.toFixed(1)}% of total supply`, `pair ${pair.pairAddress}`],
      );
    }
    return finding(
      "holders-in-pool",
      "R8",
      "info",
      `${pairShare.toFixed(1)}% of supply sits in the pool`,
      "A healthy share of the supply is in the trading pair. (Transfer-log holder data was unavailable, so this is a pair-share proxy, not a full holder list.)",
      [`pair holds ${pairShare.toFixed(1)}% of total supply`, `pair ${pair.pairAddress}`],
    );
  }
  const sorted = [...balances.values()]
    .filter((v) => v > 0n)
    .sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  const top10 = sorted.slice(0, 10).reduce((s, v) => s + v, 0n);
  const share = Number((top10 * 10000n) / total) / 100;
  if (share >= 90) {
    return finding(
      "holders-concentrated",
      "R8",
      "high",
      `Top 10 holders own ${share.toFixed(1)}%`,
      "Almost the whole supply sits in ten wallets. A small group can crash the price by selling together.",
      [`top-10 share = ${share.toFixed(1)}%`, `scanned last ${BLOCK_WINDOW} blocks`],
    );
  }
  if (share >= 50) {
    return finding(
      "holders-mid",
      "R8",
      "medium",
      `Top 10 holders own ${share.toFixed(1)}%`,
      "Over half the supply sits in ten wallets. That is a concentrated holder base with real dump risk.",
      [`top-10 share = ${share.toFixed(1)}%`, `scanned last ${BLOCK_WINDOW} blocks`],
    );
  }
  if (share >= 30) {
    return finding(
      "holders-low",
      "R8",
      "low",
      `Top 10 holders own ${share.toFixed(1)}%`,
      "Holder concentration is moderate — worth watching, but not extreme.",
      [`top-10 share = ${share.toFixed(1)}%`, `scanned last ${BLOCK_WINDOW} blocks`],
    );
  }
  return finding(
    "holders-distributed",
    "R8",
    "info",
    `Top 10 holders own ${share.toFixed(1)}%`,
    "Supply looks reasonably distributed across holders in the scanned window.",
    [`top-10 share = ${share.toFixed(1)}%`, `scanned last ${BLOCK_WINDOW} blocks`],
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
