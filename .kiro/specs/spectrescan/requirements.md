# SpectreScan — Requirements

> Spec for the Kiroween 2026 hackathon entry (Frankenstein category).
> Written 2026-11-08, before any implementation code. Status: approved for implementation.

## Overview

SpectreScan is a web app where anyone pastes a BSC/EVM contract address and gets a
plain-English "haunting report": is this contract safe to touch, or is it haunted?
It stitches four genuinely incompatible technologies into one app:

1. A **1990s-style deterministic expert-system rules engine** (hand-written checks,
   no ML) that inspects contract source and on-chain state.
2. An **LLM explainer** that turns the engine's findings into plain English and
   cites the evidence for each finding — file and line for source findings,
   the measured on-chain value for on-chain findings.
3. **Live on-chain data** — verified source via Sourcify, token/pair data via
   public BSC RPCs and the Dexscreener API.
4. A modern **Next.js app** with a haunted-house UI (ghost meter, risk score 0–100).

## Problem

People lose money to scam contracts every day. Existing screeners are either too
technical (raw audit output, opcode dumps) or untrustworthy (paid listings,
opaque scores). A normal person about to mint or buy a token has no fast,
readable way to answer "is this safe?"

## Users

- Anyone about to interact with a BSC token/NFT contract (mint, buy, approve).
- No wallet connection, no sign-in, no payment required to scan.

## Functional requirements

### REQ-1 — Scan by address
- WHEN a user enters a contract address (BSC, chain 56; EVM hex, 0x + 40 hex chars)
  THEN the app validates the format and runs a full scan.
- WHEN the address is malformed THEN the app shows a clear error and scans nothing.

### REQ-2 — Verified-source fetch
- WHEN a scan starts THEN the engine fetches verified source from Sourcify
  (v2 API, chain 56). If the contract is unverified, the engine records
  "unverified" as a finding and continues with on-chain checks only.

### REQ-3 — Deterministic rules engine
The engine MUST run these checks (each returns severity + evidence + line refs):
- R1. Verification status (Sourcify exact match / partial / none).
- R2. Honeypot patterns in source: hidden transfer restrictions, blacklists,
  max-tx / max-wallet limits that only the owner can change, trading-disabled
  flags, fee setters with no cap.
- R3. Mintable: owner can mint new supply (mint function callable by owner).
- R4. Pausable: owner can pause transfers.
- R5. Hidden owner: owner is a contract, or ownership was never renounced
  (owner() returns a live address).
- R6. Renounce status: owner() == 0x0 means renounced (good).
- R7. LP burn share: share of the main pair's LP tokens held by burn addresses
  (0x000…dEaD / 0x0) via eth_call balanceOf.
- R8. Pair-share proxy (not a top-holder scan): the share of total
  supply sitting in the main DEX pair. The proxy is by design, not by
  missing data: a 20,000-block window of movement is not a holder list,
  and scoring it as one would misread large tokens. (The dossier does
  a real Transfer-log scan for its bubble map; see the 2026-11-26
  addendum below. The R8 score itself never uses log data.) Labelled as
  a proxy wherever it is shown, never as a holder scan. (Best effort;
  "unknown" if the pair data is missing.)
- R9. Liquidity & pair health (Dexscreener): liquidity USD, pair age, 24h
  volume, buy/sell balance.
- WHEN any data source fails THEN that check reports "unknown" and the scan
  continues; the scan MUST never crash on a missing source.

### REQ-4 — Deterministic risk score
- The risk score is an integer 0–100, computed ONLY from the engine findings.
- Adding a finding MUST NEVER lower the score (monotonic).
- The same findings MUST always produce the same score (deterministic).
- No findings → score 0. Score bands: 0–12 "Resting in peace",
  13–49 "Mildly haunted", 50–74 "Haunted", 75–100 "Possessed".
  One medium finding (12) is the edge of Resting; two mediums (24) already
  read Mildly haunted.

### REQ-5 — LLM explainer
- WHEN a scan completes THEN an LLM writes a plain-English summary of the
  findings, citing file and line only for source-based findings and stating
  the measured on-chain value for on-chain findings — never inventing a
  line for a finding that has none.
- The explainer MUST NOT invent vulnerabilities not present in the findings.
- The explainer MUST NEVER call a contract "audited" or "safe" — the strongest
  allowed wording is "no red flags found in this scan".
- The explainer runs through a free, keyless LLM endpoint (Pollinations) so
  the app works with zero API keys.

