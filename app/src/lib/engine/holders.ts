// SpectreScan — transfer analysis for the address dossier.
// One log scan feeds the dossier: the bubble map, the transfer
// flow, first seen, and first minter. The holder-concentration
// finding (R8) is a separate pair-share proxy and does not use
// these logs.
// The scan covers only the last 20,000 blocks (about 17 hours on
// BSC). Every number built from it is window-scoped, and the UI
// labels it as such. Net balances inside the window are MOVEMENT,
// not lifetime holdings: an address that bought before the window
// and held still shows nothing here. The dossier says that in plain
// words instead of dressing movement up as distribution.

import {
  BURN_ADDRESSES,
  bestPair,
  ethBlockNumber,
  ethGetBlockTimestamp,
  ethGetCode,
  ethGetStorageAt,
  ethGetTransferLogs,
  type TransferLog,
} from "./fetchers";

export const HOLDER_WINDOW_BLOCKS = 20000;
// 5,000-block chunks: four chunks cover the window. PublicNode
// answers a 5,000-block log range; the Binance dataseeds refuse
// eth_getLogs outright, so fewer, bigger chunks mean fewer calls to
// the one endpoint that works.
export const HOLDER_CHUNK = 5000;
// 25 seconds: the dossier scan is the slow part of a scan (four
// paced log chunks plus a possible retry), and the route budget is
// 60 seconds. A shorter deadline would cut the dossier short on
// every busy token; a longer one would risk the route timeout.
export const HOLDER_DEADLINE_MS = 25000;
// Pacing between chunks: PublicNode rate-limits after a couple of
// rapid log calls. A short pause between chunks keeps the sweep
// under its limit; a failed chunk gets two retries after longer
// pauses before the scan gives up. PublicNode is the only free
// endpoint that answers eth_getLogs at all (1RPC caps it, Ankr needs
// a key, Omnia is down, the dataseeds refuse it), so riding out its
// bursts matters more than trying another host.
export const HOLDER_CHUNK_PAUSE_MS = 600;
export const HOLDER_RETRY_PAUSE_MS = 1500;
export const HOLDER_RETRY_PAUSE_2_MS = 3000;
export const MAX_EVENTS = 50000;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// EIP-1967 implementation slot and EIP-1822 proxiable slot.
const SLOT_1967 = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const SLOT_1822 = "0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c40b7bd9b0d8c9e9f4f4f";

export interface HolderEntry {
  address: string;
  netBalance: string; // raw uint256 string, can be negative in sign via leading "-"
  totalReceived: string;
  totalSent: string;
  share: number | null; // share of total supply, null when supply unknown
}

export interface FlowEntry {
  address: string;
  volume: string; // raw uint256 string
}

export interface BiggestMove {
  from: string;
  to: string;
  value: string;
  blockNumber: number;
}

export interface TransferSummary {
  eventsProcessed: number;
  truncated: boolean;
  firstSeenBlock: number | null;
  firstSeenAt: number | null; // Unix seconds, null when the block time could not be read
  firstMinter: string | null; // recipient of the earliest mint-from-zero in the window
  holders: HolderEntry[]; // top 12 by positive net balance
  // Top 10 by positive net balance EXCLUDING burn addresses, the
  // token contract itself, and the pair. The R8 finding is a
  // separate pair-share proxy and does not score on these balances.
  topHoldersExcluding: HolderEntry[];
  hadValidTransfers: boolean; // at least one log parsed into from/to/value
  topHolderShare: number | null;
  senders: FlowEntry[]; // top 5 by total sent
  receivers: FlowEntry[]; // top 5 by total received
  totalMoved: string; // raw uint256 string, sum of all Transfer values
  biggestMoves: BiggestMove[]; // top 8 by value
}

export interface TransferAnalysis {
  status: "ok" | "unavailable";
  complete: boolean; // false when the deadline or the event cap cut the scan short
  logsFailed: boolean;
  window: { fromBlock: number; toBlock: number } | null;
  // String, not bigint: the analysis travels inside ScanResult, which
  // is JSON-serialized by the API route.
  totalSupply: string | null;
  summary: TransferSummary | null;
}

export const EMPTY_SUMMARY: TransferSummary = {
  eventsProcessed: 0,
  truncated: false,
  firstSeenBlock: null,
  firstSeenAt: null,
  firstMinter: null,
  holders: [],
  topHoldersExcluding: [],
  hadValidTransfers: false,
  topHolderShare: null,
  senders: [],
  receivers: [],
  totalMoved: "0",
  biggestMoves: [],
};

function addrOf(topic: string | undefined): string | null {
  if (!topic || topic.length < 42) return null;
  return "0x" + topic.slice(-40).toLowerCase();
}

