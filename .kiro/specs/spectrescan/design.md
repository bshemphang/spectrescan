# SpectreScan — Design

> Companion to `requirements.md`. Written before implementation.

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│ Next.js 16 (App Router, TypeScript, Tailwind) — app/           │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │  UI (haunted │   │ /api/scan    │   │ LLM explainer    │    │
│  │  theme)      │──▶│  route       │──▶│ (Pollinations,   │    │
│  │  src/app     │   │  src/app/api │   │  keyless)        │    │
│  └──────────────┘   └──────┬───────┘   └──────────────────┘    │
│                            │                                    │
│                    ┌──────▼───────┐                            │
│                    │ Rules engine │  src/lib/engine/          │
│                    │  (pure TS,   │  fetchers + checks +      │
│                    │  no UI deps) │  scoring                  │
│                    └──────┬───────┘                            │
│              ┌────────────┼────────────┐                       │
│              ▼            ▼            ▼                       │
│         Sourcify     BSC public    Dexscreener                 │
│         v2 API       RPCs          API                         │
│         (source)     (eth_call,   (pairs,                     │
│                       eth_getLogs)  liquidity)                │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│ MCP server — mcp-server/ (Node + @modelcontextprotocol/sdk)    │
│  tools: getContractSource · getTokenInfo · getPairInfo ·       │
│         scanContract (reuses the same engine code)             │
│  configured in .kiro/settings/mcp.json                         │
└────────────────────────────────────────────────────────────────┘

