# Website Design Snatch: Validated Design

## Goal

Build a distributable Pi package that converts an authorized public website URL into:

1. a private, local visual baseline;
2. clean, reusable frontend components; and
3. evidence-backed browser validation.

Generated code must auto-detect its host framework and fall back to static semantic HTML/CSS/JS. The package uses `agent-browser` CLI for capture and agent-reviewed E2E validation.

## Boundaries

- Target modes: (a) domains user owns or has written permission to reproduce, and (b) public sites for private learning without asset reuse or publication.
- Extension prompts for an explicit permission mode per URL and persists decision with job metadata.
- No publishing, impersonation, protected asset reuse, authenticated testing, payment flows, destructive actions, or form submissions without explicit approval.
- Capture documents visual and behavioral facts. Rebuilt component code is new implementation, never copied source JS/CSS.

## Package layout

```text
pi-snatch-skills/
├─ package.json
├─ extensions/
│  └─ snatch-design.ts
├─ skills/
│  ├─ snatch-website/
│  ├─ rebuild-components/
│  ├─ motion-forensics/
│  └─ visual-e2e/
├─ scripts/
│  ├─ capture.mjs
│  ├─ analyze.mjs
│  ├─ compare.mjs
│  └─ e2e.mjs
└─ docs/
   └─ plans/
```

`package.json` exposes both `extensions/` and `skills/` through Pi package manifest. Runtime Pi packages remain peer dependencies. Other runtime dependencies belong in `dependencies`.

## Extension

`snatch-design.ts` provides commands and LLM tools:

- `/snatch <url>` creates capture job after permission confirmation.
- `/snatch-status` renders current and completed job stages.
- `snatch_capture` invokes capture workflow.
- `snatch_validate` invokes browser validation and bounded repair loop.

Jobs write only to `.pi/snatch/<job-id>/`, which is git-ignored. Job content includes source URL, permission mode, timestamp, screenshots, DOM/a11y snapshots, interaction map, console/network logs, visual diff report, and repair report.

Before its first browser job, extension runs `agent-browser skills get core --full`, keeping command guidance aligned to installed CLI version. Users install CLI with:

```bash
npm i -g agent-browser
agent-browser install
```

## Capture workflow

Use agent-browser rather than HTML-only scraping.

For desktop and mobile independently:

1. Navigate URL.
2. Capture viewport screenshots, DOM/accessibility snapshots, computed layout/style facts, and app-owned network diagnostics.
3. Exercise safe interactions: scrolling, hover, focus, navigation menus, dialogs, carousels, and non-submitting form validation.
4. Map animation triggers and properties: affected elements, transform/opacity states, timing, easing, staggering, interruption, breakpoint behavior, and reduced-motion behavior.

Default profiles: desktop `1440×900`; mobile `390×844` with touch and mobile UA. Capture runs with no authentication by default.

## Rebuild workflow

Framework adapter detects package manifests, lockfiles, routes, and local component conventions. Supported adapters initially: React/Next, Svelte, Vue; fallback is static semantic HTML/CSS/JS. Do not add a framework or animation library unless project evidence supports it.

Every job creates:

```text
output/
├─ baseline/            # private local comparison reference
├─ components/          # clean reusable implementation
├─ tokens.css
├─ motion-spec.json
└─ provenance.md
```

Process:

1. Derive page regions, semantic hierarchy, responsive layout, color/type/spacing tokens.
2. Extract only genuinely repeated patterns as components.
3. Produce private baseline.
4. Generate semantic, keyboard-accessible, responsive components.
5. Write machine-readable `motion-spec.json`.
6. Implement motion with project-native tools: CSS/Web Animations first, existing GSAP/Framer only when already installed.
7. Apply frontend-design principles: physical scene, intentional color strategy, typography hierarchy, purposeful motion, layout-transform-only animation, accessible states, and anti-generic-design review.
8. Record source mapping and restrictions in `provenance.md`.

## Browser validation and repair

`visual-e2e` checks rebuilt app, not file existence.

Profiles: desktop, mobile, and prefers-reduced-motion. Optional state variants cover open menus, hover/focus, dialogs, carousel state, and validation errors.

Loop:

1. Run local app and open generated route with agent-browser.
2. Capture screenshots and accessibility snapshot.
3. Execute interaction map with pointer and keyboard paths.
4. Collect console errors, app-owned failed requests, overflow, focus-order faults, and screenshot diffs.
5. Return diff artifacts and diagnostics to repair agent.
6. Repair agent changes only generated component files.
7. Repeat at most three times, then emit unresolved evidence.

Pass criteria:

- no new console errors;
- zero failed local/app-owned requests;
- required pointer and keyboard paths pass;
- reduced-motion disables nonessential movement;
- desktop and mobile visual differences below configurable, region-based thresholds;
- report identifies every accepted intentional difference.

## Out of scope for v1

- Publishing or hosting captures.
- Authenticated/production destructive workflow tests.
- Exact copying of source code, proprietary assets, or trademark identity.
- CI build blocking. This may become an opt-in phase after repair-loop quality proves reliable.