// Pure: turn raw Transfer logs into the dossier numbers. No I/O, so
// it is unit-testable with fabricated logs. A log is a mint when it
// comes from the zero address, a burn when it goes to a burn address.
// `excluded` holds the lowercased burn, token, and pair addresses:
// the top-10 set excludes them, while the dossier map shows them.
export function summarizeLogs(
  logs: TransferLog[],
  totalSupply: bigint | null,
  firstSeenAt: number | null,
  truncated: boolean,
  excluded: Set<string> = new Set(),
): TransferSummary {
  const net = new Map<string, bigint>();
  const received = new Map<string, bigint>();
  const sent = new Map<string, bigint>();
  let totalMoved = 0n;
  let firstSeenBlock: number | null = null;
  let firstMinter: string | null = null;
  let earliestMintBlock = Number.POSITIVE_INFINITY;
  let hadValidTransfers = false;
  const moves: BiggestMove[] = [];

  const add = (map: Map<string, bigint>, key: string, value: bigint) => {
    map.set(key, (map.get(key) ?? 0n) + value);
  };

  for (const log of logs) {
    if (!log.topics || log.topics.length < 3) continue;
    const from = addrOf(log.topics[1]);
    const to = addrOf(log.topics[2]);
    if (!from || !to) continue;
    let value = 0n;
    try {
      value = BigInt(log.data);
    } catch {
      continue;
    }
    // Counts only when at least one side survives the R8 exclusions:
    // the old scan's balances map stayed empty when every transfer
    // ran between excluded addresses, and the finding fell back.
    if (!excluded.has(from) || !excluded.has(to)) {
      hadValidTransfers = true;
    }
    if (firstSeenBlock === null || log.blockNumber < firstSeenBlock) {
      firstSeenBlock = log.blockNumber;
    }
    if (from === ZERO_ADDRESS && log.blockNumber < earliestMintBlock) {
      earliestMintBlock = log.blockNumber;
      firstMinter = to;
    }
    totalMoved += value;
    add(net, to, value);
    add(net, from, -value);
    add(received, to, value);
    add(sent, from, value);
    moves.push({ from, to, value: value.toString(), blockNumber: log.blockNumber });
  }

  const toHolder = (
    [address, balance]: [string, bigint],
  ): HolderEntry => ({
    address,
    netBalance: balance.toString(),
    totalReceived: (received.get(address) ?? 0n).toString(),
    totalSent: (sent.get(address) ?? 0n).toString(),
    share:
      // Four decimals, not two: a top window mover on a big-supply
      // token can hold 0.009% and still be the biggest bubble. Two
      // decimals truncated that to 0, and the display then read
      // "<0.0001%", which understated it ninety-fold.
      totalSupply !== null && totalSupply > 0n
        ? Number((balance * 1000000n) / totalSupply) / 10000
        : null,
  });

  const positive = [...net.entries()]
    .filter(([, v]) => v > 0n)
    .sort((a, b) => (a[1] > b[1] ? -1 : a[1] < b[1] ? 1 : 0));

  const holders = positive.slice(0, 12).map(toHolder);
  const topHoldersExcluding = positive
    .filter(([a]) => !excluded.has(a.toLowerCase()))
    .slice(0, 10)
    .map(toHolder);

  const topShare =
    holders.length > 0 && holders[0].share !== null ? holders[0].share : null;

  const top = (
    map: Map<string, bigint>,
    excludeZero: boolean,
  ): FlowEntry[] =>
    [...map.entries()]
      .filter(([a]) => !excludeZero || a !== ZERO_ADDRESS)
      .sort((a, b) => (a[1] > b[1] ? -1 : a[1] < b[1] ? 1 : 0))
      .slice(0, 5)
      .map(([address, volume]) => ({ address, volume: volume.toString() }));

  moves.sort((a, b) => {
    const av = BigInt(a.value);
    const bv = BigInt(b.value);
    return av > bv ? -1 : av < bv ? 1 : 0;
  });

  return {
    eventsProcessed: logs.length,
    truncated,
    firstSeenBlock,
    firstSeenAt,
    firstMinter,
    holders,
    topHoldersExcluding,
    hadValidTransfers,
    topHolderShare: topShare,
    senders: top(sent, true),
    receivers: top(received, true),
    totalMoved: totalMoved.toString(),
    biggestMoves: moves.slice(0, 8),
  };
}

