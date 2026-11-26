// SpectreScan rules engine — types (spec: .kiro/specs/spectrescan/design.md)

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface Finding {
  id: string;
  check: string; // R1..R9
  severity: Severity;
  title: string;
  detail: string; // plain English, one or two sentences
  evidence: string[]; // file:line refs or on-chain values
  weight: number; // contribution to the risk score (fixed per severity)
}

export type RiskBand =
  | "Resting in peace"
  | "Mildly haunted"
  | "Haunted"
  | "Possessed — do not touch";

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
  explanation: string | null; // LLM verdict (null when the explainer failed)
  explainerFailed: boolean;
  sources: {
    sourcify: boolean;
    dexscreener: boolean;
    rpc: boolean;
  };
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
