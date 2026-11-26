// SpectreScan — live fixture tests (spec REQ-9).
// Scans three real BSC contracts and asserts their risk bands.
// Skips (does not fail) when the network is unavailable, so an offline
// run never produces a false red.

import { describe, expect, it } from "vitest";
import { scanContract } from "../src/lib/engine/scan";
import { SAMPLE_CONTRACTS } from "../src/lib/engine/fixtures";

describe("live fixture scans", () => {
  for (const sample of SAMPLE_CONTRACTS) {
    it(`${sample.label} (${sample.address}) lands in its expected band`, async ({
      skip,
    }) => {
      const result = await scanContract(sample.address);
      const online =
        result.sources.sourcify || result.sources.dexscreener || result.sources.rpc;
      if (!online) {
        skip();
        return;
      }
      if (sample.expectAtLeast === "Haunted") {
        expect(result.score).toBeGreaterThanOrEqual(50);
        expect(["Haunted", "Possessed"]).toContain(result.band);
      } else {
        expect(result.score).toBeLessThan(50);
        expect(["Resting in peace", "Mildly haunted"]).toContain(result.band);
      }
    });
  }
});
