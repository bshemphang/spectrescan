// SpectreScan — unit tests for the source-pattern checks (spec REQ-9).
// Synthetic Solidity snippets: the matcher must find the pattern AND
// report the exact line number.

import { describe, expect, it } from "vitest";
import { runSourceChecks } from "../src/lib/engine/sourceChecks";

const snippet = (body: string) =>
  [
    "// SPDX-License-Identifier: MIT",
    "pragma solidity ^0.8.0;",
    "contract Test {",
    ...body.split("\n"),
    "}",
  ].join("\n");

describe("runSourceChecks", () => {
  it("finds a blacklist mapping with its line number", () => {
    const src = snippet(
      "    mapping(address => bool) public blacklist;\n    function setBlacklist(address a, bool b) external onlyOwner { blacklist[a] = b; }",
    );
    const hits = runSourceChecks([{ path: "Test.sol", content: src }]);
    const hit = hits.find((f) => f.id === "honeypot-blacklist");
    expect(hit).toBeDefined();
    expect(hit!.evidence[0]).toMatch(/Test\.sol:4/);
  });

  it("finds a public mint function", () => {
    const src = snippet("    function mint(address to, uint256 amount) external onlyOwner { _mint(to, amount); }");
    const hits = runSourceChecks([{ path: "Test.sol", content: src }]);
    expect(hits.some((f) => f.id === "mintable")).toBe(true);
  });

  it("finds a pause function", () => {
    const src = snippet("    function pause() external onlyOwner { _pause(); }");
    const hits = runSourceChecks([{ path: "Test.sol", content: src }]);
    expect(hits.some((f) => f.id === "pausable")).toBe(true);
  });

  it("finds a trading gate and a fee setter", () => {
    const src = snippet(
      "    bool public tradingEnabled;\n    function setBuyFee(uint256 f) external onlyOwner { buyFee = f; }",
    );
    const hits = runSourceChecks([{ path: "Test.sol", content: src }]);
    expect(hits.some((f) => f.id === "trading-gate")).toBe(true);
    expect(hits.some((f) => f.id === "fee-setter")).toBe(true);
  });

  it("reports nothing for a clean ERC-20 with no owner powers", () => {
    const src = snippet(
      "    mapping(address => uint256) public balanceOf;\n    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }",
    );
    expect(runSourceChecks([{ path: "Test.sol", content: src }])).toEqual([]);
  });
});
