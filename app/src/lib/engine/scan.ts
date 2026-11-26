// SpectreScan rules engine — scan orchestrator (spec: design.md).
// Runs fetch → checks → score. Each check is wrapped so one failed data
// source never kills the scan; the result always explains what was checked
// and what was unknown.
//
// Context-aware scoring (documented in design.md):
// - A mint function is HIGH when the owner is a wallet or unknown, but
//   MEDIUM when minting is governed by a verified contract (its rules are
//   public code), and one level lower again when a supply cap is visible.
// - "Owner is a contract" is LOW when that contract is verified on
//   Sourcify, HIGH when it is not.
// - Combination rule: deployer-minted supply AND no trading pair upgrades
//   the no-pair finding to HIGH — no exit plus one holder with everything.

import type { Finding, ScanResult } from "./types";
import { bandFor, scoreFindings, weightFor } from "./scoring";
import { analyzeTransfers, checkProxy } from "./holders";
import {
  bestPair,
  callDecimals,
  callName,
  callOwner,
  callSymbol,
  callTotalSupply,
  ethGetCode,
  getDexPairs,
  getSourcifySource,
  isContract,
} from "./fetchers";
import {
  deployerMintCheck,
  mintHasCap,
  runSourceChecks,
} from "./sourceChecks";
import {
  holderConcentrationFinding,
  lpBurnFinding,
  ownerFindings,
  pairHealthFindings,
  verificationFinding,
} from "./chainChecks";

export const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function isValidAddress(address: string): boolean {
  return ADDRESS_RE.test(address.trim());
}

function setSeverity(f: Finding, to: Finding["severity"]): void {
  f.severity = to;
  f.weight = weightFor(to);
}

// Result for a wallet address (EOA): no code at the address, so no
// token checks apply. Score 0 with a single info finding that says so
// in plain words. Never a haunted score, never token findings.
export function buildEoaResult(address: string, scannedAt: string): ScanResult {
  return {
    address,
    chainId: 56,
    scannedAt,
    score: 0,
    band: "Resting in peace",
    token: { name: null, symbol: null, decimals: null, totalSupply: null },
    verified: false,
    verificationStatus: "none",
    findings: [
      {
        id: "not-a-contract",
        check: "R0",
        severity: "info",
        title: "This is a wallet, not a smart contract",
        detail:
          "This address holds no contract code. It is a wallet address, so there is no token logic to read, no owner function to check, and no trading pair to measure. Nothing here can be haunted, and no risk score applies.",
        evidence: ["eth_getCode returned 0x"],
        weight: 0,
      },
    ],
    explanation: null,
    explainerFailed: false,
    sources: { sourcify: false, dexscreener: false, rpc: true },
    isEOA: true,
  };
}

