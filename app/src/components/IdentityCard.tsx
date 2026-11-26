// SpectreScan — the identity card: what the address actually is,
// from verifiable chain data only. No entity labels are ever
// invented: no exchange names, no project names, no guessed
// identities. Anything that cannot be verified from chain data or
// the sources already called reads "Unknown".

import type { DossierData, ScanResult } from "../lib/engine/types";
import { formatAmount, formatAgeAtLeast, formatDate, shortAddress } from "../lib/format";

function Row({
  label,
  children,
  source,
}: {
  label: string;
  children: React.ReactNode;
  source: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-[var(--line)] py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </dt>
      <dd className="text-right font-mono text-sm text-[var(--ink)]">
        {children}
        <span className="mt-0.5 block font-mono text-[10px] text-[var(--muted)]">
          {source}
        </span>
      </dd>
    </div>
  );
}

export default function IdentityCard({
  result,
  dossier,
}: {
  result: ScanResult;
  dossier: DossierData;
}) {
  const token = result.token;
  const analysis = dossier.analysis;
  const summary = analysis.summary;
  const answered = [
    token.name !== null ? "name" : null,
    token.symbol !== null ? "symbol" : null,
    token.decimals !== null ? "decimals" : null,
    token.totalSupply !== null ? "totalSupply" : null,
  ].filter((x): x is string => x !== null);
  const standard =
    answered.length === 4
      ? "ERC-20 interface: name, symbol, decimals, totalSupply all answer"
      : answered.length > 0
        ? `Partial interface: ${answered.join(", ")} answer`
        : "No token interface: name, symbol, decimals, totalSupply do not answer";
  const verified =
    result.verificationStatus === "perfect"
      ? "Yes, exact match"
      : result.verificationStatus === "partial"
        ? "Partial match"
        : "No";
  const proxy = dossier.proxy;
  const proxyText =
    proxy.kind === "eip1967"
      ? `Proxy: EIP-1967, implementation ${proxy.implementation ? shortAddress(proxy.implementation) : "unknown"}`
      : proxy.kind === "eip1822"
        ? `Proxy: EIP-1822, implementation ${proxy.implementation ? shortAddress(proxy.implementation) : "unknown"}`
        : proxy.kind === "minimal"
          ? "Minimal proxy (EIP-1167)"
          : proxy.kind === "none"
            ? "No proxy pattern detected"
            : "Unknown, proxy reads failed";
  const proxySource =
    proxy.kind === "unknown"
      ? "eth_getStorageAt failed on all public RPCs"
      : "EIP-1967 slot, EIP-1822 slot, minimal-proxy code prefix";
  const pair = dossier.pair;
  const firstSeenAt = summary?.firstSeenAt ?? null;
  const firstSeenBlock = summary?.firstSeenBlock ?? null;

  return (
    <section aria-label="Identity card" className="dossier-card">
      <header className="mb-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
          Identity card
        </p>
        <h2 className="font-haunt text-2xl leading-tight">
          What this address is
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Every line below comes from chain data or a source this scan
          already calls. Nothing here is a guess. Where the chain
          cannot say, it says unknown.
        </p>
      </header>
      <dl>
        <Row label="Type" source="eth_getCode, BSC">
          Smart contract
        </Row>
        <Row label="Token" source="eth_call name() and symbol()">
          {token.name ?? "Unknown"}
          {token.symbol ? ` (${token.symbol})` : ""}
        </Row>
        <Row label="Standard" source="eth_call name, symbol, decimals, totalSupply">
          {standard}
        </Row>
        <Row label="Decimals" source="eth_call decimals()">
          {token.decimals !== null ? token.decimals : "Unknown"}
        </Row>
        <Row label="Total supply" source="eth_call totalSupply()">
          {token.totalSupply !== null
            ? formatAmount(token.totalSupply, token.decimals, token.symbol)
            : "Unknown"}
        </Row>
        <Row label="Source verified" source="Sourcify">
          {verified}
        </Row>
        <Row label="Proxy" source={proxySource}>
          {proxyText}
        </Row>
        <Row
          label="First seen"
          source="earliest Transfer in the last 20,000 blocks"
        >
          {firstSeenBlock !== null ? (
            <>
              Block {firstSeenBlock.toLocaleString()}
              {firstSeenAt !== null && (
                <>
                  {" "}
                  · {formatDate(firstSeenAt)} ·{" "}
                  {formatAgeAtLeast(firstSeenAt)}
                </>
              )}
            </>
          ) : (
            "Unknown, no transfers in the scanned window"
          )}
        </Row>
        <Row
          label="First minter"
          source="earliest mint from the zero address in the window"
        >
          {summary?.firstMinter ? (
            <span title={summary.firstMinter}>
              {shortAddress(summary.firstMinter)}
            </span>
          ) : (
            "Unknown, no mint in the scanned window"
          )}
        </Row>
        <Row label="Trading pair" source="Dexscreener">
          {pair ? (
            <>
              {pair.dexId} ·{" "}
              <span title={pair.pairAddress}>
                {shortAddress(pair.pairAddress)}
              </span>
              {pair.liquidity?.usd !== undefined
                ? ` · $${Math.round(pair.liquidity.usd).toLocaleString()} liquidity`
                : ""}
            </>
          ) : (
            "No pair found"
          )}
        </Row>
      </dl>
    </section>
  );
}
