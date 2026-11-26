// SpectreScan rules engine — source-pattern checks R2–R4 (spec: design.md).
// Pattern matches on verified source text only; every hit carries the exact
// file:line evidence. No source → no guesses (callers report "unknown").

import type { Finding, SourceFile } from "./types";
import { weightFor } from "./scoring";

interface Pattern {
  id: string;
  title: string;
  detail: string;
  severity: Finding["severity"];
  regex: RegExp;
}

const PATTERNS: Pattern[] = [
  {
    id: "honeypot-blacklist",
    title: "Blacklist function present",
    detail:
      "The contract can blacklist wallets, so the owner can block specific holders from selling. This is a classic honeypot mechanism.",
    severity: "high",
    regex: /blacklist/i,
  },
  {
    id: "trading-gate",
    title: "Owner-controlled trading switch",
    detail:
      "Trading can be enabled or disabled by the owner. If trading is off at launch, early buyers can be trapped until the owner decides to open it.",
    severity: "high",
    regex: /tradingEnabled|tradingOpen|enableTrading|startTrading|tradingActive/i,
  },
  {
    id: "max-tx-wallet",
    title: "Owner can change max transaction / wallet limits",
    detail:
      "The contract has max-transaction or max-wallet limits the owner can change. Tightening them after launch can stop holders from selling.",
    severity: "medium",
    regex: /maxTxAmount|maxWallet|maxTx\b|_maxTxAmount|maxWalletAmount/i,
  },
  {
    id: "fee-setter",
    title: "Owner can change buy/sell fees",
    detail:
      "The contract lets the owner change trading fees. Without a cap in the code, fees could be raised to a level where selling is pointless.",
    severity: "medium",
    regex: /function\s+\w*(set|update)\w*(Fee|Tax)\w*\s*\(/i,
  },
  {
    id: "mintable",
    title: "Owner can mint new tokens",
    detail:
      "The contract has a public mint function. The owner can create new supply at any time, diluting every existing holder.",
    severity: "high",
    regex: /function\s+mint\s*\(/i,
  },
  {
    id: "pausable",
    title: "Owner can pause transfers",
    detail:
      "The contract can be paused by the owner, freezing all transfers until it is unpaused. Holders cannot exit while paused.",
    severity: "medium",
    regex: /function\s+pause\s*\(|contract\s+\w+\s+is\s+[^{]*Pausable|whenNotPaused/i,
  },
];

function findLines(content: string, regex: RegExp): number[] {
  const lines = content.split("\n");
  const hits: number[] = [];
  const global = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
  for (let i = 0; i < lines.length; i++) {
    global.lastIndex = 0;
    if (global.test(lines[i])) hits.push(i + 1);
    if (hits.length >= 3) break;
  }
  return hits;
}

/** Run all source-pattern checks against verified source files. */
export function runSourceChecks(sources: SourceFile[]): Finding[] {
  const findings: Finding[] = [];
  for (const pattern of PATTERNS) {
    const evidence: string[] = [];
    for (const file of sources) {
      const lines = findLines(file.content, pattern.regex);
      for (const line of lines) evidence.push(`${file.path}:${line}`);
      if (evidence.length >= 3) break;
    }
    if (evidence.length > 0) {
      findings.push({
        id: pattern.id,
        check: pattern.id === "mintable" ? "R3" : pattern.id === "pausable" ? "R4" : "R2",
        severity: pattern.severity,
        title: pattern.title,
        detail: pattern.detail,
        evidence: evidence.slice(0, 3),
        weight: weightFor(pattern.severity),
      });
    }
  }
  return findings;
}

/** Check whether a fee setter has a visible cap (e.g. require(fee <= 25)). */
export function feeHasCap(sources: SourceFile[]): boolean {
  const joined = sources.map((s) => s.content).join("\n");
  return /require\s*\(\s*\w*(fee|tax)\w*\s*<=/i.test(joined);
}

/** Check whether minting has a visible supply cap (e.g. maxSupply). */
export function mintHasCap(sources: SourceFile[]): boolean {
  const joined = sources.map((s) => s.content).join("\n");
  return /maxSupply|MAX_SUPPLY|supplyCap|_cap\b/i.test(joined);
}

/**
 * Deployer-mint check: does the constructor hand the ENTIRE supply to one
 * address (msg.sender)? Detects the pattern where a variable is assigned to
 * the total supply AND to the deployer's balance in the constructor — the
 * SELO shape: one wallet starts out holding 100% of the token.
 */
export function deployerMintCheck(sources: SourceFile[]): Finding | null {
  for (const file of sources) {
    const content = file.content;
    const ctorIndex = content.search(/constructor\s*\(/);
    if (ctorIndex === -1) continue;
    // Extract the constructor body with brace matching.
    const open = content.indexOf("{", ctorIndex);
    if (open === -1) continue;
    let depth = 0;
    let close = -1;
    for (let i = open; i < content.length; i++) {
      if (content[i] === "{") depth++;
      else if (content[i] === "}") {
        depth--;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }
    if (close === -1) continue;
    const body = content.slice(open, close + 1);
    const bodyLines = body.split("\n");
    // Find a variable assigned to the total supply and to msg.sender's balance.
    const totalAssign = body.match(
      /(?:total_?|totalSupply|_total|supply)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\b/,
    );
    if (!totalAssign) continue;
    const supplyVar = totalAssign[1];
    const deployerAssign = new RegExp(
      `balances?_?\\s*\\[\\s*msg\\.sender\\s*\\]\\s*=\\s*${supplyVar}\\b`,
    );
    const mintCall = new RegExp(`_mint\\(msg\\.sender,\\s*${supplyVar}\\b`);
    const hitLine = bodyLines.findIndex(
      (l) => deployerAssign.test(l) || mintCall.test(l),
    );
    if (hitLine === -1) continue;
    const absLine =
      content.slice(0, open).split("\n").length + hitLine;
    return {
      id: "deployer-mint",
      check: "R2",
      severity: "high",
      title: "Entire supply minted to the deployer at launch",
      detail:
        "The constructor hands the whole token supply to the deployer's wallet. One address starts out holding 100% of the supply and can sell it all at any time.",
      evidence: [`${file.path}:${absLine}`],
      weight: weightFor("high"),
    };
  }
  return null;
}
