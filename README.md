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
2. Choose permission mode, then choose action: `capture-design` or, for `owned-or-authorized`, `full-clone`.
3. Confirm. Pi records a job under `.pi/snatch/<job-id>/job.json`, then runs selected action immediately.
4. Run `/snatch-status <job-id>` to inspect job state.
5. Capture writes desktop/mobile evidence and `.pi/snatch/<job-id>/output/brief.json`. Use screenshots and brief to create new components. Never copy target source code, assets, fonts, SVG markup, or page copy.
6. Serve rebuilt capture output locally, then validate only a loopback URL:

```sh
node --import tsx scripts/e2e.mjs \
  --job <job-id> \
  --local-url http://127.0.0.1:4173
```

Validation captures desktop, mobile, and reduced-motion profiles. Review visual evidence; repair at most three times.

7. Remove evidence when done:

```sh
rm -rf .pi/snatch/<job-id>
```

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

## Acceptance evidence

Checked 2026-07-22 with Node `v22.20.0`, Pi `0.81.1`, and agent-browser `0.27.0`.

- `npm test`: 57 passing, 0 failing.
- `npm run typecheck`: passed.
- Authorized unauthenticated public capture: passed; persisted metadata checked for no query, fragment, credentials, page source, cookies, storage, or asset fields.
- Fixture integration: passed for desktop, mobile, reduced-motion, and forced visual-diff failure.
- Safety rejections: passed for `file:` targets, cross-origin capture, remote validation URL, fourth repair attempt, and submit-like scenario.
- Pi extension + skill smoke: passed.
