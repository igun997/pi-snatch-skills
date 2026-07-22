# Pi Design Snatch Skills

A Pi package for authorized website-design analysis only. Use it only on websites and accounts you own or are explicitly authorized to assess.

## Prerequisites

- Node.js 22 or later
- Pi Coding Agent
- Browser automation access with authorization for each target site

## Install

Install dependencies with `npm install`, then verify the package with:

```sh
npm test
npm run typecheck
```

## Workflow

1. Run `/snatch <public-url>` and provide required interactive consent.
2. Use capture evidence to create new components with `rebuild-components`; never copy source code or assets.
3. Validate only explicit loopback URLs. Review pixel/vision evidence; repair generated files at most three times.
4. Remove `.pi/snatch/<job-id>/` when evidence is no longer needed.

See [agent-browser setup](docs/agent-browser.md).

## Acceptance evidence

Checked 2026-07-22 with Node `v22.20.0`, Pi `0.81.1`, and agent-browser `0.27.0`.

- `npm test`: 51 passing, 0 failing.
- `npm run typecheck`: passed.
- Authorized unauthenticated public capture: passed; persisted metadata checked for no query, fragment, credentials, page source, cookies, storage, or asset fields.
- Fixture integration: passed for desktop, mobile, reduced-motion, and forced visual-diff failure.
- Safety rejections: passed for `file:` targets, cross-origin capture, remote validation URL, fourth repair attempt, and submit-like scenario.
- Pi extension + skill smoke: passed.
