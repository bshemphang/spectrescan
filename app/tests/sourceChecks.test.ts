// SpectreScan — unit tests for the source-pattern checks (spec REQ-9).
// Synthetic Solidity snippets: the matcher must find the pattern AND
// report the exact line number.

import { describe, expect, it } from "vitest";
import {
  deployerMintCheck,
  feeHasCap,
  mintHasCap,
  runSourceChecks,
} from "../src/lib/engine/sourceChecks";

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

describe("mintable visibility", () => {
  it("does not flag an internal mint function", () => {
    const src = snippet(
      "    function mint(address to, uint256 amount) internal { _mint(to, amount); }",
    );
    expect(runSourceChecks([{ path: "Test.sol", content: src }])).toEqual([]);
  });

  it("does not flag a private mint function", () => {
    const src = snippet(
      "    function mint(address to, uint256 amount) private { _mint(to, amount); }",
    );
    expect(runSourceChecks([{ path: "Test.sol", content: src }])).toEqual([]);
  });

  it("flags an external mint function", () => {
    const src = snippet(
      "    function mint(address to, uint256 amount) external onlyOwner { _mint(to, amount); }",
    );
    expect(
      runSourceChecks([{ path: "Test.sol", content: src }]).some(
        (f) => f.id === "mintable",
      ),
    ).toBe(true);
  });
});

describe("feeHasCap", () => {
  it("counts a require inside the setter body", () => {
    const src = snippet(
      "    function setBuyFee(uint256 f) external onlyOwner { require(f <= 25, 'too high'); buyFee = f; }",
    );
    expect(feeHasCap([{ path: "Test.sol", content: src }])).toBe(true);
  });

  it("does not count a cap that only appears in a comment", () => {
    const src = snippet(
      "    function setBuyFee(uint256 f) external onlyOwner { // require(f <= 25) enforced by timelock\n        buyFee = f; }",
    );
    expect(feeHasCap([{ path: "Test.sol", content: src }])).toBe(false);
  });

  it("does not count a cap in another function", () => {
    const src = snippet(
      "    function checkFee(uint256 f) internal view { require(f <= 25); }\n    function setBuyFee(uint256 f) external onlyOwner { buyFee = f; }",
    );
    expect(feeHasCap([{ path: "Test.sol", content: src }])).toBe(false);
  });

  it("does not count a 100 percent cap", () => {
    const percent = snippet(
      "    function setBuyFee(uint256 f) external onlyOwner { require(f <= 100); buyFee = f; }",
    );
    expect(feeHasCap([{ path: "Test.sol", content: percent }])).toBe(false);
    const bps = snippet(
      "    function setBuyFee(uint256 f) external onlyOwner { require(f <= 10000); buyFee = f; }",
    );
    expect(feeHasCap([{ path: "Test.sol", content: bps }])).toBe(false);
  });

  it("counts a named constant cap and rejects one set to 100", () => {
    const capped = snippet(
      "    uint256 public constant MAX_FEE = 25;\n    function setBuyFee(uint256 f) external onlyOwner { require(f <= MAX_FEE); buyFee = f; }",
    );
    expect(feeHasCap([{ path: "Test.sol", content: capped }])).toBe(true);
    const full = snippet(
      "    uint256 public constant MAX_FEE = 100;\n    function setBuyFee(uint256 f) external onlyOwner { require(f <= MAX_FEE); buyFee = f; }",
    );
    expect(feeHasCap([{ path: "Test.sol", content: full }])).toBe(false);
  });
});

