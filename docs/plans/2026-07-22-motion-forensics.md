# Motion Forensics Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Capture consented scroll-motion evidence, derive rebuild-safe motion specifications, and validate local rebuild motion at matching scroll states.

**Architecture:** Capture five passive desktop/mobile scroll states after page settling. Persist only screenshots and safe visual facts, derive effect observations from adjacent samples, and validate loopback rebuilds against the same states. Reduced-motion validation detects active infinite animation and playing video.

**Tech Stack:** TypeScript, Node.js, agent-browser, pngjs, node:test.

---

### Task 1: Add pure motion planning and observation analysis
- Create `src/motion.ts` and `tests/motion.test.ts`.
- Test scroll sample planning and safe reveal/zoom/sticky/video classifications.
- Run `node --import tsx --test tests/motion.test.ts` red, then green.

### Task 2: Persist motion evidence during capture
- Modify `src/browser-introspection.ts`, `src/capture.ts`, `tests/capture.test.ts`.
- Capture five scroll states plus safe motion facts for desktop/mobile and record every artifact in manifest.

### Task 3: Emit rebuild-safe motion specification
- Modify `src/analyze.ts`, `tests/analyze.test.ts`, `skills/motion-forensics/SKILL.md`, `README.md`.
- Write CSS animation data and scroll observations without URLs, DOM text, source, cookies, or storage.

### Task 4: Validate local scroll states and reduced motion
- Modify `src/validate.ts`, `tests/validate.test.ts` or integration coverage.
- Compare local desktop/mobile motion-state screenshots against capture baselines; detect reduced-motion violations while retaining loopback and safe-scenario limits.

### Task 5: Verify
- Run `npm run typecheck` and `npm test`.
- Do not commit without explicit user request.
