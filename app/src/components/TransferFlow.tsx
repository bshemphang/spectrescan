// SpectreScan — transfer flow: where the token actually moves.
// Top senders and top receivers by volume inside the same 20,000
// block window as the bubble map, the total moved, and the biggest
// individual moves with direction. Same window label, same honest
// fallback: when no logs could be read at all, the section says data
// unavailable instead of drawing a flow from nothing. When the scan
// stopped early but collected logs, it shows what was collected and
// says the window is partial.

import type { DossierData } from "../lib/engine/types";
import { formatAmount, shortAddress } from "../lib/format";
import GhostShape from "./GhostShape";

function FlowList({
  title,
  entries,
  decimals,
  symbol,
  empty,
}: {
  title: string;
  entries: Array<{ address: string; volume: string }>;
  decimals: number | null;
  symbol: string | null;
  empty: string;
}) {
  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
        {title}
      </h3>
      {entries.length === 0 ? (
        <p className="mt-2 font-mono text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {entries.map((e, i) => (
            <li
              key={e.address}
              className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] pb-2 font-mono text-sm last:border-b-0"
            >
              <span className="text-[var(--muted)]">{i + 1}.</span>
              <span className="flex-1 truncate" title={e.address}>
                {shortAddress(e.address)}
              </span>
              <span className="text-[var(--ink)]">
                {formatAmount(e.volume, decimals, symbol)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TransferFlow({
  dossier,
  decimals,
  symbol,
}: {
  dossier: DossierData;
  decimals: number | null;
  symbol: string | null;
}) {
  const analysis = dossier.analysis;
  const summary = analysis.summary;
  const windowLabel = analysis.window
    ? `blocks ${analysis.window.fromBlock.toLocaleString()} to ${analysis.window.toBlock.toLocaleString()}`
    : "window unknown";

  return (
    <section aria-label="Transfer flow" className="dossier-card">
      <header className="mb-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
          Transfer flow
        </p>
        <h2 className="font-haunt text-2xl leading-tight">
          Where the ghosts drift
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Every transfer in {windowLabel}, about 17 hours on BSC. In and
          out are the same number for the token as a whole: every
          transfer leaves one address and arrives at another.
        </p>
      </header>
      {!summary || (summary.eventsProcessed === 0 && analysis.logsFailed) ? (
        <p className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4 font-mono text-sm text-[var(--muted)]">
          Transfer flow unavailable: the Transfer-log scan failed, so
          there is no flow to show. The scan does not invent moves.
        </p>
      ) : (
        <>
          {!analysis.complete && (
            <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 font-mono text-xs text-amber-200">
              {analysis.logsFailed
                ? "Partial window: the Transfer-log scan stopped early, so these totals cover only part of the window."
                : "Partial window: the scan stopped at the event cap, so these totals cover only part of the window."}
            </p>
          )}
          <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-3">
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                Total moved
              </dt>
              <dd className="mt-1 font-mono text-sm text-[var(--ink)]">
                {formatAmount(summary.totalMoved, decimals, symbol)}
              </dd>
            </div>
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-3">
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                Transfers
              </dt>
              <dd className="mt-1 font-mono text-sm text-[var(--ink)]">
                {summary.eventsProcessed.toLocaleString()}
              </dd>
            </div>
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-3">
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                First seen block
              </dt>
              <dd className="mt-1 font-mono text-sm text-[var(--ink)]">
                {summary.firstSeenBlock !== null
                  ? summary.firstSeenBlock.toLocaleString()
                  : "Unknown"}
              </dd>
            </div>
          </dl>
          <div className="grid gap-6 sm:grid-cols-2">
            <FlowList
              title="Top senders"
              entries={summary.senders}
              decimals={decimals}
              symbol={symbol}
              empty="No senders in the scanned window."
            />
            <FlowList
              title="Top receivers"
              entries={summary.receivers}
              decimals={decimals}
              symbol={symbol}
              empty="No receivers in the scanned window."
            />
          </div>
          <h3 className="mt-6 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
            Biggest moves
          </h3>
          {summary.biggestMoves.length === 0 ? (
            <p className="mt-2 font-mono text-sm text-[var(--muted)]">
              No moves in the scanned window.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {summary.biggestMoves.map((m, i) => (
                <li
                  key={`${m.from}-${m.to}-${m.blockNumber}-${i}`}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-[var(--line)] pb-2 font-mono text-sm last:border-b-0"
                >
                  <span className="truncate" title={m.from}>
                    {shortAddress(m.from)}
                  </span>
                  <span className="text-[var(--accent)]" aria-hidden="true">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      className="inline-block -translate-y-px"
                    >
                      <GhostShape />
                    </svg>
                  </span>
                  <span className="truncate" title={m.to}>
                    {shortAddress(m.to)}
                  </span>
                  <span className="ml-auto text-[var(--ink)]">
                    {formatAmount(m.value, decimals, symbol)}
                  </span>
                  <span className="text-[var(--muted)]">
                    block {m.blockNumber.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
