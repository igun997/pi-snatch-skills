# Settled Scroll Capture Implementation Plan

**Goal:** Capture lazy and motion-driven full pages after deterministic settle and scroll loading.

1. Add browser client methods `wait(ms)`, `scroll(delta)`, `scrollToTop()`, and `evalJson()` document-height probes. Extend `CaptureBrowser` and fake capture tests.
2. Write failing tests for eight-second settle, 700px/500ms steps, return-to-top, 60-step cap, and height stability metadata.
3. Add `settleAndScroll()` in `src/capture.ts`; run it before screenshots/facts for each profile.
4. Add reduced-motion capture profile and record it separately while keeping motion facts from normal profiles.
5. Document timing metadata, run full tests/typecheck, commit/push.
