# Tile-Stitch Full-Page Capture Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Produce verified full-page evidence by scrolling, capturing viewport tiles, and stitching them instead of trusting agent-browser's `--full` output.

**Architecture:** Capture computes document bounds, schedules vertically overlapping tiles from bottom to top, scrolls to each tile, and saves a viewport PNG reported by agent-browser. A PNG stitcher scales CSS coordinates to observed pixel dimensions, writes each tile into one or more bounded PNG segments, and returns all segment paths to capture manifest.

**Tech Stack:** TypeScript, Node.js, `pngjs`, `agent-browser`, `node:test`.

---

### Task 1: Add pure tile-plan and stitching module

**Files:**
- Create: `src/full-page-stitch.ts`
- Test: `tests/full-page-stitch.test.ts`

**Step 1: Write failing tests**

Cover vertical plan generation using 200 CSS-pixel overlap, exact last tile at document bottom, scale correction from CSS viewport to physical PNG pixels, compositing tile colors into expected output regions, and segmentation when output exceeds 30,000px tall.

**Step 2: Run tests to verify failure**

Run: `node --import tsx --test tests/full-page-stitch.test.ts`

Expected: FAIL because `src/full-page-stitch.ts` does not exist.

**Step 3: Write minimal implementation**

Export constants matching extension policy: 200px overlap, 30,000px primary limit, 8,000px secondary limit. Export pure helpers for bounds/tile planning and async PNG stitching. Read tile PNGs with `PNG.sync.read`, calculate physical offsets from first tile width divided by CSS viewport width, blit only intersecting image rectangles into output PNG segment(s), then write `full-page.png` or `full-page-<n>.png`.

**Step 4: Run tests to verify pass**

Run: `node --import tsx --test tests/full-page-stitch.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/full-page-stitch.ts tests/full-page-stitch.test.ts
git commit -m "feat: stitch full-page capture tiles"
```

### Task 2: Surface deterministic viewport capture paths from agent-browser

**Files:**
- Modify: `src/agent-browser.ts`
- Test: `tests/agent-browser.test.ts`

**Step 1: Write failing test**

Fake screenshot command output containing `Screenshot saved to /tmp/screenshot.png`. Assert client extracts source path, copies it to requested artifact path, and rejects unparseable output without creating an artifact.

**Step 2: Run test to verify failure**

Run: `node --import tsx --test tests/agent-browser.test.ts`

Expected: FAIL because screenshot output is ignored.

**Step 3: Write minimal implementation**

Run screenshot without unsupported path argument, parse only an absolute PNG path from agent-browser stdout, copy it into requested path, and return dimensions from `pngjs`. Expose `scrollTo(y)` through browser eval so capture positions are exact.

**Step 4: Run test to verify pass**

Run: `node --import tsx --test tests/agent-browser.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/agent-browser.ts tests/agent-browser.test.ts
git commit -m "fix: persist agent-browser viewport screenshots"
```

### Task 3: Replace one-shot full-page capture with tile capture and verification

**Files:**
- Modify: `src/capture.ts`
- Modify: `tests/capture.test.ts`

**Step 1: Write failing tests**

Make fake browser return documented CSS bounds and physical tile files. Assert capture requests each planned position, stitches `full-page.png`, records every generated segment in manifest, and leaves only viewport `page.png` plus full-page outputs; assert a tall mobile profile produces multiple full-page artifact records.

**Step 2: Run test to verify failure**

Run: `node --import tsx --test tests/capture.test.ts`

Expected: FAIL because capture still calls one-shot full-page screenshot.

**Step 3: Write minimal implementation**

Extend `CaptureBrowser` with document dimensions, absolute scroll, and viewport screenshot metadata. After existing lazy-content settle, determine bounds, generate tile plan, capture each tile into temporary profile tile directory, stitch output, remove temporary tiles, and include every stitch segment artifact in manifest. Keep `page.png` as top viewport evidence.

**Step 4: Run tests to verify pass**

Run: `node --import tsx --test tests/capture.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/capture.ts tests/capture.test.ts
git commit -m "fix: capture full pages through stitched tiles"
```

### Task 4: Verify full suite and real consented capture

**Files:**
- Modify: `README.md` only if artifact naming needs user documentation.

**Step 1: Run static checks**

Run: `npm run typecheck`

Expected: PASS.

**Step 2: Run full suite**

Run: `npm test`

Expected: PASS.

**Step 3: Run authorized live capture**

Use existing consented job only. Inspect output dimensions against introspected document bounds and ensure final tile includes footer.

**Step 4: Commit documentation or integration changes**

```bash
git add README.md src tests docs/plans
git commit -m "docs: describe stitched full-page evidence"
```
