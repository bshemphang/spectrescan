// SpectreScan MCP server — live BSC contract data for Kiro.
// Tools reuse the exact same rules engine as the web app
// (../app/src/lib/engine), so Kiro and the UI can never disagree.
// Transport: stdio. Run with: npm run build && npm run mcp

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { scanContract } from "../../app/src/lib/engine/scan.js";
import {
  bestPair,
  callBalanceOf,
  callDecimals,
  callName,
  callOwner,
  callSymbol,
  callTotalSupply,
  getDexPairs,
  getSourcifySource,
  isContract,
} from "../../app/src/lib/engine/fetchers.js";

const Address = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a 0x address with 40 hex characters.");

const server = new McpServer({
  name: "spectrescan",
  version: "1.0.0",
});

server.tool(
  "getContractSource",
  "Fetch the verified source of a BSC contract from Sourcify. Returns the verification status, file paths, and the first 100 lines of each file. Returns null sources when the contract is unverified.",
  { address: Address },
  async ({ address }) => {
    const result = await getSourcifySource(address);
    if (!result) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              address,
              verified: false,
              status: "none",
              sources: [],
            }),
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            address,
            verified: true,
            status: result.status,
            sources: result.sources.map((s) => ({
              path: s.path,
              lines: s.content.split("\n").length,
              preview: s.content.split("\n").slice(0, 100).join("\n"),
            })),
          }),
        },
      ],
    };
  },
);

server.tool(
  "getTokenInfo",
  "Read basic on-chain facts about a BSC token contract via public RPC: name, symbol, decimals, total supply, owner(), and whether the owner address holds contract code.",
  { address: Address },
  async ({ address }) => {
    const [name, symbol, decimals, totalSupply, owner] = await Promise.all([
      callName(address),
      callSymbol(address),
      callDecimals(address),
      callTotalSupply(address),
      callOwner(address),
    ]);
    const ownerIsContract =
      owner && owner !== "0x0000000000000000000000000000000000000000"
        ? await isContract(owner)
        : null;
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            address,
            name,
            symbol,
            decimals,
            totalSupply: totalSupply?.toString() ?? null,
            owner,
            ownerRenounced:
              owner === "0x0000000000000000000000000000000000000000",
            ownerIsContract,
          }),
        },
      ],
    };
  },
);

server.tool(
  "getPairInfo",
  "Get the best-liquidity DEX pair for a BSC token from Dexscreener: pair address, price, liquidity in USD, 24h volume, 24h buys/sells, and pair creation time.",
  { address: Address },
  async ({ address }) => {
    const pairs = await getDexPairs(address);
    const pair = bestPair(pairs);
    if (!pair) {
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ address, pair: null }) },
        ],
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            address,
            pair: {
              pairAddress: pair.pairAddress,
              dexId: pair.dexId,
              baseToken: pair.baseToken,
              quoteToken: pair.quoteToken,
              priceUsd: pair.priceUsd,
              liquidityUsd: pair.liquidity?.usd ?? null,
              volume24h: pair.volume?.h24 ?? null,
              txns24h: pair.txns?.h24 ?? null,
              pairCreatedAt: pair.pairCreatedAt ?? null,
            },
          }),
        },
      ],
    };
  },
);

server.tool(
  "scanContract",
  "Run the full SpectreScan deterministic rules engine on a BSC contract: verified-source checks, honeypot patterns, mint/pause/blacklist detection, owner and LP-burn checks, holder concentration, and pair health. Returns the 0-100 risk score, the band, and every finding with file:line evidence. The score comes only from the findings.",
  { address: Address },
  async ({ address }) => {
    const result = await scanContract(address);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  },
);

// Keep stdout clean for the MCP protocol: log only to stderr.
server
  .connect(new StdioServerTransport())
  .catch((err) => {
    console.error("SpectreScan MCP server failed to start:", err);
    process.exit(1);
  });