### REQ-6 — Haunted UI
- The result page shows: the ghost meter (risk score dial), the band label,
  each finding as a card (severity, title, plain explanation, evidence with
  line refs), the LLM summary, the address dossier (identity card, bubble
  map from Transfer logs, transfer flow, timeline), and a "scan again"
  action. A wallet address shows a dedicated wallet panel with no score
  instead of the meter and findings.
- The home page offers one-click sample scans (three filed cases: SELO and
  AGIO, both haunted, and CAKE, clean) so judges can see the app work in
  seconds.
- No emoji in the UI; Lucide icons only. One accent colour. A visible
  disclaimer: "SpectreScan is not an audit. Never invest more than you can
  afford to lose."

### REQ-7 — MCP server
- A standalone MCP server (Node, @modelcontextprotocol/sdk) exposes tools:
  `getContractSource`, `getTokenInfo`, `getPairInfo`, `scanContract`.
- The server MUST be runnable with `npm run mcp` and configured in
  `.kiro/settings/mcp.json` so Kiro can call it.

### REQ-8 — Hooks
- An agent hook fires on save of any file under `app/src/lib/engine/`:
  re-run the fixture scan suite and TypeScript typecheck.
- The hook commands MUST be runnable by hand (`npm run test:fixtures`,
  `npm run typecheck`) and MUST pass before a submission build.

### REQ-9 — Tests
- Property-based tests (fast-check) prove: score in [0,100], determinism,
  monotonicity, and "no findings → 0".
- Fixture tests scan three known contracts live (one haunted honeypot, one
  hidden-owner token, one clean token) and assert the expected bands.

## Non-functional requirements

- NFR-1: No API keys anywhere. All data sources are public and keyless.
- NFR-2: A scan completes inside the 60-second host budget on a normal
  connection. Typical scans take 12–36 seconds, dominated by the
  25-second holder-scan deadline when PublicNode rate-limits; measured
  2026-11-26: SELO 36s, AGIO 30s, CAKE 12s (engine only), SELO 34.5s end
  to end.
- NFR-3: No wallet connection, no sign-in, no user data stored. Scan history
  lives only in the browser (localStorage), never on a server.
- NFR-4: The repo is public, MIT-licensed, contains `/.kiro` at the root,
  and `/.kiro` is NOT in `.gitignore`.
- NFR-5: All code is new, written after Oct 30, 2026. Standard frameworks
  and libraries are allowed and are disclosed in the README.

## Out of scope

- Multi-chain scanning (BSC only for the demo; the engine is hardcoded to
  BSC chain 56).
- Automatic trading, buying, or selling.
- Storing scans server-side or user accounts.

## Addendum — Seance redesign + address dossier (2026-11-26)

Written after the original spec, when the product grew past it. The
original REQ-1…REQ-9 still hold; this addendum records what was added
and what changed. It does not renumber the requirements.

- **Address dossier.** Every scan now returns a dossier alongside the
  score: an identity card (wallet or contract, token metadata, verified
  source, proxy status, token age, first minter, pair — every row with
  its source, "unknown" where the chain cannot say), a bubble map of
  the top 12 movers from real Transfer logs in the last 20,000 blocks,
  a transfer flow (total moved, transfer count, top senders/receivers,
  biggest moves), and a timeline from first seen to scanned. The log
  scan runs in 5,000-block chunks against PublicNode (the only free
  endpoint that answers `eth_getLogs`), up to three attempts per chunk,
  25-second deadline, 50,000-event cap. A cut-short scan is labelled
  partial; zero logs read means "unavailable", never invented holders.
  The dossier never feeds the R8 score, which stays the pair-share
  proxy by design.
- **EOA detection.** An address with no contract code (`eth_getCode`
  returns 0x) is a wallet, not a token: score 0, one info finding, no
  token checks, no explainer, no recent-scan save, and the UI renders
  a dedicated wallet panel.
- **The Seance.** The home page is a four-act scroll journey (scan,
  known hauntings, autopsy, lab) with a Three.js spectral core, a
  looping hero mist video, and an effects canvas. New pages:
  `/registry` (scan history from localStorage plus the three fixtures,
  never invented usage) and `/how-it-works` (the nine checks, the
  scoring table, the honest limits).
- **API limits.** The scan route caches for 5 minutes (200 entries
  max, oldest first out) and rate-limits to 60 scans per rolling
  minute (429 + `Retry-After: 60`).
- **Explainer fallback.** When the LLM fails, the route writes a local
  verdict from the findings, labelled model-free in the UI, with a
  Retry button. The UI never falls back to the raw findings list.
- **Demo video.** A < 3-minute demo video (1:47, 1280x720) was recorded
  from the live redesign. The video script is kept outside the repo.
