// SpectreScan — unit tests for the RPC response decoders (spec REQ-8).
// decodeString must handle both ABI-encoded strings and the bytes32
// short strings that older or gas-optimized tokens return from name()
// and symbol().

import { describe, expect, it } from "vitest";
import { decodeString } from "../src/lib/engine/fetchers";

function bytes32Hex(ascii: string): string {
  const hex = Buffer.from(ascii, "ascii").toString("hex");
  return `0x${hex}${"00".repeat(32 - ascii.length)}`;
}

describe("decodeString", () => {
  it("decodes a bytes32 short string", () => {
    expect(decodeString(bytes32Hex("MKR"))).toBe("MKR");
  });

  it("decodes a longer bytes32 short string", () => {
    expect(decodeString(bytes32Hex("TestToken"))).toBe("TestToken");
  });

  it("decodes an ABI-encoded string", () => {
    const hex =
      "0x" +
      "0000000000000000000000000000000000000000000000000000000000000020" +
      "0000000000000000000000000000000000000000000000000000000000000005" +
      "48656c6c6f" +
      "00".repeat(27);
    expect(decodeString(hex)).toBe("Hello");
  });

  it("returns null for empty or short input", () => {
    expect(decodeString(null)).toBeNull();
    expect(decodeString("0x")).toBeNull();
    expect(decodeString("0x1234")).toBeNull();
  });

  it("returns null for an all-zero bytes32", () => {
    expect(decodeString(`0x${"00".repeat(32)}`)).toBeNull();
  });
});
