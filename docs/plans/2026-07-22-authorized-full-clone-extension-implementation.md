# Authorized Full-Clone Extension Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Add a reusable, consented full-clone mode that mirrors a user-owned or authorized public origin into a local artifact or explicit project-local directory.

**Architecture:** `/snatch` retains ownership consent. A pure full-clone module discovers, downloads, maps, and rewrites same-origin document assets; the extension exposes the operation after consent. A loopback validator records browser evidence for desktop and mobile without form interaction.

**Tech Stack:** TypeScript, Node `fetch`, Node `node:test`, agent-browser, SHA-256 filesystem manifests.

---

### Task 1: Extend clone lifecycle contracts

**Files:**
- Modify: `src/contracts.ts`
- Modify: `src/jobs.ts`
- Test: `tests/jobs.test.ts`

**Step 1: Write failing tests**

Add tests for `mirroring` and `mirrored` job states. Verify persisted jobs accept these states and preserve immutable consent metadata.

**Step 2: Run test**

Run: `node --import tsx --test tests/jobs.test.ts`

Expected: FAIL because clone statuses are not accepted.

**Step 3: Implement minimal contract changes**

Add `mirroring` and `mirrored` to `JobStatus`; validate both in `loadJob()`.

**Step 4: Verify test and typecheck**

Run:

```sh
node --import tsx --test tests/jobs.test.ts
npm run typecheck
```

**Step 5: Commit**

```sh
git add src/contracts.ts src/jobs.ts tests/jobs.test.ts
git commit -m "feat: add full clone job states"
```

### Task 2: Build pure discovery, mapping, and rewriting utilities

**Files:**
- Create: `src/full-clone.ts`
- Create: `tests/full-clone.test.ts`

**Step 1: Write failing tests**

Test extraction of `src`, `href`, `srcset`, CSS `url()`, JS static imports, and same-origin absolute URLs. Reject external origins. Test collision-proof deterministic paths, query/fragment stripping, relative rewrites, and no path traversal.

**Step 2: Run failing test**

Run: `node --import tsx --test tests/full-clone.test.ts`

Expected: FAIL because module is absent.

**Step 3: Implement pure helpers**

Export URL discovery, source-to-local path mapping, and content rewriting. Allow only `http`/`https` assets on exact consent origin. Keep external navigation links untouched. Replace integrity attributes only when a rewritten script or stylesheet needs it. Hash source URL into stable paths.

**Step 4: Verify test**

Run: `node --import tsx --test tests/full-clone.test.ts`

Expected: PASS.

**Step 5: Commit**

```sh
git add src/full-clone.ts tests/full-clone.test.ts
git commit -m "feat: add full clone asset rewriting"
```

### Task 3: Add bounded downloader and manifest

**Files:**
- Modify: `src/full-clone.ts`
- Modify: `src/contracts.ts`
- Modify: `tests/full-clone.test.ts`

**Step 1: Write failing tests**

Inject a fake fetcher. Assert recursive CSS/JS discovery, 500-asset/250-MB/depth-four limits, 30-second abortable fetches, failure continuation, digest output, and URL query redaction in failure records.

**Step 2: Run failing test**

Run: `node --import tsx --test tests/full-clone.test.ts`

Expected: FAIL because no downloader exists.

**Step 3: Implement `cloneAuthorizedSite()`**

Require `owned-or-authorized` permission and a same-origin target. Resolve default mirror directory under job artifacts or optional output beneath project root, rejecting traversal and symlink escape. Download with browser-like User-Agent/Referer, 20 workers, deterministic files, and `mirror-manifest.json`.

**Step 4: Verify tests**

Run:

```sh
node --import tsx --test tests/full-clone.test.ts
npm run typecheck
```

**Step 5: Commit**

```sh
git add src/full-clone.ts src/contracts.ts tests/full-clone.test.ts
git commit -m "feat: mirror authorized site assets"
```

### Task 4: Add extension and CLI entry points

**Files:**
- Modify: `extensions/snatch-design.ts`
- Create: `scripts/full-clone.mjs`
- Modify: `tests/extension.test.ts`
- Create: `tests/full-clone-cli.test.ts`

**Step 1: Write failing tests**

Assert extension registers `/snatch-full-clone` and `snatch_full_clone`. Assert tool rejects `private-learning`, cross-origin targets, and out-of-project output; assert it transitions state and returns mirror manifest path. Test CLI required arguments and manifest-only stdout.

**Step 2: Run failing tests**

Run:

```sh
node --import tsx --test tests/extension.test.ts tests/full-clone-cli.test.ts
```

Expected: FAIL because command/tool/script are absent.

**Step 3: Implement entry points**

Command accepts job ID and optional output directory, requires a UI confirmation that copied source material is authorized, then delegates. Tool uses existing consent with no second UI. CLI loads job and invokes clone. All paths use existing `loadJob`, `canCapture`, and `updateJobStatus`.

**Step 4: Verify tests**

Run same command. Expected: PASS.

**Step 5: Commit**

```sh
git add extensions/snatch-design.ts scripts/full-clone.mjs tests/extension.test.ts tests/full-clone-cli.test.ts
git commit -m "feat: expose authorized full clone tools"
```

### Task 5: Add full-clone browser validation

**Files:**
- Create: `src/full-clone-validate.ts`
- Modify: `src/agent-browser.ts`
- Modify: `tests/full-clone.test.ts`

**Step 1: Write failing tests**

Test desktop/mobile loopback browser profiles, screenshot persistence, console error findings, failed local-request findings, and no scenario actions.

**Step 2: Run failing test**

Run: `node --import tsx --test tests/full-clone.test.ts`

Expected: FAIL because validator is absent.

**Step 3: Implement validator**

Serve explicit local URL only. Record `mirror-validation/<profile>/` screenshots and diagnostics. Do not click, type, submit, or persist browser auth state. Write `mirror-validation-report.json`.

**Step 4: Verify tests**

Run: `node --import tsx --test tests/full-clone.test.ts`

Expected: PASS.

**Step 5: Commit**

```sh
git add src/full-clone-validate.ts src/agent-browser.ts tests/full-clone.test.ts
git commit -m "feat: validate mirrored sites locally"
```

### Task 6: Replace skill instructions and document installation/use

**Files:**
- Modify: `skills/full-clone/SKILL.md`
- Modify: `README.md`
- Test: `tests/package.test.ts`

**Step 1: Write failing package test**

Assert package exposes full-clone skill and README documents `/snatch-full-clone`, artifact default, explicit output, and owned-or-authorized requirement.

**Step 2: Run failing test**

Run: `node --import tsx --test tests/package.test.ts`

Expected: FAIL until docs and skill route through extension workflow.

**Step 3: Update docs**

Replace copy-paste open mirror script with concise tool workflow. Document outputs, limits, validation, cleanup, and reusability contract. Do not claim that arbitrary third-party sites can be copied.

**Step 4: Full verification**

Run:

```sh
npm test
npm run typecheck
git diff --check
```

Expected: all tests pass, typecheck exits 0, diff clean.

**Step 5: Commit**

```sh
git add skills/full-clone/SKILL.md README.md tests/package.test.ts
git commit -m "docs: document authorized full clone workflow"
```
