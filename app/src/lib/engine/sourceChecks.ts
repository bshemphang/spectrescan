// SpectreScan rules engine — source-pattern checks R2–R4 (spec: design.md).
// Pattern matches on verified source text only; every hit carries the exact
// file:line evidence. No source → no guesses (callers report "unknown").
//
// Honesty rules for the cap checks (Kira deep review, 2026-11-26):
//  - A cap only counts when it is enforced where the power is used: the
//    require must sit inside the setter / mint function body, not anywhere
//    in the file, and never in a comment. Comments are stripped (with line
//    numbers preserved) before the cap checks run.
//  - A cap of 100 percent is not a cap: a fee bound of 100 (percent) or
//    10000 (basis points) does not count.
//  - A supply cap only counts when it is backed by a hardcoded constant:
//    a `constant` / `immutable` declaration, a numeric literal bound, or
//    an ERC20Capped inheritance with a literal cap. A mutable state
//    variable does not count.

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
    id: "pausable",
    title: "Owner can pause transfers",
    detail:
      "The contract can be paused by the owner, freezing all transfers until it is unpaused. Holders cannot exit while paused.",
    severity: "medium",
    regex: /function\s+pause\s*\(|contract\s+\w+\s+is\s+[^{]*Pausable|whenNotPaused/i,
  },
];

// The mintable check is not in PATTERNS: its regex must see the function
// visibility, so it runs on the whole file text (see findPublicMintLines).
const MINTABLE = {
  id: "mintable",
  title: "Owner can mint new tokens",
  detail:
    "The contract has a public mint function. The owner can create new supply at any time, diluting every existing holder.",
  severity: "high" as const,
  check: "R3",
};

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

/** Lines of public/external `mint` functions. Visibility is checked in the
 *  function header (up to the opening brace), so internal/private mint
 *  helpers are never flagged — the detail text says "public mint function"
 *  and the code must match. The pattern spans newlines, so multi-line
 *  signatures are handled. */
function findPublicMintLines(content: string): number[] {
  const re = /function\s+mint\s*\([^)]*\)\s*(public|external)\b/gi;
  const lines: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    lines.push(content.slice(0, m.index).split("\n").length);
    if (lines.length >= 3) break;
  }
  return lines;
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
        check: pattern.id === "pausable" ? "R4" : "R2",
        severity: pattern.severity,
        title: pattern.title,
        detail: pattern.detail,
        evidence: evidence.slice(0, 3),
        weight: weightFor(pattern.severity),
      });
    }
  }
  // Mintable, with the visibility check (comments stripped so a
  // commented-out mint never flags; line numbers stay aligned).
  const mintEvidence: string[] = [];
  for (const file of sources) {
    const lines = findPublicMintLines(stripComments(file.content));
    for (const line of lines) mintEvidence.push(`${file.path}:${line}`);
    if (mintEvidence.length >= 3) break;
  }
  if (mintEvidence.length > 0) {
    findings.push({
      id: MINTABLE.id,
      check: MINTABLE.check,
      severity: MINTABLE.severity,
      title: MINTABLE.title,
      detail: MINTABLE.detail,
      evidence: mintEvidence.slice(0, 3),
      weight: weightFor(MINTABLE.severity),
    });
  }
  return findings;
}

// ------------------------------------------------------------
// Shared helpers for the cap checks
// ------------------------------------------------------------

/** Remove // and block comments, replacing them with spaces so line
 *  numbers (and therefore evidence) stay aligned. String literals that
 *  contain "//" (e.g. URLs) are also blanked; the scanned function bodies
 *  do not contain any. */
function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
}

/** Body of a function whose signature starts at `sigIndex`: the text from
 *  its opening `{` to the matching `}`. Null when the body cannot be
 *  found. */
function extractBody(
  content: string,
  sigIndex: number,
): { body: string; start: number } | null {
  const open = content.indexOf("{", sigIndex);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < content.length; i++) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") {
      depth--;
      if (depth === 0) return { body: content.slice(open, i + 1), start: open };
    }
  }
  return null;
}

/** Bodies of every function whose signature matches `nameRe` (e.g.
 *  constructor or initialize), in file order. The signature text (from
 *  the function keyword to the opening brace) is included so callers can
 *  read parameter names. */
