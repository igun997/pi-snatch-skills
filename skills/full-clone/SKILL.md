---
name: authorized-full-clone
description: Use when user wants a full local mirror of website they own or are explicitly authorized to copy. Copies same-origin source HTML, CSS, JavaScript, fonts, images, JSON, and assets into a local mirror.
---

# Authorized full clone

Use only after `/snatch <public-url>` records `owned-or-authorized` consent. Do not use `private-learning` jobs.

## Pi workflow

1. Create consented job:

```text
/snatch https://owned-site.example
```

Choose `owned-or-authorized`.

2. Run clone command:

```text
/snatch-full-clone <job-id>
```

Optional project-local output:

```text
/snatch-full-clone <job-id> ./mirror-output
```

Or call `snatch_full_clone` with `jobId`, optional same-origin `targetUrl`, and optional project-local `outputDirectory`.

## Output

Default:

```text
.pi/snatch/<job-id>/mirror/
├── index.html
├── assets/
└── mirror-manifest.json
```

Mirror copies same-origin page code and assets, discovers nested CSS/JS references, rewrites local paths, and records copied files plus fetch failures in manifest. External links remain external.

## Limits

- Exact consent origin only
- 500 assets
- 250 MB total
- CSS/JS discovery depth 4
- No cookies, credentials, form submission, or browser clicks

Serve mirror over HTTP, never `file://`. Remove mirror artifacts when no longer needed.
