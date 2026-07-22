# Website Design Snatch Completion Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Complete missing command wrappers, extension workflow, local validation orchestration, integration coverage, and acceptance evidence.

**Architecture:** Keep existing contracts as boundary. CLI wrappers load durable job data and call narrowly-scoped services. Extension creates origin-scoped consented jobs and delegates capture/analysis or local validation without source copying or repairs. Tests use fakes for browser behavior; only final acceptance opens user-approved URL.

**Tech Stack:** Node 22, TypeScript, TypeBox, node:test, tsx, agent-browser, pngjs, pixelmatch.

---

## Task 1: Add durable job loading and analysis CLI

**Files:** `src/jobs.ts`, `scripts/analyze.mjs`, `tests/jobs.test.ts`, `tests/cli.test.ts`

1. Add failing tests for loading a safe `job.json` from `.pi/snatch/<id>` and for analysis CLI output path.
2. Run targeted tests; confirm missing exports/scripts fail.
3. Implement `loadJob()` with safe job ID/path checks; CLI reads only profile `facts.json`, produces output brief/motion/provenance, prints output path only.
4. Rerun targeted tests, then full suite/typecheck.

## Task 2: Add PNG comparison and local validation services

**Files:** `src/compare.ts`, `src/validate.ts`, `scripts/compare.mjs`, `scripts/e2e.mjs`, `tests/compare.test.ts`, `tests/validate.test.ts`

1. Add failing tests for PNG output artifacts, explicit dimension rejection, all three local profiles, declarative-safe scenarios, app-owned failed requests, and report persistence.
2. Verify targeted tests fail for missing functions.
3. Implement minimal PNG comparison with `pngjs`/`pixelmatch`; add validation orchestration via injected local browser factory. Reject remote URLs and unsafe scenarios before browser actions.
4. Add wrappers accepting job ID and explicit local URL. Output report path only.
5. Rerun targeted tests, then full suite/typecheck.

## Task 3: Complete extension commands and tools

**Files:** `extensions/snatch-design.ts`, `src/extension-state.ts`, `tests/extension-state.test.ts`, `tests/extension.test.ts`

1. Add failing tests for exact-origin state, job creation persistence, tool schema existence, attempt cap, and no capture/validation tool execution before consent.
2. Run targeted tests; verify expected failure.
3. Register interactive `/snatch` consent selection/confirmation; add `/snatch-status`; add `snatch_capture` and `snatch_validate`. Tool calls load durable job state, preserve cancellation signal, return compact artifact paths/state, and never repair files.
4. Run tests/typecheck and Pi extension smoke.

## Task 4: Script-level integration fixture

**Files:** `tests/integration.test.ts`, `examples/static-fixture/*`, `README.md`

1. Add failing integration test: consented fixture job -> mocked capture facts -> analysis -> local validation report, plus forced screenshot diff.
2. Confirm failure; implement only required fixture/test seams.
3. Run integration test, full suite, typecheck.

## Task 5: Final acceptance

**Files:** `README.md`

1. Record runtime versions.
2. Use user-authorized `https://www.javapixa.com/` for unauthenticated passive capture. Inspect artifacts: metadata lacks queries/page source; only derived evidence exists.
3. Serve static fixture on loopback. Validate desktop/mobile/reduced-motion; modify one style to force diff failure, restore exact file, rerun.
4. Exercise rejection paths: missing consent, file URL, cross-origin capture, remote validation URL, fourth repair attempt, forbidden submit scenario.
5. Record date/results only in README. Run `npm test`, `npm run typecheck`, Pi smoke, `git status --short`.