export async function scanContract(rawAddress: string): Promise<ScanResult> {
  const address = rawAddress.trim();
  const startedAt = new Date().toISOString();

  // EOA check first, before any token logic runs: an address with no
  // deployed code is a wallet, not a contract. Scoring it as a haunted
  // token (unverified source, no owner, no pair) is misleading, so the
  // scan stops here with a plain statement instead. When the code read
  // itself fails (null) the address cannot be classified, so the scan
  // proceeds normally and reports what it could and could not read.
  const code = await ethGetCode(address);
  if (code !== null && code === "0x") {
    return buildEoaResult(address, startedAt);
  }

  const findings: Finding[] = [];
  const sources = { sourcify: false, dexscreener: false, rpc: false };

  // Fetch the three data sources in parallel; each may fail independently.
  const [sourcify, pairs, tokenMeta] = await Promise.all([
    getSourcifySource(address),
    getDexPairs(address),
    (async () => {
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        callName(address),
        callSymbol(address),
        callDecimals(address),
        callTotalSupply(address),
      ]);
      if (name !== null || symbol !== null || totalSupply !== null) {
        sources.rpc = true;
      }
      return { name, symbol, decimals, totalSupply };
    })(),
  ]);
  if (sourcify) sources.sourcify = true;
  if (pairs) sources.dexscreener = true;

  // One Transfer-log scan feeds the R8 finding and the whole dossier
  // (bubble map, flow, first seen, first minter). The proxy check
  // reuses the eth_getCode result from the EOA check above, so no
  // second code read is needed.
  const [analysis, proxy] = await Promise.all([
    analyzeTransfers(address, tokenMeta.totalSupply, pairs),
    checkProxy(address, code),
  ]);

  // Owner context: fetched once, reused by the owner check and by the
  // mintable downgrade below.
  const owner = await callOwner(address);
  let ownerIsContract: boolean | null = null;
  let ownerVerified = false;
  if (owner && owner !== ZERO_ADDRESS) {
    ownerIsContract = await isContract(owner);
    if (ownerIsContract === true) {
      // The owner may be the token contract itself (self-owned); its
      // Sourcify status is already known from the token fetch above,
      // so skip the duplicate request and reuse it.
      ownerVerified =
        owner.toLowerCase() === address.toLowerCase()
          ? sourcify !== null
          : (await getSourcifySource(owner)) !== null;
    }
  }

  // R1 — verification status.
  const verificationStatus = sourcify ? sourcify.status : "none";
  findings.push(verificationFinding(verificationStatus));

  // R2–R4 — source-pattern checks (only when source is available).
  if (sourcify) {
    findings.push(...runSourceChecks(sourcify.sources));
    const deployerMint = deployerMintCheck(sourcify.sources);
    if (deployerMint) findings.push(deployerMint);

    // Mintable nuance: governed-by-verified-contract mints score lower,
    // and a visible supply cap lowers them one more level. The cap
    // downgrade only fires on a hardcoded constant (mintHasCap counts
    // only constant / immutable / literal enforced caps, never a mutable
    // variable) — a cap the owner can move is not a cap.
    const mintable = findings.find((f) => f.id === "mintable");
    if (mintable) {
      if (ownerIsContract === true && ownerVerified) {
        setSeverity(mintable, "medium");
        mintable.detail +=
          " Minting here is governed by a verified contract, so the rules are public code rather than one person's discretion.";
        if (mintHasCap(sourcify.sources)) {
          setSeverity(mintable, "low");
          mintable.detail += " A visible supply cap limits it further.";
        }
      } else if (mintHasCap(sourcify.sources)) {
        setSeverity(mintable, "medium");
        mintable.detail += " A visible supply cap limits how much can be minted.";
      }
    }
  }

  // R5/R6 — owner checks (with the verification context).
  try {
    findings.push(
      ...(await ownerFindings(address, owner, ownerIsContract, ownerVerified)),
    );
  } catch {
    findings.push({
      id: "owner-unknown",
      check: "R5",
      severity: "info",
      title: "Owner check failed",
      detail: "The owner() call failed, so ownership status is unknown.",
      evidence: ["eth_call owner() failed"],
      weight: 0,
    });
  }

  // R7 — LP burn share.
  try {
    findings.push(await lpBurnFinding(address, pairs));
  } catch {
    // lpBurnFinding already degrades to "unknown" internally; this is a
    // last-resort guard so the scan never throws.
  }

  // R8 — holder concentration (log scan with pair-share fallback).
  try {
    findings.push(
      await holderConcentrationFinding(analysis, address, pairs),
    );
  } catch {
    // Same guard as above.
  }

  // R9 — pair health.
  findings.push(...pairHealthFindings(pairs));

  // Combination rule: the deployer minted the whole (or almost the whole)
  // supply AND there is no trading pair — no exit, one holder with
  // everything. Upgrade no-pair.
  const deployerMint = findings.find((f) => f.id === "deployer-mint");
  const noPair = findings.find((f) => f.id === "no-pair");
  if (deployerMint && noPair) {
    // The deployer-mint finding carries a structured majority flag
    // (90%+ of the supply, not the whole supply); the wording follows
    // the flag, never a title-string match.
    const almost = deployerMint.majority === true;
    setSeverity(noPair, "high");
    noPair.title = almost
      ? "No trading pair, and the deployer holds almost everything"
      : "No trading pair, and the deployer holds everything";
    noPair.detail = almost
      ? "No DEX pair exists for this token, so there is nowhere to sell it, and almost the whole supply was minted to the deployer's wallet at launch. Even if a pair appears later, one address holds nearly the entire supply."
      : "No DEX pair exists for this token, so there is nowhere to sell it, and the whole supply was minted to the deployer's wallet at launch. Even if a pair appears later, one address holds the entire supply.";
  }

  const score = scoreFindings(findings);
  return {
    address,
    chainId: 56,
    scannedAt: startedAt,
    score,
    band: bandFor(score),
    token: {
      name: tokenMeta.name,
      symbol: tokenMeta.symbol,
      decimals: tokenMeta.decimals,
      totalSupply: tokenMeta.totalSupply?.toString() ?? null,
    },
    verified: sourcify !== null,
    verificationStatus,
    findings,
    explanation: null,
    explainerFailed: false,
    sources,
    dossier: { analysis, proxy, pair: bestPair(pairs) },
  };
}
