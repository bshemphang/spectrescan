// SpectreScan — GET /api/wallet?address=
// Known hauntings in a wallet, not a wallet audit. Reads the BNB
// balance and, for each token the site has actually filed, whether
// this wallet holds any of it. There is no holdings source for
// every token on the chain, so the response states plainly that it
// checks known tokens only, and a clean result means none of the
// known haunted tokens were found, not that the wallet is safe.
// A contract address is rejected: this endpoint is for wallets.

import { CASE_FILES } from "@/lib/cases";
import {
  callBalanceOf,
  callDecimals,
  ethGetBalance,
  ethGetCode,
} from "@/lib/engine/fetchers";
import { isValidAddress } from "@/lib/engine/scan";
import {
  clientIp,
  rateLimited,
  RATE_LIMIT_MESSAGE,
} from "@/lib/scanCache";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const address = (url.searchParams.get("address") ?? "").trim();
  // Validate before rate limiting: an invalid address must never
  // burn budget, or garbage requests alone could lock everyone out.
  if (!isValidAddress(address)) {
    return Response.json(
      { error: "That is not a valid wallet address. Use 0x followed by 40 hex characters." },
      { status: 400 },
    );
  }
  if (rateLimited(clientIp(request))) {
    return Response.json(
      { error: RATE_LIMIT_MESSAGE },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  const key = address.toLowerCase();
  const code = await ethGetCode(address);
  if (code === null) {
    return Response.json(
      { error: "The wallet could not be read right now. Try again in a moment." },
      { status: 502 },
    );
  }
  if (code !== "0x" && code.length > 2) {
    return Response.json(
      { error: "That address is a smart contract, not a wallet. Scan it as a token instead." },
      { status: 400 },
    );
  }
  const bnb = await ethGetBalance(address);
  const holdings: Array<{
    address: string;
    label: string;
    symbol: string | null;
    balance: string;
    decimals: number | null;
    score: number;
    band: string;
  }> = [];
  for (const file of CASE_FILES) {
    const balance = await callBalanceOf(file.address, address);
    if (balance === null || balance <= 0n) continue;
    const decimals = await callDecimals(file.address);
    holdings.push({
      address: file.address,
      label: file.label,
      symbol: null,
      balance: balance.toString(),
      decimals,
      score: file.score,
      band: file.band,
    });
  }
  return Response.json({
    address,
    isWallet: true,
    bnb: bnb === null ? null : bnb.toString(),
    checkedTokens: CASE_FILES.length,
    holdings,
  });
}
