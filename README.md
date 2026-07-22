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
