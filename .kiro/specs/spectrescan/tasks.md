# SpectreScan — Tasks

> Implementation plan for the Kiroween 2026 entry. Each task maps to the
> requirements (REQ-*) and design sections it implements. Check off as done.

## Phase 1 — Foundation
- [x] 1. Scaffold Next.js 16 app (TypeScript, App Router, Tailwind) in `app/`.
- [ ] 2. Install Kiro CLI 3.1.0 (`curl -fsSL https://cli.kiro.dev/install | bash`);
      verify `kiro-cli --version`. NOT DONE: no `kiro-cli` binary exists in
      this build environment and `~/.kiro/settings/cli.json` is empty, so
      the install claim in KIRO_USAGE.md was wrong and is fixed there.
      Interactive agent use needs a user sign-in (Google/GitHub/AWS Builder
      ID) — that step is the entrant's. The `.kiro` artifacts below are the
      real, working evidence of the Kiro workflow (specs, steering, hooks,
      MCP config, all authored as files).
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
      share, R8 pair-share proxy, R9 liquidity/pair health.
- [x] 11. `scan.ts` — orchestrates fetch → checks → score → ScanResult;
      per-check try/catch so one failed source never kills the scan (REQ-3).
- [x] 12. `fixtures.ts` — sample contracts (SELO, AGIO, CAKE) + expected bands.

## Phase 3 — Explainer + API
- [x] 13. `src/lib/explainer.ts` — Pollinations prompt builder + fetch with
      fallback to findings-only text (REQ-5).
- [x] 14. `src/app/api/scan/route.ts` — POST { address } → ScanResult;
      address validation, 5-min in-memory cache (200 entries max), 60/min
      rate limit. No overall timeout: bounded by per-call timeouts, the
      25s holder-scan deadline, and the 10s explainer timeout.

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
      specs, hooks, steering, MCP, testing). (The demo video script lives
      outside the repo.)
- [x] 26. Verify `.kiro` is at the repo root and NOT in `.gitignore`.
- [ ] 27. Final check against the Devpost rules (repo public + license,
      video < 3 min on YouTube, live demo URL, category Frankenstein).
      Deadlines: free 4,000 Kiro credits form by Dec 2 01:30 IST; submit
      before Dec 5 03:30 IST.
      NOTE: GitHub repo creation, Devpost submission, video recording/upload
      are entrant steps — not done here.

## Phase 8 — Seance redesign + address dossier (2026-11-26, after the spec)
- [x] 28. Holder log scan (`app/src/lib/engine/holders.ts`): Transfer logs
      in 5,000-block chunks, 25s deadline, 50,000-event cap, up to three
      attempts per chunk; partial-window labelling.
- [x] 29. Dossier UI: identity card, bubble map, transfer flow, timeline
      (`IdentityCard.tsx`, `BubbleMap.tsx`, `TransferFlow.tsx`).
- [x] 30. EOA detection: `eth_getCode` 0x means wallet, score 0, dedicated
      wallet panel; verified live on the entrant's wallet.
- [x] 31. The Seance home page: four-act scroll journey, SpectralCore
      (Three.js), hero mist video, effects canvas, sound toggle.
- [x] 32. New pages: `/registry` and `/how-it-works`.
- [x] 33. Local verdict fallback + Retry button (explainer.ts, route.ts);
      copy-on-write cache retry; EOA guard on the retry path.
- [x] 34. Demo video v2 re-recorded from the redesign (1:47, 1280x720).
      Upload to YouTube and Devpost submit are entrant steps (see 27).
- [x] 35. Kira re-reviews: upgrade review, Seance redesign review, and this
      docs review (see `~/workspace/council/meetings/spectrescan-kira-review/MEETING.md`).