describe("mintHasCap", () => {
  const mintWithRequire = (capDecl: string, bound: string) =>
    snippet(
      `${capDecl}\n    function mint(address to, uint256 amount) external onlyOwner { require(totalSupply() + amount <= ${bound}); _mint(to, amount); }`,
    );

  it("counts a constant cap enforced in the mint body", () => {
    const src = mintWithRequire(
      "    uint256 public constant MAX_SUPPLY = 2000000 * 10**18;",
      "MAX_SUPPLY",
    );
    expect(mintHasCap([{ path: "Test.sol", content: src }])).toBe(true);
  });

  it("counts a hardcoded literal bound", () => {
    const src = snippet(
      "    function mint(address to, uint256 amount) external onlyOwner { require(totalSupply() + amount <= 1000000 * 10**18); _mint(to, amount); }",
    );
    expect(mintHasCap([{ path: "Test.sol", content: src }])).toBe(true);
  });

  it("does not count a cap held in a mutable state variable", () => {
    const src = mintWithRequire(
      "    uint256 public maxSupply;",
      "maxSupply",
    );
    expect(mintHasCap([{ path: "Test.sol", content: src }])).toBe(false);
  });

  it("does not count a cap that is never enforced in the mint path", () => {
    const src = snippet(
      "    uint256 public constant MAX_SUPPLY = 2000000 * 10**18;\n    function mint(address to, uint256 amount) external onlyOwner { _mint(to, amount); }",
    );
    expect(mintHasCap([{ path: "Test.sol", content: src }])).toBe(false);
  });

  it("does not count a cap equal to the initial supply", () => {
    const src = snippet(
      "    uint256 public constant TOTAL_SUPPLY = 1000000 * 10**18;\n    uint256 public constant MAX_SUPPLY = 1000000 * 10**18;\n    function mint(address to, uint256 amount) external onlyOwner { require(totalSupply() + amount <= MAX_SUPPLY); _mint(to, amount); }",
    );
    expect(mintHasCap([{ path: "Test.sol", content: src }])).toBe(false);
  });

  it("counts ERC20Capped with a literal cap, not with a parameter", () => {
    const literal = [
      "// SPDX-License-Identifier: MIT",
      "pragma solidity ^0.8.0;",
      "contract Test is ERC20Capped(1000000 * 10**18) {",
      "}",
    ].join("\n");
    expect(mintHasCap([{ path: "Test.sol", content: literal }])).toBe(true);
    const param = [
      "// SPDX-License-Identifier: MIT",
      "pragma solidity ^0.8.0;",
      "contract Test is ERC20Capped(cap_) {",
      "}",
    ].join("\n");
    expect(mintHasCap([{ path: "Test.sol", content: param }])).toBe(false);
  });
});