// One log scan for the whole dossier: same window, same chunks,
// same 25s deadline. If the deadline or the event cap cuts it
// short, the analysis is marked incomplete.
export async function analyzeTransfers(
  tokenAddress: string,
  totalSupply: bigint | null,
  pairs: import("./types").DexPair[] | null,
): Promise<TransferAnalysis> {
  const latest = await ethBlockNumber();
  if (latest === null) {
    return {
      status: "unavailable",
      complete: false,
      logsFailed: true,
      window: null,
      totalSupply: totalSupply?.toString() ?? null,
      summary: null,
    };
  }
  const fromBlock = Math.max(0, latest - HOLDER_WINDOW_BLOCKS);
  const deadline = Date.now() + HOLDER_DEADLINE_MS;
  const logs: TransferLog[] = [];
  let logsFailed = false;
  let truncated = false;
  try {
    for (let from = fromBlock; from <= latest; from += HOLDER_CHUNK) {
      if (Date.now() > deadline) throw new Error("holder scan timed out");
      const to = Math.min(from + HOLDER_CHUNK - 1, latest);
      // Up to three attempts per chunk, with growing pauses: PublicNode
      // rate-limits in bursts, and a longer pause usually lets it
      // answer. The deadline still bounds the whole sweep.
      let chunk: TransferLog[] | null = null;
      for (let attempt = 0; attempt < 3 && chunk === null; attempt++) {
        if (attempt > 0) {
          await sleep(
            attempt === 1 ? HOLDER_RETRY_PAUSE_MS : HOLDER_RETRY_PAUSE_2_MS,
          );
          if (Date.now() > deadline) throw new Error("holder scan timed out");
        }
        chunk = await ethGetTransferLogs(tokenAddress, from, to);
      }
      if (chunk === null) throw new Error("eth_getLogs failed");
      for (const log of chunk) {
        if (logs.length >= MAX_EVENTS) {
          truncated = true;
          throw new Error("event cap reached");
        }
        logs.push(log);
      }
      if (from + HOLDER_CHUNK <= latest) {
        await sleep(HOLDER_CHUNK_PAUSE_MS);
      }
    }
  } catch (e) {
    // A failed chunk, the deadline, or the event cap: the scan is
    // incomplete. The caller keeps whatever was collected for the
    // dossier (labelled partial) while the holder finding falls back
    // to the pair-share proxy, exactly as before. The event cap is
    // not a failure: the scan collected logs up to the cap, and the
    // UI must say "event cap", not "stopped early".
    if (!(e instanceof Error && e.message === "event cap reached")) {
      logsFailed = true;
    }
  }

  // First-seen timestamp: one block read, best effort.
  let firstSeenAt: number | null = null;
  let firstSeenBlock: number | null = null;
  for (const log of logs) {
    if (firstSeenBlock === null || log.blockNumber < firstSeenBlock) {
      firstSeenBlock = log.blockNumber;
    }
  }
  if (firstSeenBlock !== null) {
    // Bounded on purpose: the timestamp is a nice-to-have, and this
    // read sits outside the 25s scan deadline, so it must not eat
    // the route's 60s budget. Three seconds or it stays unknown.
    firstSeenAt = await Promise.race([
      ethGetBlockTimestamp(firstSeenBlock),
      sleep(3000).then(() => null),
    ]);
  }

  // The R8 exclusion set: burn addresses, the token itself, the pair.
  const pair = bestPair(pairs);
  const excluded = new Set<string>([
    ...BURN_ADDRESSES.map((a) => a.toLowerCase()),
    tokenAddress.toLowerCase(),
    ...(pair ? [pair.pairAddress.toLowerCase()] : []),
  ]);
  const summary = summarizeLogs(
    logs,
    totalSupply,
    firstSeenAt,
    truncated,
    excluded,
  );
  return {
    status: logs.length > 0 || !logsFailed ? "ok" : "unavailable",
    complete: !logsFailed && !truncated,
    logsFailed,
    window: { fromBlock, toBlock: latest },
    totalSupply: totalSupply?.toString() ?? null,
    summary,
  };
}

// Proxy detection from verifiable chain data only: the EIP-1967 and
// EIP-1822 implementation slots, plus the EIP-1167 minimal-proxy code
// prefix. No label is ever guessed: when nothing matches, the answer
// is "none detected", and when the reads fail it is "unknown".
export type ProxyKind = "eip1967" | "eip1822" | "minimal" | "none" | "unknown";

export interface ProxyInfo {
  kind: ProxyKind;
  implementation: string | null;
}

export function detectProxy(
  code: string | null,
  slot1967: string | null,
  slot1822: string | null,
): ProxyInfo {
  const impl = (slot: string | null): string | null => {
    if (!slot || slot === "0x" || /^0x0+$/.test(slot)) return null;
    return "0x" + slot.slice(-40).toLowerCase();
  };
  if (code === null && slot1967 === null && slot1822 === null) {
    return { kind: "unknown", implementation: null };
  }
  const i1967 = impl(slot1967);
  if (i1967) return { kind: "eip1967", implementation: i1967 };
  const i1822 = impl(slot1822);
  if (i1822) return { kind: "eip1822", implementation: i1822 };
  if (code && code.toLowerCase().startsWith("0x363d3d373d3d3d363d73")) {
    return { kind: "minimal", implementation: null };
  }
  return { kind: "none", implementation: null };
}

export async function checkProxy(
  address: string,
  code?: string | null,
): Promise<ProxyInfo> {
  const [codeRead, slot1967, slot1822] = await Promise.all([
    code === undefined ? ethGetCode(address) : Promise.resolve(code),
    ethGetStorageAt(address, SLOT_1967),
    ethGetStorageAt(address, SLOT_1822),
  ]);
  return detectProxy(codeRead, slot1967, slot1822);
}
