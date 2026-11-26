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
   cites exact source lines.
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
- R8. Top-holder concentration: top-10 share of total supply, computed from a
  bounded Transfer-log scan (best effort; "unknown" if the scan fails).
- R9. Liquidity & pair health (Dexscreener): liquidity USD, pair age, 24h
  volume, buy/sell balance.
- WHEN any data source fails THEN that check reports "unknown" and the scan
  continues; the scan MUST never crash on a missing source.

### REQ-4 — Deterministic risk score
- The risk score is an integer 0–100, computed ONLY from the engine findings.
- Adding a finding MUST NEVER lower the score (monotonic).
- The same findings MUST always produce the same score (deterministic).
- No findings → score 0. Score bands: 0–24 "Resting in peace",
  25–49 "Mildly haunted", 50–74 "Haunted", 75–100 "Possessed — do not touch".

### REQ-5 — LLM explainer
- WHEN a scan completes THEN an LLM writes a plain-English summary of the
  findings, citing exact source lines (file:line) for every claim.
- The explainer MUST NOT invent vulnerabilities not present in the findings.
- The explainer MUST NEVER call a contract "audited" or "safe" — the strongest
  allowed wording is "no red flags found in this scan".
- The explainer runs through a free, keyless LLM endpoint (Pollinations) so
  the app works with zero API keys.

### REQ-6 — Haunted UI
- The result page shows: the ghost meter (risk score dial), the band label,
  each finding as a card (severity, title, plain explanation, evidence with
  line refs), the LLM summary, and a "scan again" action.
- The home page offers one-click sample scans (a known haunted contract and a
  known clean one) so judges can see the app work in seconds.
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
- NFR-2: A scan completes in under 30 seconds on a normal connection.
- NFR-3: No wallet connection, no sign-in, no user data stored. Scan history
  lives only in the browser session.
- NFR-4: The repo is public, MIT-licensed, contains `/.kiro` at the root,
  and `/.kiro` is NOT in `.gitignore`.
- NFR-5: All code is new, written after Oct 30, 2026. Standard frameworks
  and libraries are allowed and are disclosed in the README.

## Out of scope

- Multi-chain scanning (BSC only for the demo; the engine is chain-parameterised).
- Automatic trading, buying, or selling.
- Storing scans server-side or user accounts.