describe("deployerMintCheck", () => {
  it("flags a constructor mint of a top-level supply constant", () => {
    const src = [
      "// SPDX-License-Identifier: MIT",
      "pragma solidity ^0.8.0;",
      "contract Test {",
      "    uint256 public constant TOTAL_SUPPLY = 1000000 * 10**18;",
      "    constructor() { _mint(msg.sender, TOTAL_SUPPLY); }",
      "}",
    ].join("\n");
    const hit = deployerMintCheck([{ path: "Test.sol", content: src }]);
    expect(hit).not.toBeNull();
    expect(hit!.evidence[0]).toMatch(/Test\.sol:5/);
  });

  it("flags an initialize() mint (proxy pattern)", () => {
    const src = [
      "// SPDX-License-Identifier: MIT",
      "pragma solidity ^0.8.0;",
      "contract Test {",
      "    uint256 public constant TOTAL_SUPPLY = 1000000 * 10**18;",
      "    function initialize() public { _mint(msg.sender, TOTAL_SUPPLY); }",
      "}",
    ].join("\n");
    const hit = deployerMintCheck([{ path: "Test.sol", content: src }]);
    expect(hit).not.toBeNull();
    expect(hit!.detail).toMatch(/initialize\(\)/);
  });

  it("flags a single literal mint to the deployer", () => {
    const src = snippet(
      "    constructor() { _mint(msg.sender, 1000000 * 10**18); }",
    );
    expect(deployerMintCheck([{ path: "Test.sol", content: src }])).not.toBeNull();
  });

  it("does not flag a mint to another address", () => {
    const src = snippet(
      "    constructor() { _mint(teamWallet, TOTAL_SUPPLY); }",
    );
    expect(deployerMintCheck([{ path: "Test.sol", content: src }])).toBeNull();
  });

  it("does not flag a split initial mint", () => {
    const src = snippet(
      "    constructor() { _mint(msg.sender, 500000 * 10**18); _mint(teamWallet, 500000 * 10**18); }",
    );
    expect(deployerMintCheck([{ path: "Test.sol", content: src }])).toBeNull();
  });

  it("flags a 99% fraction mint as a majority mint", () => {
    const src = snippet(
      [
        "    uint256 public totalSupply = 1000000 * 10**18;",
        "    constructor() { _mint(msg.sender, totalSupply * 99 / 100); _mint(feeWallet, totalSupply / 100); }",
      ].join("\n"),
    );
    const hit = deployerMintCheck([{ path: "Test.sol", content: src }]);
    expect(hit).not.toBeNull();
    expect(hit!.title).toMatch(/Almost the entire supply/);
    expect(hit!.severity).toBe("high");
  });

  it("flags a supply-minus-fee mint as a majority mint", () => {
    const src = snippet(
      [
        "    uint256 public totalSupply = 1000000 * 10**18;",
        "    constructor() { _mint(msg.sender, totalSupply - feeAmount); }",
      ].join("\n"),
    );
    const hit = deployerMintCheck([{ path: "Test.sol", content: src }]);
    expect(hit).not.toBeNull();
    expect(hit!.title).toMatch(/Almost the entire supply/);
  });

  it("flags a 99/1 two-literal split as a majority mint", () => {
    const src = snippet(
      "    constructor() { _mint(msg.sender, 990000 * 10**18); _mint(feeWallet, 10000 * 10**18); }",
    );
    const hit = deployerMintCheck([{ path: "Test.sol", content: src }]);
    expect(hit).not.toBeNull();
    expect(hit!.title).toMatch(/Almost the entire supply/);
  });

  it("does not flag a 50% fraction mint", () => {
    const src = snippet(
      [
        "    uint256 public totalSupply = 1000000 * 10**18;",
        "    constructor() { _mint(msg.sender, totalSupply * 50 / 100); _mint(teamWallet, totalSupply / 2); }",
      ].join("\n"),
    );
    expect(deployerMintCheck([{ path: "Test.sol", content: src }])).toBeNull();
  });

  it("does not flag an 80/20 two-literal split", () => {
    const src = snippet(
      "    constructor() { _mint(msg.sender, 800000 * 10**18); _mint(teamWallet, 200000 * 10**18); }",
    );
    expect(deployerMintCheck([{ path: "Test.sol", content: src }])).toBeNull();
  });

  it("flags a mint of a supply variable assigned a numeric literal in the body", () => {
    const src = snippet(
      "    constructor() { uint256 supply = 1000000 * 10**18; _mint(msg.sender, supply); }",
    );
    const hit = deployerMintCheck([{ path: "Test.sol", content: src }]);
    expect(hit).not.toBeNull();
    expect(hit!.title).toMatch(/Entire supply minted/);
    expect(hit!.majority).toBe(false);
  });

  it("flags a mint of a _total variable assigned a numeric literal", () => {
    const src = snippet(
      "    constructor() { uint256 _total = 1000000 * 10**18; _mint(msg.sender, _total); }",
    );
    expect(deployerMintCheck([{ path: "Test.sol", content: src }])).not.toBeNull();
  });

  it("flags a parenthesised fraction mint as a majority mint", () => {
    const src = snippet(
      [
        "    uint256 public totalSupply = 1000000 * 10**18;",
        "    constructor() { _mint(msg.sender, (totalSupply * 90) / 100); _mint(feeWallet, totalSupply / 10); }",
      ].join("\n"),
    );
    const hit = deployerMintCheck([{ path: "Test.sol", content: src }]);
    expect(hit).not.toBeNull();
    expect(hit!.title).toMatch(/Almost the entire supply/);
    expect(hit!.majority).toBe(true);
  });

  it("flags a no-space fraction mint as a majority mint", () => {
    const src = snippet(
      [
        "    uint256 public totalSupply = 1000000 * 10**18;",
        "    constructor() { _mint(msg.sender, totalSupply*9/10); _mint(feeWallet, totalSupply/10); }",
      ].join("\n"),
    );
    const hit = deployerMintCheck([{ path: "Test.sol", content: src }]);
    expect(hit).not.toBeNull();
    expect(hit!.majority).toBe(true);
  });

  it("flags a parenthesised fraction balance assignment as a majority mint", () => {
    const src = snippet(
      [
        "    uint256 public totalSupply = 1000000 * 10**18;",
        "    constructor() { balances[msg.sender] = (totalSupply * 95) / 100; }",
      ].join("\n"),
    );
    const hit = deployerMintCheck([{ path: "Test.sol", content: src }]);
    expect(hit).not.toBeNull();
    expect(hit!.majority).toBe(true);
  });
});
