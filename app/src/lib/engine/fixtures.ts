// SpectreScan — sample contracts for the home page and fixture tests.
// These are real, public BSC contracts chosen because their on-chain facts
// are already known and documented. Do not change the expected bands without
// re-verifying the contracts on chain.

import type { RiskBand } from "./types";

export interface SampleContract {
  address: string;
  label: string;
  tagline: string;
  /** Minimum expected score band for the fixture test. */
  expectAtLeast: "Haunted" | "Resting in peace";
  /** Real score and band from a live scan of this contract. Single source
   * of truth for the sample cards; update it if the engine changes the
   * score. */
  sampleScore: number;
  sampleBand: RiskBand;
}

export const SAMPLE_CONTRACTS: SampleContract[] = [
  {
    address: "0x903449fdca80acec639941dc3c84f439cbad5df7",
    label: "SELO",
    tagline: "Creator holds 100% of the supply",
    expectAtLeast: "Haunted",
    sampleScore: 100,
    sampleBand: "Possessed — do not touch",
  },
  {
    address: "0x07D1554f450bE9158993180Dd0494A00C5c696dA",
    label: "AGIO",
    tagline: "Honeypot flags, mintable, pausable",
    expectAtLeast: "Haunted",
    sampleScore: 100,
    sampleBand: "Possessed — do not touch",
  },
  {
    address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
    label: "CAKE",
    tagline: "PancakeSwap's token",
    expectAtLeast: "Resting in peace",
    sampleScore: 46,
    sampleBand: "Mildly haunted",
  },
];
