# How Kiro was used to build SpectreScan

This write-up is the honest record of what Kiro produced for this project
and what the entrant still has to do. Nothing here is claimed that did not
happen.

## What Kiro is in this project

Kiro CLI is NOT installed in this build environment (no `kiro-cli`
binary; `~/.kiro/settings/cli.json` is empty). The `.kiro` artifacts
below were authored as files; installing the CLI and signing in are
entrant steps, same as the sign-in noted below. The project is
structured the Kiro way: specs first,
then implementation from the specs, with steering, hooks, and an MCP server
all living in `/.kiro` at the repo root. The `/.kiro` directory is committed
and is NOT in `.gitignore`.

## Spec-driven development (the core of it)

The spec was written **before any implementation code**:

- `.kiro/specs/spectrescan/requirements.md` — the problem, the users, and
  nine numbered requirements (REQ-1 … REQ-9) with acceptance behaviour.
- `.kiro/specs/spectrescan/design.md` — architecture, data flow, the scoring
  model, per-check design, and the honest limits (public RPCs refuse
  `eth_getLogs`; V3 pools have no LP token). Updated during the build when
  live testing proved the first design wrong in three places — see
  "What the build taught us" below.
- `.kiro/specs/spectrescan/tasks.md` — the phased task list, checked off as
  work landed. Every implementation file from the original build maps to a
  task and a requirement. The Seance redesign and address dossier (holder
  log scan, dossier components, SpectralCore, /registry, /how-it-works,
  EOA detection) landed after the spec was written and are recorded in
  tasks.md Phase 8, not in the original task list.

## Steering (`.kiro/steering/`)

Three steering documents act as hard rules for every file in the repo:

- `security.md` — no secrets ever (all data sources are public and keyless),
  no wallet or signing code, never execute fetched contract source, never
  weaken a check to pass a test.
- `honesty.md` — never call a contract "audited" or "safe"; every finding
  must cite evidence; the LLM prompt carries the honesty block verbatim;
  do not claim Kiro agent runs that did not happen.
- `style.md` — one accent colour, two font families, no emoji, Lucide icons
  only, specific copy.

## Agent hooks (`.kiro/hooks/verify-on-save.json`)

Two hooks are defined, both with commands that run by hand and pass:

1. **verify-engine-on-save** — on save of any file under
   `app/src/lib/engine/`, re-run the live fixture scan suite
   (`npm run test:fixtures`) and TypeScript typecheck (`npm run typecheck`).
2. **forbid-weakening-tests** — on save of the scorer or the tests, re-run
   the full suite. The guardrail is explicit: if a fixture fails, fix the
   engine or the expectation — never lower a threshold silently.

Both hook commands were verified by running them directly during the build.

## MCP server (`.kiro/settings/mcp.json` + `mcp-server/`)

A real MCP server built for this project, registered in
`.kiro/settings/mcp.json` so Kiro can call it. It exposes four tools —
`getContractSource`, `getTokenInfo`, `getPairInfo`, `scanContract` — and all
four were smoke-tested over stdio (`mcp-server/smoke-test.mjs`): CAKE token
facts, CAKE pair data, AGIO verified source, and a full SELO scan (logged,
no score asserted; the live fixture tests assert SELO at 100 /
Possessed). The server imports the exact same engine code as the web
app, so Kiro and the UI can never disagree.

## Testing (the Kiro "trust but verify" habit)

- **Property-based tests** (`vitest` + `fast-check`): the score is proven to
  stay in [0,100], be deterministic under reordering, and be monotonic
  (adding a finding never lowers it). 500/300-run property checks.
- **Unit tests**: the source-pattern matcher on synthetic Solidity, asserting
  exact line numbers.
- **Live fixture tests**: SELO, AGIO, and CAKE scanned against real
  Sourcify/RPC/Dexscreener data, asserting their bands.
- All 93 tests pass (8 files); `tsc --noEmit` is clean; `next build` succeeds.

## What the build taught us (spec updated, not hidden)

Three things the first design got wrong, found by live testing and fixed in
the engine — not in the tests:

1. **CAKE scored 55 (Haunted) on the first run.** Two blunt rules: any
   `function mint(` was HIGH, and any contract owner was HIGH. But CAKE's
   mint is governed by the MasterChef contract, whose source is public.
   Fix: context-aware severity — minting governed by a verified contract
   scores lower; a verified owner contract scores LOW, an unverified one
   HIGH. CAKE now scores 46 (Mildly haunted).
2. **SELO scored 17 (Resting) on the first run.** Its source has no
   blacklist/mint/pause — but its constructor hands 100% of supply to the
   deployer and it has no trading pair. Fix: a deployer-mint pattern check
   plus a combination rule (deployer-minted supply + no pair → HIGH).
   SELO now scores 100 (Possessed).
3. **Public BSC RPCs refuse `eth_getLogs`** (verified: -32005 "limit
   exceeded" even for 100-block ranges). Fix: the holder check falls back
   to a pair-share proxy instead of failing or guessing.

## What the entrant still has to do (Kiro sign-in needed)

- **Kiro sign-in**: the Kiro CLI's interactive agent features need a
  sign-in (Google, GitHub, or AWS Builder ID — no AWS account required).
  That sign-in was not done in this build environment because it needs the
  entrant's own account. The `.kiro` artifacts above are real and complete
  without it.
- **Free credits**: request the one-time 4,000 Kiro credits via the Devpost
  Resources-tab form by **Dec 1, 2026, 12:00 PM PT** if wanted; credits
  must be redeemed by Dec 4.
- **GitHub repo, Devpost submission, demo video**: the entrant's steps —
  create the public repo (with the MIT license visible), deploy the app to a
  host that allows ~60s functions (Render free tier recommended; Vercel
  Hobby's 10s limit is too short for a scan), record the < 3-minute demo
  video, and submit on Devpost before Dec 4, 2026, 2:00 PM PT.
