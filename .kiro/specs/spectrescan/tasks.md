# SpectreScan — Tasks

> Implementation plan for the Kiroween 2026 entry. Each task maps to the
> requirements (REQ-*) and design sections it implements. Check off as done.

## Phase 1 — Foundation
- [x] 1. Scaffold Next.js 16 app (TypeScript, App Router, Tailwind) in `app/`.
- [x] 2. Install Kiro CLI 3.1.0 (`curl -fsSL https://cli.kiro.dev/install | bash`);
      verify `kiro-cli --version`. NOTE: interactive agent use needs a user
      sign-in (Google/GitHub/AWS Builder ID) — that step is the entrant's,
      not done here. The `.kiro` artifacts below are the real, working
      evidence of the Kiro workflow.
- [x] 3. Write spec (requirements.md, design.md, tasks.md) — this file.
- [x] 4. Write steering docs (`.kiro/steering/`): security, honesty, style.
- [x] 5. Write agent hook (`.kiro/hooks/verify-on-save.json`) + MCP config
      (`.kiro/settings/mcp.json`).

## Phase 2 — Rules engine (`app/src/lib/engine/`)
- [x] 6. `types.ts` — Finding, ScanResult, score-band types.
- [x] 7. `scoring.ts` — severity weights, score(), band() (REQ-4).
- [x] 8. `fetchers.ts` — Sourcify source fetch, Dexscreener pairs fetch,
      BSC RPC helpers (eth_call, eth_getLogs, eth_getCode) with timeouts and
      multi-RPC fallback (dataseed1, dataseed2, publicnode).
- [x] 9. `sourceChecks.ts` — pattern checks R2–R4 with file:line evidence.
- [x] 10. `chainChecks.ts` — R1 verification, R5/R6 owner checks, R7 LP burn
      share, R8 top-holder scan (bounded), R9 liquidity/pair health.
- [x] 11. `scan.ts` — orchestrates fetch → checks → score → ScanResult;
      per-check try/catch so one failed source never kills the scan (REQ-3).
- [x] 12. `fixtures.ts` — sample contracts (SELO, AGIO, CAKE) + expected bands.

## Phase 3 — Explainer + API
- [x] 13. `src/lib/explainer.ts` — Pollinations prompt builder + fetch with
      fallback to findings-only text (REQ-5).
- [x] 14. `src/app/api/scan/route.ts` — POST { address } → ScanResult;
      address validation, 5-min in-memory cache, 30s overall timeout.

## Phase 4 — UI
- [x] 15. Home page: address input, sample-contract buttons, haunted theme,
      disclaimer (REQ-6).
- [x] 16. Result view: GhostMeter SVG dial, band label, LLM verdict,
      findings cards with severity + evidence lines (REQ-6).
- [x] 17. Polish: loading states, error states, mobile layout, no emoji,
      Lucide icons only.

## Phase 5 — MCP server (`mcp-server/`)
- [x] 18. MCP package: tools getContractSource, getTokenInfo, getPairInfo,
      scanContract (reuse engine code) (REQ-7).
- [x] 19. Build it, smoke-test each tool over stdio, wire
      `.kiro/settings/mcp.json`.

## Phase 6 — Tests + verification
- [x] 20. Property tests (vitest + fast-check): score bounds, determinism,
      monotonicity, empty → 0 (REQ-9).
- [x] 21. Unit tests: pattern matcher on synthetic source snippets.
- [x] 22. Fixture tests: live scans of SELO / AGIO / CAKE asserting bands.
- [x] 23. `npm run typecheck` and `npm run test:fixtures` pass; verify the
      hook commands run by hand (REQ-8).
- [x] 24. `npm run build` passes; boot dev server; curl the scan API for all
      three fixtures; confirm the UI renders.

## Phase 7 — Submission artefacts
- [x] 25. README.md (run instructions, architecture, data sources, disclosure
      of frameworks), LICENSE (MIT), KIRO_USAGE.md (how Kiro was used:
      specs, hooks, steering, MCP, testing), VIDEO_SCRIPT.md (< 3 min).
- [x] 26. Verify `.kiro` is at the repo root and NOT in `.gitignore`.
- [ ] 27. Final check against the Devpost rules (repo public + license,
      video < 3 min on YouTube, live demo URL, category Frankenstein).
      NOTE: GitHub repo creation, Devpost submission, video recording/upload
      are entrant steps — not done here.
