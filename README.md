# SpectreScan: a ghost-hunter for smart contracts

**Kiroween 2026 hackathon entry · Frankenstein category · built with Kiro**

Paste any BNB Chain contract address. SpectreScan reads its verified source
and on-chain footprint, then tells you in plain English whether it is safe
to touch with the evidence cited for each finding.

The result is an address dossier, not just a score: an identity card (what
the address is, from verifiable chain data only), the risk score and
findings, a bubble map of who moved in the last 20,000 blocks, a transfer
flow of top senders, receivers and biggest moves, pair health, and a
timeline from first seen to scanned. Every number says where it came from
and what window it covers. A wallet address (eth_getCode returns 0x) is
reported plainly as a wallet, not scored as a haunted token.

The site is built as The Seance: the scan is shown as an agent run with
visible steps in terminal lines, the verdict lands like a case file closing,
over a canvas of drifting mist and particles, a looping background video,
and a Three.js spectral core that changes colour with the score band.

```
SELO  (0x9034…5df7)  →  score 100/100, Possessed
AGIO  (0x07D1…696dA) →  score 100/100, Possessed
CAKE  (0x0E09…1cE82) →  score 46/100, Mildly haunted
```

> **SpectreScan is not an audit. Never invest more than you can afford to lose.**

## The Frankenstein stitch

Four genuinely incompatible technologies in one app:

1. **A 1990s-style deterministic expert-system rules engine** hand-written
   checks, no ML. Honeypot patterns, mint/pause/blacklist detection, owner
   analysis, LP burn share, pair-share proxy, pair health.
2. **An LLM explainer** that turns the engine's findings into plain English,
   citing file and line for source findings and measured values for
   on-chain findings. It can describe findings but never change
   the score, never invent a vulnerability, and never call anything
   "audited".
3. **Live on-chain data** verified source via Sourcify, token/pair data
   via public BSC RPCs and the Dexscreener API, plus a Transfer-log scan
   (eth_getLogs via PublicNode, last 20,000 blocks) that feeds the dossier:
   bubble map, transfer flow, first seen, first minter, proxy check. No
   API keys anywhere.
4. **A modern Next.js 16 app** with a haunted-house UI: ghost meter, risk
   score 0–100, findings cards with evidence.

One deterministic brain, two bodies: the same engine powers the web app
(`app/src/lib/engine/`) and the MCP server (`mcp-server/`), so Kiro and the
UI can never disagree.

## How the score works

The risk score is a sum of fixed severity weights (critical 75, high 50,
medium 12, low 5, info 0), capped at 100. Adding a finding can never lower
the score, and the same findings always produce the same score proven by
property tests (`app/tests/scoring.property.test.ts`).

Bands: 0–12 "Resting in peace" · 13–49 "Mildly haunted" · 50–74 "Haunted" ·
75–100 "Possessed".

Context matters: a mint function is HIGH when the owner is a wallet, but
MEDIUM when minting is governed by a verified contract (public code), and
lower again with a visible supply cap. An owner that is a verified contract
scores LOW; an unverified owner contract scores HIGH. If the deployer minted the whole supply (or almost all of it, 90% or
more) AND there is no trading pair, the no-pair finding upgrades
to HIGH. Full rules: `.kiro/specs/spectrescan/design.md`.

## Run it

```bash
cd app
npm install
npm run dev        # http://localhost:3000
```

No environment variables, no API keys, no wallet, no sign-in.

```bash
npm run build      # production build
npm run start      # production server
npm test           # unit + property tests
npm run test:fixtures   # live scans of SELO / AGIO / CAKE (needs network)
npm run typecheck
```

### MCP server (for Kiro)

```bash
cd mcp-server
npm install
npm run build      # bundles to dist/index.js
npm run mcp        # stdio server
```

Tools: `getContractSource`, `getTokenInfo`, `getPairInfo`, `scanContract`.
Registered in `.kiro/settings/mcp.json`. Smoke-tested over stdio
(`mcp-server/smoke-test.mjs`).

## Deployment

The app is a standard Next.js app. It needs a host that allows ~60s server
functions (a slow scan can take ~35s end to end: the 25s holder-scan
deadline plus a 10s explainer timeout) Render's free
tier works; Vercel Hobby's 10s function limit does not. Set no environment
variables.

## Project structure

```
.kiro/
  specs/spectrescan/   requirements.md · design.md · tasks.md (written FIRST)
  steering/            security.md · honesty.md · style.md
  hooks/               verify-on-save.json (fixture tests + typecheck on save)
  settings/mcp.json    MCP server registration
app/                   Next.js 16 app (engine, API route, UI, tests)
mcp-server/            MCP server (same engine, stdio transport)
LICENSE  README.md  KIRO_USAGE.md
```

## Data sources (all public, all keyless)

- **Sourcify** verified contract source (v2 API, chain 56).
- **Public BSC RPCs** `eth_call` (name/symbol/decimals/totalSupply/
  owner/balanceOf), `eth_getCode`, `eth_blockNumber`, `eth_getStorageAt`
  (proxy slots), and `eth_getLogs` for the dossier. Four endpoints with
  fallback and retry; Binance dataseeds refuse `eth_getLogs` outright
  (verified 2026-11-08 and again 2026-11-26), so the log scan tries
  PublicNode first, in 5,000-block chunks with pacing and up to three
  attempts per chunk (1.5s then 3s pauses). When the log read fails, the dossier says data unavailable and
  never invents holders. The R8 holder check stays a pair-share proxy
  per the design doc: a 20,000-block window of movement is not a holder
  list, and scoring it as one would misread large tokens.
- **Dexscreener** pairs, liquidity, volume, buy/sell balance.
- **Pollinations** keyless LLM for the plain-English verdict
  (POST, model "openai", `reasoning_effort: "low"`).

## Disclosure (per the hackathon rules)

- All code in this repo was written during the submission period
  (Oct 30 – Dec 4, 2026). Standard frameworks and libraries were used:
  Next.js 16, React 19, Tailwind CSS 4, lucide-react, vitest, fast-check,
  @modelcontextprotocol/sdk, zod, esbuild.
- No pre-existing project code was incorporated.

## License

MIT see `LICENSE`.
