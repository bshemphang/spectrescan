// SpectreScan rules engine — types (spec: .kiro/specs/spectrescan/design.md)

import type { ProxyInfo, TransferAnalysis } from "./holders";

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface Finding {
  id: string;
  check: string; // R1..R9
  severity: Severity;
  title: string;
  detail: string; // plain English, one or two sentences
  evidence: string[]; // file:line refs or on-chain values
  weight: number; // contribution to the risk score (fixed per severity)
  // True when this finding describes a majority (90%+) rather than the
  // whole supply — set only by the deployer-mint check. The scan
  // orchestrator reads this flag for the no-pair combination rule; it
  // never keys off the title text.
  majority?: boolean;
}

export type RiskBand =
  | "Resting in peace"
  | "Mildly haunted"
  | "Haunted"
  | "Possessed";

export interface ScanResult {
  address: string;
  chainId: number;
  scannedAt: string; // ISO timestamp
  score: number; // 0–100, deterministic from findings
  band: RiskBand;
  token: {
    name: string | null;
    symbol: string | null;
    decimals: number | null;
    totalSupply: string | null; // raw uint256 string
  };
  verified: boolean;
  verificationStatus: "perfect" | "partial" | "none";
  findings: Finding[];
  explanation: string | null; // LLM verdict, or the local verdict when the explainer failed
  explainerFailed: boolean;
  // True when the shown verdict was written from the findings by
  // buildLocalVerdict because the LLM explainer failed. The score
  // and findings are identical either way; the UI labels it so the
  // reader knows no model wrote it, and offers a retry for the
  // ghost's version.
  explanationLocal?: boolean;
  // True when the scanned address holds no contract code: it is a
  // wallet (EOA), not a smart contract. No token checks ran and the
  // score is 0, not a haunting verdict. The UI renders a dedicated
  // "not a contract" panel instead of the meter and findings.
  isEOA?: boolean;
  // The address dossier: transfer analysis, proxy status, and the
  // best-liquidity pair. Absent for wallets (no dossier) and null
  // when the dossier reads failed outright. Everything inside it is
  // window-scoped to the last 20,000 blocks unless labelled otherwise.
  dossier?: DossierData | null;
  sources: {
    sourcify: boolean;
    dexscreener: boolean;
    rpc: boolean;
  };
}

export interface DossierData {
  analysis: TransferAnalysis;
  proxy: ProxyInfo;
  pair: DexPair | null;
}

export interface SourceFile {
  path: string;
  content: string;
}

export interface DexPair {
  chainId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  liquidity?: { usd?: number; base?: number; quote?: number };
  volume?: { h24?: number; h1?: number };
  txns?: { h24?: { buys?: number; sells?: number } };
  pairCreatedAt?: number;
  dexId?: string;
}
