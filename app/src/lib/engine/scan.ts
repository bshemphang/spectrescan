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
import {
  callDecimals,
  callName,
  callOwner,
  callSymbol,
  callTotalSupply,
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

export async function scanContract(rawAddress: string): Promise<ScanResult> {
  const address = rawAddress.trim();
  const startedAt = new Date().toISOString();
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

  // Owner context: fetched once, reused by the owner check and by the
  // mintable downgrade below.
  const owner = await callOwner(address);
  let ownerIsContract: boolean | null = null;
  let ownerVerified = false;
  if (owner && owner !== ZERO_ADDRESS) {
    ownerIsContract = await isContract(owner);
    if (ownerIsContract === true) {
      ownerVerified = (await getSourcifySource(owner)) !== null;
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
    // and a visible supply cap lowers them one more level.
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
    findings.push(await holderConcentrationFinding(address, pairs));
  } catch {
    // Same guard as above.
  }

  // R9 — pair health.
  findings.push(...pairHealthFindings(pairs));

  // Combination rule: the deployer minted the whole supply AND there is no
  // trading pair — no exit, one holder with everything. Upgrade no-pair.
  const hasDeployerMint = findings.some((f) => f.id === "deployer-mint");
  const noPair = findings.find((f) => f.id === "no-pair");
  if (hasDeployerMint && noPair) {
    setSeverity(noPair, "high");
    noPair.title = "No trading pair — and the deployer holds everything";
    noPair.detail =
      "No DEX pair exists for this token, so there is nowhere to sell it, and the whole supply was minted to the deployer's wallet at launch. Even if a pair appears later, one address holds the entire supply.";
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
  };
}