The diagram omits the modules added after the spec: the dossier log scan
(holders.ts), the EOA branch, the /registry and /how-it-works pages, and
the SpectralCore / EffectsCanvas / HeroVideo presentation layer. See the
requirements addendum (2026-11-26).
```

The engine is a pure TypeScript library with no UI or framework dependencies,
so the web app and the MCP server share exactly the same code path. That is
the Frankenstein point: one deterministic brain, two bodies.

## Data flow (one scan)

1. `POST /api/scan { address }` — validate address format (REQ-1).
   EOA check first: `eth_getCode` returning 0x means a wallet, not a
   contract — score 0, one info finding, no token checks, no explainer.
2. Fetch in parallel:
   - Sourcify `v2/contract/56/{address}?fields=abi,sources` (REQ-2).
   - Dexscreener `tokens/v1/bsc/{address}` (REQ-3 R9).
   - RPC `eth_call`: `name()`, `symbol()`, `decimals()`, `totalSupply()`,
     `owner()` (if present), pair LP `balanceOf(burn addresses)` (R5–R7),
     `eth_getCode` (EOA + proxy), `eth_getStorageAt` (proxy slots).
3. Run the dossier log scan (`analyzeTransfers`): Transfer logs for the
   last 20,000 blocks in 5,000-block chunks against PublicNode, up to
   three attempts per chunk, 25s deadline, 50,000-event cap. Feeds the
   bubble map, transfer flow, first seen, and first minter — never the
   R8 score.
4. Run source checks (R2–R4) against the verified source text, recording
   file + line numbers for every hit.
5. Run the pair-share proxy (R8): share of total supply sitting in the
   main DEX pair (see below); on missing pair data → "unknown".
6. Score findings deterministically (REQ-4).
7. LLM explainer (REQ-5): one prompt with the findings JSON + source excerpts;
   response is stored verbatim and displayed as "the ghost's verdict".
   On failure the route writes a local verdict from the findings instead.
8. Respond with the full `ScanResult`: `{ address, chainId, scannedAt,
   score, band, token, verified, verificationStatus, findings,
   explanation, explainerFailed, explanationLocal, sources, isEOA,
   dossier }`.

In-memory cache (5 min per address, 200 entries max, oldest first out)
avoids re-scanning the same contract during judging. Rate limit: 60 scans
per rolling minute (429 + `Retry-After: 60`).

## Rules engine detail

### Finding shape

```ts
interface Finding {
  id: string;            // e.g. "honeypot-blacklist"
  check: string;         // R1..R9
  severity: "info" | "low" | "medium" | "high" | "critical";
  title: string;
  detail: string;        // plain English, one or two sentences
  evidence: string[];    // file:line refs or on-chain values
  weight: number;        // contribution to the risk score
}
```

### Severity weights (score = min(100, Σ weights))

| severity | weight |
|----------|--------|
| critical | 75     |
| high     | 50     |
| medium   | 12     |
| low      | 5      |
| info     | 0      |

Weights are fixed constants in `scoring.ts`. One Critical finding alone
reaches Possessed (75+) and one High alone reaches Haunted (50+), so a
backdoor never reads as mildly scary. Monotonicity follows directly:
score is a sum of non-negative weights, so adding findings can only raise it.

### Context-aware severity (scan.ts)

Raw pattern hits are adjusted with on-chain context, because the same code
means different things under different ownership:

- **Mintable:** HIGH when the owner is a wallet or unknown. MEDIUM when
  minting is governed by a verified contract (its rules are public code,
  e.g. a MasterChef-style emission contract). One level lower again when
  an enforced supply cap backed by a hardcoded constant exists (a
  `constant` / `immutable` cap or a literal bound required in the mint
  path, or an ERC20Capped inheritance with a literal cap). A cap held in
  a mutable variable never counts, and neither does a cap that only
  appears in a comment or a cap equal to the initial supply.
- **Owner is a contract:** LOW when that contract is verified on Sourcify
  (its controller is transparent), HIGH when it is not.
- **Combination rule:** deployer-minted supply (whole or almost the whole
  supply) AND no trading pair upgrades the no-pair finding to HIGH — no
  exit plus one holder with everything. This is a distinct combined fact,
  not double-counting.
- **Deployer-mint pattern (R2):** the constructor or an `initialize()`
  function assigns the entire supply to `msg.sender`'s balance (or
  `_mint(msg.sender, <total>)`). The supply variable may be declared at
  the top level (a state-var initializer) rather than inside the
  function body. Detected by brace-matching the function body and
  matching the supply variable; a single `_mint` to `msg.sender` of a
  hardcoded amount also counts.
- **V3 pools (R7):** concentrated-liquidity pools have no `totalSupply()`;
  a successful `slot0()` call identifies them. Their NFT positions cannot
  be checked from public data, so the finding reports the lock status as
  unknown (medium) and warns that providers can withdraw at any time —
  never as a clean bill of health.
- **Pair-share proxy (R8):** the score uses the share of total supply
  sitting in the main pair, not log data — by design, not by missing
  data. The Binance dataseeds still refuse `eth_getLogs` (verified
  2026-11-08: dataseed1/2 return -32005 "limit exceeded" even for
  100-block ranges), but PublicNode answers it, so the dossier does a
  real windowed top-holder scan from Transfer logs. A 20,000-block
  window of movement is still not a holder list, so scoring it as one
  would misread large tokens. Pair share < 10% → medium ("most supply
  sits outside the pool"). The finding says it is a proxy, never a
  holder scan.

### Source-pattern checks (R2–R4)

Pattern matching on the flattened/verified source text, with line numbers
resolved by searching the original per-file source. Patterns (regex, case
insensitive, Solidity-aware):

- blacklist: `mapping...blacklist`, `isBlacklisted`, `_blacklist[`, `blacklisted(`
- trading gate: `tradingEnabled`, `tradingOpen`, `enableTrading`, `startTrading`
- max tx/wallet: `maxTxAmount`, `maxWallet`, `_maxTx`, `maxWalletAmount`
- fee setter: `setTax`, `setFee`, `setBuyFee`, `setSellFee`, `updateFee`
- mint: `function mint(` with public/external visibility only (internal
  and private mint helpers are never flagged; the detail text says
  "public mint function")
- pause: `function pause(`, `whenNotPaused`, `Pausable`
- hidden owner: `owner()` returns a contract address (code at owner address
  is non-empty) — checked on-chain, not from source
- renounce: `owner() == 0x000…0` → no owner (good, info finding)

A pattern hit is only reported with the matching source lines as evidence.
If the source is unavailable, R2–R4 report "unknown" instead of guessing.

### LP burn share (R7)

- Pair address from Dexscreener (best-liquidity BSC pair).
- `balanceOf(pair, 0x000000000000000000000000000000000000dEaD)` and
  `balanceOf(pair, 0x000…0)` via eth_call; share = burned / totalSupply(pair).
- share ≥ 90% → info (good); 50–90% → low; < 50% → medium; no pair → unknown.

### Pair-share proxy (R8)

- The share of total supply sitting in the main DEX pair, from Dexscreener
  pair data and `totalSupply()` via eth_call. This is a proxy for holder
  concentration, not a holder scan: public RPCs refuse `eth_getLogs`, so
  real top-holder data is unavailable.
- Pair share < 10% → medium ("most supply sits outside the pool");
  ≥ 10% → info, and the finding says the reading is inconclusive — a
  pool share in that range says little about who holds the rest.
  The finding text says it is a proxy.
- No pair at all → the no-pair finding (R9), not this check.

## LLM explainer

- Endpoint: `https://text.pollinations.ai/` (POST, OpenAI-compatible JSON,
  no key). POST is used instead of the GET endpoint: GET truncates long
  prompts and is slow to time out.
- Model: "openai". Temperature 0.2, `reasoning_effort: "low"`. One
  attempt, 10s timeout.
- Prompt includes: the findings JSON (severity, title, detail, evidence),
  the score and band, and the hard instruction block from steering
  (`never hallucinate a vulnerability, cite file and line only for
  source-based findings and state the measured on-chain value for
  on-chain findings, never call anything "audited"`).
- If the LLM call fails, the route writes a local verdict from the
  findings (buildLocalVerdict), labelled model-free in the UI, with a
  Retry button — the scan result never depends on the LLM.

## UI

- Dark haunted-house theme: near-black background (#0c0a12), bone-white text,
  single accent: spectral violet (#a78bfa). Fraunces display font for
  headings, Geist Mono for body and code (self-hosted via next/font).
- Home: the Seance, a four-act scroll journey (scan, known hauntings,
  autopsy, lab) with a Three.js spectral core, a looping hero mist video,
  and an effects canvas. Act One is the scan form with a big address input
  and a "Scan" button; Act Two files the three known hauntings as case
  files (SELO — haunted honeypot; AGIO — hidden owner; CAKE — clean).
- Result: the address dossier — identity card, bubble map, transfer flow,
  timeline — plus the animated ghost-meter dial (SVG arc, 0–100), band
  label, verdict paragraph (LLM, or the local verdict labelled
  model-free), findings cards grouped by severity, evidence lines in
  monospace, "Scan another" action. A wallet address shows a dedicated
  wallet panel with no score.
- Lucide icons only; no emoji. Mobile layout stacks the meter above findings.

## MCP server

- `mcp-server/` is a small Node package using `@modelcontextprotocol/sdk`
  (stdio transport). Tools call the same engine functions as the web app.
- `.kiro/settings/mcp.json` registers it with
  `command: node`, `args: [mcp-server/dist/index.js]`, so Kiro can invoke it.

## Testing

- `vitest` + `fast-check`:
  - Property tests: score ∈ [0,100]; determinism (same findings → same
    score); monotonicity (adding a finding never lowers the score);
    empty findings → 0; weights non-negative.
  - Unit tests: pattern matcher on synthetic source snippets (blacklist,
    mint, pause, fee setter) with exact line numbers.
- Fixture tests (`npm run test:fixtures`): live scans of three known
  contracts and band assertions:
  - SELO `0x903449fdca80acec639941dc3c84f439cbad5df7` → score ≥ 50 (Haunted+)
  - AGIO `0x07D1554f450bE9158993180Dd0494A00C5c696dA` → score ≥ 50 (Haunted+)
  - CAKE `0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82` → score < 50
  These need network; they are skipped (not failed) when offline.

## File layout

```
.kiro/
  specs/spectrescan/{requirements.md, design.md, tasks.md}
  steering/{security.md, honesty.md, style.md}
  hooks/verify-on-save.json
  settings/mcp.json
app/                          # Next.js app
  src/app/                    # pages (/scan/[address], /registry,
                              # /how-it-works) + /api/scan route
  src/lib/engine/             # rules engine (pure TS)
  src/lib/engine/fixtures.ts  # sample contracts
  src/lib/engine/holders.ts   # dossier Transfer-log scan
  src/lib/explainer.ts        # LLM explainer + local verdict
  src/lib/cases.ts            # static case files (SELO, AGIO, CAKE)
  src/components/             # GhostMeter, FindingCard, ScanReport,
                              # BubbleMap, TransferFlow, IdentityCard,
                              # SpectralCore, EffectsCanvas, HeroVideo,
                              # ScoreWorkbench, CaseFile, Reveal,
                              # RecentScans, SiteHeader, SiteFooter,
                              # SoundToggle, TerminalRun, ScrollSpine
app/tests/                    # vitest + fast-check property tests
mcp-server/                   # MCP server package
LICENSE  README.md  KIRO_USAGE.md
```
