// SpectreScan — shared scan runner for the API routes. Runs the
// deterministic engine, then adds the LLM verdict. The scan result
// never depends on the LLM: if the explainer fails, the verdict is
// written from the findings instead, so the verdict area never shows
// a failure. A wallet address needs no verdict: there is nothing to
// explain.

import { buildLocalVerdict, explainScan } from "@/lib/explainer";
import { scanContract } from "@/lib/engine/scan";
import type { ScanResult } from "@/lib/engine/types";

export async function runScan(address: string): Promise<ScanResult> {
  const result = await scanContract(address);
  const explanation = result.isEOA ? null : await explainScan(result);
  result.explanation = result.isEOA
    ? null
    : (explanation ?? buildLocalVerdict(result));
  result.explanationLocal = !result.isEOA && explanation === null;
  result.explainerFailed = explanation === null && !result.isEOA;
  return result;
}

export async function retryVerdictOnly(cached: ScanResult): Promise<ScanResult> {
  // Verdict-only retry: the engine result is still fresh, so only
  // re-run the explainer and update the cached verdict. A failed
  // retry falls back to the local verdict, same as a fresh scan.
  // Copy-on-write: the cached object is never mutated in place, so a
  // failed or concurrent retry cannot downgrade the verdict every
  // later visitor reads. A wallet has no verdict to retry.
  const explanation = await explainScan(cached);
  return {
    ...cached,
    explanation: explanation ?? buildLocalVerdict(cached),
    explanationLocal: explanation === null,
    explainerFailed: explanation === null,
  };
}
