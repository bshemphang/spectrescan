// SpectreScan rules engine — data fetchers (spec: design.md).
// All sources are public and keyless. Every call has a timeout and a
// fallback; a failed source returns null and the caller reports "unknown".

import type { DexPair, SourceFile } from "./types";

export const BSC_CHAIN_ID = 56;

const RPC_URLS = [
  "https://bsc-dataseed1.bnbchain.org",
  "https://bsc-dataseed2.bnbchain.org",
  "https://bsc-dataseed.bnbchain.org",
  "https://bsc.publicnode.com",
];

// eth_getLogs is the odd one out: the Binance dataseeds refuse it
// outright ("limit exceeded", even for a 500-block range), and the
// other public endpoints either time out, block it, or rate-limit.
// Only bsc.publicnode.com answers logs at all, and it rate-limits
// after a couple of rapid calls. So log reads try PublicNode first
// (one attempt each: a rate-limit error is not fixed by an immediate
// retry) and the dataseeds only as a fast-failing fallback.
const LOG_RPC_URLS = [
  "https://bsc.publicnode.com",
  "https://bsc-dataseed1.bnbchain.org",
  "https://bsc-dataseed2.bnbchain.org",
  "https://bsc-dataseed.bnbchain.org",
];

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const DEAD = "0x000000000000000000000000000000000000dEaD";
const ZERO = "0x0000000000000000000000000000000000000000";

export const BURN_ADDRESSES = [DEAD, ZERO];

export async function fetchWithTimeout(
  url: string,
  ms: number,
  init?: RequestInit,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------- Sourcify

export interface SourcifyResult {
  status: "perfect" | "partial";
  sources: SourceFile[];
}

export async function getSourcifySource(
  address: string,
): Promise<SourcifyResult | null> {
  const url = `https://sourcify.dev/server/v2/contract/${BSC_CHAIN_ID}/${address}?fields=sources`;
  try {
    const res = await fetchWithTimeout(url, 15000);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      status?: string;
      sources?: Record<string, { content?: string }>;
    };
    if (!json.sources) return null;
    const sources: SourceFile[] = Object.entries(json.sources)
      .filter(([, v]) => typeof v?.content === "string")
      .map(([path, v]) => ({ path, content: v.content as string }));
    if (sources.length === 0) return null;
    return {
      status: json.status === "perfect" ? "perfect" : "partial",
      sources,
    };
  } catch {
    return null;
  }
}

// -------------------------------------------------------------- Dexscreener

export async function getDexPairs(address: string): Promise<DexPair[] | null> {
  const url = `https://api.dexscreener.com/tokens/v1/bsc/${address}`;
  try {
    const res = await fetchWithTimeout(url, 15000);
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json)) return null;
    return json.filter((p) => p && p.chainId === "bsc") as DexPair[];
  } catch {
    return null;
  }
}

export function bestPair(pairs: DexPair[] | null): DexPair | null {
  if (!pairs || pairs.length === 0) return null;
  return pairs.reduce((best, p) =>
    (p.liquidity?.usd ?? 0) > (best.liquidity?.usd ?? 0) ? p : best,
  );
}

// --------------------------------------------------------------------- RPC

async function rpcPost(
  method: string,
  params: unknown[],
  ms = 10000,
  opts?: { urls?: string[]; attempts?: number },
): Promise<unknown> {
  // Each endpoint gets two attempts by default: the public BSC
  // endpoints drop requests under load, and one immediate retry on a
  // network error recovers most of them. A bad JSON-RPC response
  // (error field, or a null result) is not retried: the endpoint
  // answered, it just has no data, so the next endpoint is tried
  // instead. Attempts are bounded (4 endpoints x 2 tries x 10s) and
  // failures are usually fast, so a full sweep stays well inside the
  // scan budget. Log reads override both: PublicNode first, one
  // attempt each (see LOG_RPC_URLS).
  const urls = opts?.urls ?? RPC_URLS;
  const attempts = opts?.attempts ?? 2;
  let lastErr: unknown = null;
  for (const url of urls) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const res = await fetchWithTimeout(
          url,
          ms,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
          },
        );
        if (!res.ok) continue;
        const json = (await res.json()) as { result?: unknown; error?: unknown };
        if (json.error || json.result === undefined || json.result === null)
          continue;
        return json.result;
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw lastErr ?? new Error("all RPCs failed");
}

export async function ethCall(to: string, data: string): Promise<string | null> {
  try {
    const result = (await rpcPost("eth_call", [{ to, data }, "latest"])) as string;
    return typeof result === "string" ? result : null;
  } catch {
    return null;
  }
}

export async function ethGetBalance(address: string): Promise<bigint | null> {
  try {
    const result = (await rpcPost("eth_getBalance", [address, "latest"])) as string;
    return typeof result === "string" ? decodeUint(result) : null;
  } catch {
    return null;
  }
}

export async function ethGetCode(address: string): Promise<string | null> {
  try {
    const result = (await rpcPost("eth_getCode", [address, "latest"])) as string;
    return typeof result === "string" ? result : null;
  } catch {
    return null;
  }
}

export async function ethBlockNumber(): Promise<number | null> {
  try {
    const result = (await rpcPost("eth_blockNumber", [])) as string;
    return parseInt(result, 16);
  } catch {
    return null;
  }
}

