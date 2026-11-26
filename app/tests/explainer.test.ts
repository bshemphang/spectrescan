// SpectreScan — unit tests for the explainer safety filter.
// The filter is phrase-level: it blocks reassurance ("is safe") but
// allows warnings ("this is not safe"), because a correct verdict
// warns the reader instead of reassuring them.

import { describe, expect, it } from "vitest";
import { hasBannedReassurance } from "../src/lib/explainer";

describe("hasBannedReassurance", () => {
  it("rejects a reassuring verdict", () => {
    expect(hasBannedReassurance("This token is safe and secure.")).toBe(true);
  });

  it("rejects safe-to-buy and secure-investment phrasing", () => {
    expect(hasBannedReassurance("It looks safe to buy right now.")).toBe(true);
    expect(hasBannedReassurance("A secure investment for holders.")).toBe(true);
    expect(hasBannedReassurance("Safe to hold for the long term.")).toBe(true);
  });

  it("rejects audited and risk-free claims", () => {
    expect(hasBannedReassurance("The contract is audited.")).toBe(true);
    expect(hasBannedReassurance("This is a risk-free opportunity.")).toBe(true);
    expect(hasBannedReassurance("Guaranteed safe returns.")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(hasBannedReassurance("THIS TOKEN IS SAFE.")).toBe(true);
  });

  it("allows a warning verdict", () => {
    expect(
      hasBannedReassurance(
        "This is not safe, do not touch. One address holds everything.",
      ),
    ).toBe(false);
  });

  it("allows the bare words safe and secure inside a warning", () => {
    expect(
      hasBannedReassurance(
        "The contract is not secure and the mint is unsafe.",
      ),
    ).toBe(false);
  });
});