function namedFunctionBodies(
  content: string,
  nameRe: RegExp,
): { body: string; start: number; signature: string }[] {
  const out: { body: string; start: number; signature: string }[] = [];
  const re = new RegExp(
    nameRe.source,
    nameRe.flags.includes("g") ? nameRe.flags : nameRe.flags + "g",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const body = extractBody(content, m.index);
    if (body) {
      out.push({ ...body, signature: content.slice(m.index, body.start) });
    }
  }
  return out;
}

/** Argument strings of every require(...) call in `text`, matched with
 *  paren counting so nested calls do not break the parse. */
function requireArgs(text: string): string[] {
  const out: string[] = [];
  const re = /require\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const open = m.index + m[0].length - 1; // index of "("
    let depth = 0;
    for (let i = open; i < text.length; i++) {
      if (text[i] === "(") depth++;
      else if (text[i] === ")") {
        depth--;
        if (depth === 0) {
          out.push(text.slice(open + 1, i));
          break;
        }
      }
    }
  }
  return out;
}

/** Raw initializer of `NAME = <expr>;` in the file, or null when the name
 *  has no visible initializer. The `(?!=)` keeps `==` comparisons out. */
function constantInitializer(content: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=(?!=)\\s*([^;]+);`);
  const m = content.match(re);
  return m ? m[1].trim() : null;
}

/** Numeric value of a `NAME = <number>` declaration, or null when the
 *  value cannot be seen in this file. */
function lookupNumericDeclaration(content: string, name: string): number | null {
  const init = constantInitializer(content, name);
  if (init === null) return null;
  const num = init.match(/^([0-9][0-9_]*)/);
  return num ? Number(num[1].replace(/_/g, "")) : null;
}

/** Whether the declaration of `name` carries `constant` or `immutable`
 *  in the same statement. */
function isConstantOrImmutable(content: string, name: string): boolean {
  const re = new RegExp(`\\b${name}\\s*=(?!=)`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const start = Math.max(
      content.lastIndexOf(";", m.index),
      content.lastIndexOf("{", m.index),
      content.lastIndexOf("\n", m.index),
    );
    const segment = content.slice(start + 1, m.index);
    if (/\b(constant|immutable)\b/.test(segment)) return true;
  }
  return false;
}

function normalizeExpr(expr: string): string {
  return expr.replace(/[\s_]/g, "").toLowerCase();
}

/** The initial-supply expression, if it can be seen: the initializer of a
 *  TOTAL_SUPPLY / INITIAL_SUPPLY constant. Used to spot a cap that is
 *  exactly the initial supply — a 100 percent cap. */
function initialSupplyExpr(content: string): string | null {
  const m = content.match(
    /\b(?:TOTAL_SUPPLY|INITIAL_SUPPLY|_totalSupply)\s*=(?!=)\s*([^;]+);/,
  );
  return m ? normalizeExpr(m[1]) : null;
}

// ------------------------------------------------------------
// Fee cap (fix 1)
// ------------------------------------------------------------

/** Check whether a fee setter has a visible cap (e.g. require(fee <= 25)).
 *  Only a require inside the setter function body counts, and a bound of
 *  100 (percent) or 10000 (basis points) — a 100 percent cap — does not.
 *  A named bound only counts when its declaration with a numeric value is
 *  visible in the same file. */
export function feeHasCap(sources: SourceFile[]): boolean {
  for (const file of sources) {
    const content = stripComments(file.content);
    const setters = namedFunctionBodies(
      content,
      /function\s+\w*(set|update)\w*(Fee|Tax)\w*\s*\(/i,
    );
    for (const fn of setters) {
      if (setterBodyHasFeeCap(fn.signature, fn.body, content)) return true;
    }
  }
  return false;
}

function setterBodyHasFeeCap(
  signature: string,
  body: string,
  fileContent: string,
): boolean {
  // The fee value is either a fee/tax-named variable or one of the
  // setter's parameters (setters often take a short name like `f`).
  const params = new Set<string>();
  const paren = signature.match(/\(([^)]*)\)/);
  if (paren) {
    for (const part of paren[1].split(",")) {
      const name = part.trim().split(/\s+/).pop();
      if (name) params.add(name);
    }
  }
  for (const args of requireArgs(body)) {
    const m = args.match(
      /([A-Za-z_][A-Za-z0-9_]*)\s*(<=|<)\s*([A-Za-z_][A-Za-z0-9_]*|[0-9][0-9_]*)/,
    );
    if (!m) continue;
    const lhs = m[1];
    if (!/fee|tax/i.test(lhs) && !params.has(lhs)) continue;
    const bound = m[3];
    if (/^[0-9]/.test(bound)) {
      const value = Number(bound.replace(/_/g, ""));
      // 100 (percent) and 10000 (basis points) both mean 100 percent.
      if (value !== 100 && value !== 10000) return true;
    } else {
      const declared = lookupNumericDeclaration(fileContent, bound);
      if (declared !== null && declared !== 100 && declared !== 10000) return true;
    }
  }
  return false;
}

// ------------------------------------------------------------
// Mint cap (fixes 1 and 4)
// ------------------------------------------------------------

/** Check whether minting has a visible, enforced supply cap.
 *  A cap only counts when it is backed by a hardcoded constant and
 *  enforced where minting happens:
 *   - an ERC20Capped inheritance with a literal cap argument, or
 *   - a require in a mint / _mint body bounding totalSupply() + amount by
 *     a `constant` / `immutable` cap or a numeric literal bound.
 *  A cap held in a mutable state variable does not count (fix 4), and a
 *  cap equal to the initial supply (a 100 percent cap) does not count. */
export function mintHasCap(sources: SourceFile[]): boolean {
  for (const file of sources) {
    const content = stripComments(file.content);
    if (erc20CappedWithLiteralCap(content)) return true;
    const mintBodies = [
      ...namedFunctionBodies(content, /function\s+mint\s*\(/i),
      ...namedFunctionBodies(content, /function\s+_mint\s*\(/i),
    ];
    for (const { body } of mintBodies) {
      if (mintBodyHasEnforcedCap(body, content)) return true;
    }
  }
  return false;
}

function erc20CappedWithLiteralCap(content: string): boolean {
  const m = content.match(/ERC20Capped\s*\(\s*([^)]*)\)/);
  if (!m) return false;
  const arg = m[1].trim();
  if (/^[0-9]/.test(arg)) return true; // literal cap, e.g. 1000000 * 10**18
  const declared = lookupNumericDeclaration(content, arg);
  return declared !== null;
}

function mintBodyHasEnforcedCap(body: string, fileContent: string): boolean {
  for (const args of requireArgs(body)) {
    const m = args.match(
      /(?:totalSupply\s*\(\s*\)|_totalSupply|total_?supply)\s*\+\s*\w+\s*(<=|<)\s*([A-Za-z_][A-Za-z0-9_]*|[0-9][0-9_]*)\s*(?:\(\))?/i,
    );
    if (!m) continue;
    const bound = m[2];
    if (/^[0-9]/.test(bound)) return true; // hardcoded literal bound
    if (bound === "cap") {
      // ERC20Capped's cap() accessor: only counts with a literal cap.
      if (erc20CappedWithLiteralCap(fileContent)) return true;
      continue;
    }
    // Named bound: only a constant / immutable counts (fix 4).
    if (!isConstantOrImmutable(fileContent, bound)) continue;
    const init = constantInitializer(fileContent, bound);
    if (init === null) continue;
    // A cap equal to the initial supply is a 100 percent cap.
    const initial = initialSupplyExpr(fileContent);
    if (initial !== null && normalizeExpr(init) === initial) continue;
    return true;
  }
  return false;
}

// ------------------------------------------------------------
// Deployer mint (fix 5)
// ------------------------------------------------------------

/**
 * Deployer-mint check: does the contract hand the ENTIRE supply to one
 * address at launch? Detects the pattern where the total supply is
 * assigned to the deployer's balance — the SELO shape: one wallet starts
 * out holding 100% of the token.
 *
 * A majority mint (90% or more, e.g. `totalSupply * 99 / 100` with the
 * rest to a fee address) counts too, with an "almost the entire supply"
 * title, since one address still starts out holding nearly everything.
 * A 50/50 split or a small deployer share does not count.
 *
 * Searched in the constructor AND in initialize() functions (proxy
 * pattern), and the supply variable may be declared at the top level
 * (a state-var initializer) rather than inside the function body.
 * A single _mint to msg.sender of a hardcoded amount also counts, since
 * that is the only initial mint.
 */
export function deployerMintCheck(sources: SourceFile[]): Finding | null {
  for (const file of sources) {
    const content = stripComments(file.content);
    const bodies = [
      ...namedFunctionBodies(content, /constructor\s*\(/).map((b) => ({
        ...b,
        label: "constructor",
      })),
      ...namedFunctionBodies(content, /function\s+initialize\s*\(/).map((b) => ({
        ...b,
        label: "initialize()",
      })),
    ];
    // Supply variables declared at the top level (state-var initializers).
    const fileSupplyVars = new Set<string>();
    for (const m of content.matchAll(
      /\b(?:total_?supply|TOTAL_SUPPLY|_totalSupply|supply)\b\s*=(?!=)/gi,
    )) {
      fileSupplyVars.add(m[0].split(/\s*=/)[0].trim());
    }
    for (const { body, start, label } of bodies) {
      const hit = checkDeployerMintBody(content, body, start, fileSupplyVars);
      if (hit) {
        return {
          id: "deployer-mint",
          check: "R2",
          severity: "high",
          title: hit.majority
            ? "Almost the entire supply minted to the deployer at launch"
            : "Entire supply minted to the deployer at launch",
          detail: hit.majority
            ? `The ${label} hands almost the whole token supply (90% or more) to the deployer's wallet. One address starts out holding nearly everything and can sell it all at any time.`
            : `The ${label} hands the whole token supply to the deployer's wallet. One address starts out holding 100% of the supply and can sell it all at any time.`,
          evidence: [`${file.path}:${hit.line}`],
          weight: weightFor("high"),
          majority: hit.majority,
        };
      }
    }
  }
  return null;
}

