# SpectreScan — a ghost-hunter for smart contracts

**Kiroween 2026 hackathon entry · Frankenstein category · built with Kiro**

Paste any BNB Chain contract address. SpectreScan reads its verified source
and on-chain footprint, then tells you in plain English whether it is safe
to touch — with the exact source lines cited.

```
SELO  (0x9034…5df7)  →  score 55/100 — Haunted
AGIO  (0x07D1…696dA) →  score 54/100 — Haunted
CAKE  (0x0E09…1cE82) →  score 34/100 — Mildly haunted
```

> **SpectreScan is not an audit. Never invest more than you can afford to lose.**

## The Frankenstein stitch

Four genuinely incompatible technologies in one app:

1. **A 1990s-style deterministic expert-system rules engine** — hand-written
   checks, no ML. Honeypot patterns, mint/pause/blacklist detection, owner
   analysis, LP burn share, holder concentration, pair health.
2. **An LLM explainer** that turns the engine's findings into plain English
   and cites exact source lines. It can describe findings but never change
   the score, never invent a vulnerability, and never call anything
   "audited".
3. **Live on-chain data** — verified source via Sourcify, token/pair data
   via public BSC RPCs and the Dexscreener API. No API keys anywhere.
4. **A modern Next.js 16 app** with a haunted-house UI: ghost meter, risk
   score 0–100, findings cards with evidence.

One deterministic brain, two bodies: the same engine powers the web app
(`app/src/lib/engine/`) and the MCP server (`mcp-server/`), so Kiro and the
UI can never disagree.

## How the score works

The risk score is a sum of fixed severity weights (critical 40, high 25,
medium 12, low 5, info 0), capped at 100. Adding a finding can never lower
the score, and the same findings always produce the same score — proven by
property tests (`app/tests/scoring.property.test.ts`).

Bands: 0–24 "Resting in peace" · 25–49 "Mildly haunted" · 50–74 "Haunted" ·
75–100 "Possessed — do not touch".

Context matters: a mint function is HIGH when the owner is a wallet, but
MEDIUM when minting is governed by a verified contract (public code), and
lower again with a visible supply cap. An owner that is a verified contract
scores LOW; an unverified owner contract scores HIGH. If the deployer minted
the whole supply AND there is no trading pair, the no-pair finding upgrades
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
functions (a scan can take up to ~30s when RPCs are slow) — Render's free
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
LICENSE  README.md  KIRO_USAGE.md  VIDEO_SCRIPT.md
```

## Data sources (all public, all keyless)

- **Sourcify** — verified contract source (v2 API, chain 56).
- **Public BSC RPCs** — `eth_call` (name/symbol/decimals/totalSupply/
  owner/balanceOf), `eth_getCode`, `eth_blockNumber`. Note: public RPCs
  refuse `eth_getLogs` (verified 2026-11-08), so holder concentration uses
  a pair-share proxy when the log scan fails — see the design doc.
- **Dexscreener** — pairs, liquidity, volume, buy/sell balance.
- **Pollinations** — keyless LLM for the plain-English verdict
  (POST, model "openai", `reasoning_effort: "low"`).

## Disclosure (per the hackathon rules)

- All code in this repo was written during the submission period
  (Oct 30 – Dec 4, 2026). Standard frameworks and libraries were used:
  Next.js 16, React 19, Tailwind CSS 4, lucide-react, vitest, fast-check,
  @modelcontextprotocol/sdk, zod, esbuild.
- No pre-existing project code was incorporated.

## License

MIT — see `LICENSE`.
