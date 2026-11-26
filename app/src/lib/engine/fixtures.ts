// SpectreScan — sample contracts for the home page and fixture tests.
// These are real, public BSC contracts chosen because their on-chain facts
// are already known and documented. Do not change the expected bands without
// re-verifying the contracts on chain.

export interface SampleContract {
  address: string;
  label: string;
  tagline: string;
  /** Minimum expected score band for the fixture test. */
  expectAtLeast: "Haunted" | "Resting in peace";
}

export const SAMPLE_CONTRACTS: SampleContract[] = [
  {
    address: "0x903449fdca80acec639941dc3c84f439cbad5df7",
    label: "SELO",
    tagline: "Creator holds 100% of the LP — the textbook haunted contract.",
    expectAtLeast: "Haunted",
  },
  {
    address: "0x07D1554f450bE9158993180Dd0494A00C5c696dA",
    label: "AGIO",
    tagline: "Honeypot flags, mintable, pausable, hidden owner — haunted.",
    expectAtLeast: "Haunted",
  },
  {
    address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
    label: "CAKE",
    tagline: "PancakeSwap's token — verified, deep liquidity, widely held.",
    expectAtLeast: "Resting in peace",
  },
];