export async function ethGetLogs(
  address: string,
  fromBlock: number,
  toBlock: number,
): Promise<Array<{ topics: string[]; data: string }> | null> {
  try {
    const result = (await rpcPost(
      "eth_getLogs",
      [
        {
          address,
          fromBlock: "0x" + fromBlock.toString(16),
          toBlock: "0x" + toBlock.toString(16),
          topics: [TRANSFER_TOPIC],
        },
      ],
      10000,
      { urls: LOG_RPC_URLS, attempts: 1 },
    )) as Array<{ topics: string[]; data: string }>;
    return Array.isArray(result) ? result : null;
  } catch {
    return null;
  }
}

// Raw Transfer log with its block number: the dossier needs the block
// for first-seen, first-minter, and biggest-move ordering.
export interface TransferLog {
  topics: string[];
  data: string;
  blockNumber: number;
}

export async function ethGetTransferLogs(
  address: string,
  fromBlock: number,
  toBlock: number,
): Promise<TransferLog[] | null> {
  try {
    const result = (await rpcPost(
      "eth_getLogs",
      [
        {
          address,
          fromBlock: "0x" + fromBlock.toString(16),
          toBlock: "0x" + toBlock.toString(16),
          topics: [TRANSFER_TOPIC],
        },
      ],
      10000,
      { urls: LOG_RPC_URLS, attempts: 1 },
    )) as Array<{ topics?: string[]; data?: string; blockNumber?: string }>;
    if (!Array.isArray(result)) return null;
    return result
      .filter(
        (l): l is { topics: string[]; data: string; blockNumber: string } =>
          Array.isArray(l.topics) &&
          typeof l.data === "string" &&
          typeof l.blockNumber === "string",
      )
      .map((l) => ({
        topics: l.topics,
        data: l.data,
        blockNumber: parseInt(l.blockNumber, 16),
      }));
  } catch {
    return null;
  }
}

export async function ethGetStorageAt(
  address: string,
  slot: string,
): Promise<string | null> {
  try {
    const result = (await rpcPost("eth_getStorageAt", [
      address,
      slot,
      "latest",
    ])) as string;
    return typeof result === "string" ? result : null;
  } catch {
    return null;
  }
}

export async function ethGetBlockTimestamp(
  blockNumber: number,
): Promise<number | null> {
  try {
    const result = (await rpcPost("eth_getBlockByNumber", [
      "0x" + blockNumber.toString(16),
      false,
    ])) as { timestamp?: string };
    if (!result || typeof result.timestamp !== "string") return null;
    return parseInt(result.timestamp, 16);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ ABI decoding

const SELECTORS = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd",
  owner: "0x8da5cb5b",
  balanceOf: "0x70a08231",
} as const;

function padAddress(addr: string): string {
  return "000000000000000000000000" + addr.toLowerCase().replace(/^0x/, "");
}

export function decodeUint(hex: string | null): bigint | null {
  if (!hex || hex === "0x") return null;
  try {
    return BigInt(hex);
  } catch {
    return null;
  }
}

export function decodeAddress(hex: string | null): string | null {
  if (!hex || hex.length < 42) return null;
  return "0x" + hex.slice(-40).toLowerCase();
}

export function decodeString(hex: string | null): string | null {
  if (!hex || hex === "0x") return null;
  try {
    // bytes32 short string: exactly 32 bytes, right-padded with zeros.
    // Older or gas-optimized tokens (e.g. MKR) return name()/symbol()
    // this way instead of an ABI-encoded string. An ABI-encoded string
    // is never this short (offset + length + data is at least 96 bytes),
    // so a 32-byte return can only be bytes32.
    if (hex.length === 66) {
      const bytes = hex.slice(2);
      let out = "";
      for (let i = 0; i < bytes.length; i += 2) {
        const code = parseInt(bytes.slice(i, i + 2), 16);
        if (code === 0) break;
        out += String.fromCharCode(code);
      }
      return out || null;
    }
    if (hex.length < 130) return null;
    const len = parseInt(hex.slice(66, 130), 16);
    const bytes = hex.slice(130, 130 + len * 2);
    let out = "";
    for (let i = 0; i < bytes.length; i += 2) {
      const code = parseInt(bytes.slice(i, i + 2), 16);
      if (code === 0) break;
      out += String.fromCharCode(code);
    }
    return out;
  } catch {
    return null;
  }
}

export async function callName(address: string): Promise<string | null> {
  return decodeString(await ethCall(address, SELECTORS.name));
}

export async function callSymbol(address: string): Promise<string | null> {
  return decodeString(await ethCall(address, SELECTORS.symbol));
}

export async function callDecimals(address: string): Promise<number | null> {
  const v = decodeUint(await ethCall(address, SELECTORS.decimals));
  return v === null ? null : Number(v);
}

export async function callTotalSupply(address: string): Promise<bigint | null> {
  return decodeUint(await ethCall(address, SELECTORS.totalSupply));
}

export async function callOwner(address: string): Promise<string | null> {
  return decodeAddress(await ethCall(address, SELECTORS.owner));
}

export async function callBalanceOf(
  token: string,
  holder: string,
): Promise<bigint | null> {
  return decodeUint(
    await ethCall(token, SELECTORS.balanceOf + padAddress(holder)),
  );
}

/** V3 pools have no totalSupply; slot0() exists only on V3-style pools. */
export async function callSlot0(pool: string): Promise<string | null> {
  return ethCall(pool, "0x3850c7bd");
}

export async function isContract(address: string): Promise<boolean | null> {
  const code = await ethGetCode(address);
  if (code === null) return null;
  return code !== "0x" && code.length > 2;
}
