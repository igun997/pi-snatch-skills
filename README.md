# Pi Design Snatch Skills

A Pi package for authorized website-design analysis only. Use it only on websites and accounts you own or are explicitly authorized to assess.

## Prerequisites

- Node.js 22 or later
- Pi Coding Agent
- Browser automation access with authorization for each target site

## Install

### Install in Pi

Install globally for current user:

```sh
pi install git:github.com/igun997/pi-snatch-skills@master
```

Install only for current project:

```sh
pi install -l git:github.com/igun997/pi-snatch-skills@master
```

Verify package is registered, then restart Pi if it is already open:

```sh
pi list
```

Pi loads extension from `extensions/` and skills from `skills/` automatically. Use `pi config` to enable or disable individual resources.

### Develop locally

Install dependencies, then verify package:

```sh
npm install
npm test
npm run typecheck
```

## Workflow

1. In Pi TUI, run `/snatch <public-url>`.
2. Choose permission mode, then choose action: `capture-design`, `create-reusable-components`, or, for `owned-or-authorized`, `full-clone`.
3. Confirm. Pi records a job under `.pi/snatch/<job-id>/job.json`, then runs the selected action immediately. `create-reusable-components` captures evidence, derives a brief, and queues a component-first rebuild. `full-clone` makes same-origin source material available for reuse when explicitly authorized.
4. Run `/snatch-status <job-id>` to inspect job state.
5. Capture writes desktop/mobile evidence, `.pi/snatch/<job-id>/output/brief.json`, and `output/motion-spec.json`. Full-page evidence is assembled from overlapping viewport tiles; captures taller than 30,000px are split as `full-page-1.png`, `full-page-2.png`, and so on. Each profile also records five passive scroll-state screenshots and safe motion facts under `<profile>/motion/`. Use screenshots, both briefs, and source material made available through an authorized full clone to build components.
6. Serve rebuilt capture output locally, then validate only a loopback URL:

```sh
node --import tsx scripts/e2e.mjs \
  --job <job-id> \
  --local-url http://127.0.0.1:4173
```

Validation captures desktop, mobile, and reduced-motion profiles, then replays captured desktop/mobile scroll states against local output. Reduced-motion validation rejects active video and infinite animation. Review visual evidence; repair at most three times.

7. Remove evidence when done:

```sh
rm -rf .pi/snatch/<job-id>
```

## Motion forensics

`motion-spec.json` contains two rebuild-safe evidence sets:

- `cssAnimations`: observed Web Animation timing metadata.
- `scrollEffects`: inferred `reveal`, `zoom`, `translate`, `sticky`, or `video-progress` effects, with profile, scroll range, target shape, confidence, and no page text, URLs, source code, cookies, or storage.

Capture is passive: it only samples five scroll positions after settling lazy content. Rebuild motion from observed behavior with transform and opacity, not copied target animation code. Local validation compares each sampled desktop/mobile state and checks reduced-motion behavior.

## Icon vendor detection

`brief.json` includes sorted, deduplicated `icons` records with `vendor`, `iconName`, and confidence. Supports Font Awesome, Material, Lucide, Heroicons, Bootstrap Icons, and Tabler. Generic SVGs remain `unknown` with low confidence.

See [agent-browser setup](docs/agent-browser.md) and [icon vendor detection](docs/icon-vendor-detection.md).

## Authorized full clone

For websites you own or are explicitly authorized to copy, choose `owned-or-authorized` during `/snatch`, then run:

```text
/snatch-full-clone <job-id>
```

Default mirror path: `.pi/snatch/<job-id>/mirror/`. Use an optional project-local output path when needed:

```text
/snatch-full-clone <job-id> ./mirror-output
```

Full clone copies same-origin HTML, CSS, JavaScript, fonts, images, JSON, and assets. It is unavailable for `private-learning` jobs. See [authorized full clone skill](skills/full-clone/SKILL.md).

## Optional design guidance

`vendor/faiz-skills` pins `julianromli/faiz-skills` as a Git submodule. Pi does not auto-load skills from `vendor/`; rebuild workflows reference selected upstream guidance explicitly when useful:

- `vendor/faiz-skills/design-system/SKILL.md`
- `vendor/faiz-skills/baseline-ui/SKILL.md`
- `vendor/faiz-skills/create-design-md/SKILL.md`
- `vendor/faiz-skills/make-interfaces-feel-better/SKILL.md`

Treat upstream files as guidance. When authorized source material is available through a full clone, it may be reused in rebuilds.

Initialize the pinned submodule after cloning:

```sh
git submodule update --init --recursive
```

## Acceptance evidence

Checked 2026-07-22 with Node `v22.20.0`, Pi `0.81.1`, and agent-browser `0.27.0`.

- `npm test`: 57 passing, 0 failing.
- `npm run typecheck`: passed.
- Authorized unauthenticated public capture: passed; persisted metadata checked for no query, fragment, credentials, page source, cookies, storage, or asset fields.
- Fixture integration: passed for desktop, mobile, reduced-motion, and forced visual-diff failure.
- Safety rejections: passed for `file:` targets, cross-origin capture, remote validation URL, fourth repair attempt, and submit-like scenario.
- Pi extension + skill smoke: passed.