function checkDeployerMintBody(
  content: string,
  body: string,
  bodyStart: number,
  fileSupplyVars: Set<string>,
): { line: number; majority: boolean } | null {
  const lineOf = (indexInBody: number): number =>
    content.slice(0, bodyStart).split("\n").length +
    body.slice(0, indexInBody).split("\n").length -
    1;

  // Supply variables: assigned inside this body, or declared at file level.
  const supplyVars = new Set<string>(fileSupplyVars);
  for (const m of body.matchAll(
    /(?:total_?|totalSupply|_total|supply)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\b/g,
  )) {
    supplyVars.add(m[1]);
  }
  // Also capture a supply variable assigned a numeric literal in this
  // body (`supply = 1000000`): the variable still names the deployer's
  // supply even though the right-hand side is not another variable, so
  // a later `_mint(msg.sender, supply)` must still count. The left-hand
  // alternation matches the one above (`total`, `_total`, `total_`
  // included) — those names are exactly the ones the file-level set
  // does not cover.
  for (const m of body.matchAll(
    /\b(?:total_?|totalSupply|_total|supply|TOTAL_SUPPLY)\b\s*=\s*[0-9]/g,
  )) {
    supplyVars.add(m[0].split(/\s*=/)[0].trim());
  }

  // (a) A supply variable handed to msg.sender's balance or minted to it.
  // If a `*` or `-` follows the variable, the deployer gets only part of
  // the supply; case (d) decides whether it is still a majority mint.
  for (const v of supplyVars) {
    const deployerAssign = new RegExp(
      `balances?_?\\s*\\[\\s*msg\\.sender\\s*\\]\\s*=\\s*${v}\\b`,
    );
    const assignMatch = body.match(deployerAssign);
    if (assignMatch && assignMatch.index !== undefined) {
      const after = body
        .slice(assignMatch.index + assignMatch[0].length)
        .trimStart();
      if (!after.startsWith("*") && !after.startsWith("-")) {
        return { line: lineOf(assignMatch.index), majority: false };
      }
    }
    const mintCall = new RegExp(`_mint\\(msg\\.sender,\\s*${v}\\b`);
    const mintMatch = body.match(mintCall);
    if (mintMatch && mintMatch.index !== undefined) {
      const after = body
        .slice(mintMatch.index + mintMatch[0].length)
        .trimStart();
      if (!after.startsWith("*") && !after.startsWith("-")) {
        return { line: lineOf(mintMatch.index), majority: false };
      }
    }
  }

  // (b) A single _mint to msg.sender of a hardcoded amount: the only
  // initial mint, so the deployer starts out holding everything.
  const mintCalls = [...body.matchAll(/_mint\s*\(\s*([^,]+),/g)];
  if (mintCalls.length === 1) {
    const recipient = mintCalls[0][1].trim();
    if (recipient === "msg.sender") {
      const amount = body.slice(mintCalls[0].index! + mintCalls[0][0].length);
      const amountHead = amount.trim();
      // Hardcoded amount: a literal, or a file-level constant.
      if (
        /^[0-9]/.test(amountHead) ||
        /^[A-Z][A-Z0-9_]*\b/.test(amountHead)
      ) {
        return { line: lineOf(mintCalls[0].index!), majority: false };
      }
    }
  }

  // (c) A single direct balance assignment of a hardcoded amount.
  const balAssigns = [...body.matchAll(/balances?_?\s*\[\s*msg\.sender\s*\]\s*=\s*([0-9][0-9_]*)/g)];
  if (balAssigns.length === 1) {
    const otherAssigns = [...body.matchAll(/balances?_?\s*\[/g)].length;
    if (otherAssigns === 1) return { line: lineOf(balAssigns[0].index!), majority: false };
  }

  // (d) A mint to msg.sender of a large fraction of the supply (>= 90%):
  // `totalSupply * 99 / 100`, `supply * 95 / 100`, or `totalSupply - fee`.
  // The deployer still starts out holding almost everything; the rest
  // is usually a fee address, not distribution. Parentheses are allowed
  // around the fraction (`(totalSupply * 90) / 100`, or the whole
  // expression wrapped), and spacing is optional (`totalSupply*9/10`).
  for (const v of supplyVars) {
    const frac = new RegExp(
      `_mint\\(msg\\.sender,\\s*\\(?\\s*${v}\\s*\\*\\s*(\\d+)\\s*\\)?\\s*/\\s*(\\d+)\\s*\\)?`,
    );
    const fm = body.match(frac);
    if (fm) {
      const num = Number(fm[1]);
      const den = Number(fm[2]);
      if (den > 0 && num / den >= 0.9 && num / den < 1) {
        return { line: lineOf(fm.index!), majority: true };
      }
    }
    const minus = new RegExp(`_mint\\(msg\\.sender,\\s*${v}\\s*-\\s*`);
    const mm = body.match(minus);
    if (mm) return { line: lineOf(mm.index!), majority: true };
    const fracAssign = new RegExp(
      `balances?_?\\s*\\[\\s*msg\\.sender\\s*\\]\\s*=\\s*\\(?\\s*${v}\\s*\\*\\s*(\\d+)\\s*\\)?\\s*/\\s*(\\d+)\\s*\\)?`,
    );
    const fa = body.match(fracAssign);
    if (fa) {
      const num = Number(fa[1]);
      const den = Number(fa[2]);
      if (den > 0 && num / den >= 0.9 && num / den < 1) {
        return { line: lineOf(fa.index!), majority: true };
      }
    }
  }

  // (e) Two hardcoded mints: a large one to msg.sender and a small one
  // elsewhere. Compare the leading literals; flag when the deployer's
  // share of the two combined is >= 90%.
  if (mintCalls.length === 2) {
    const amounts = mintCalls.map((m) => {
      const after = body.slice(m.index! + m[0].length).trim();
      const lit = after.match(/^([0-9][0-9_]*)/);
      return {
        recipient: m[1].trim(),
        value: lit ? Number(lit[1].replace(/_/g, "")) : null,
        index: m.index!,
      };
    });
    const mine = amounts.find((a) => a.recipient === "msg.sender");
    const other = amounts.find((a) => a.recipient !== "msg.sender");
    if (
      mine && other &&
      mine.value !== null && other.value !== null &&
      other.value > 0 &&
      mine.value / (mine.value + other.value) >= 0.9
    ) {
      return { line: lineOf(mine.index), majority: true };
    }
  }

  return null;
}
