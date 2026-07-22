# Authorized Full-Clone Extension Design

## Goal

Add reusable full-clone mode for user-owned or explicitly authorized public websites. Existing `/snatch` consent remains mandatory. Full-clone mode may copy source HTML, CSS, JavaScript, fonts, images, JSON, and same-origin runtime assets after recorded `owned-or-authorized` consent. It must not run for `private-learning` jobs.

## Extension and output

Add `/snatch-full-clone <job-id> [output-directory]` and `snatch_full_clone`. The default output is `.pi/snatch/<job-id>/mirror/`; callers may set an explicit output directory only below project root. Persist `mirror-manifest.json` with origin, local output path, MIME type, byte count, digest, status, and sanitized failure metadata.

The clone pipeline fetches the target with browser-like headers, stores the document, then recursively extracts same-origin URLs from HTML attributes, `srcset`, CSS `url()`, module imports, and downloaded CSS/JS. It downloads bounded assets, maps source paths to deterministic collision-proof local paths, and rewrites HTML/CSS/JS to relative local references. Rewritten resources lose integrity metadata only when required. External links remain remote; trackers may be stripped.

## Operational limits and safety

Origin lock, project-root output lock, no credentials/cookies/storage, no form submission, and no destructive browser actions remain. Operational limits: 500 assets, 250 MB, 20 concurrent downloads, recursion depth 4, 30-second request timeout. Individual failures are recorded and do not discard successful downloads.

## Verification

Serve clone over loopback. Run browser diagnostics for desktop and mobile, collecting screenshots, console errors, and failed local requests. Status is `mirrored` only when clone completes; validation findings remain reportable. Unit tests cover discovery, rewrite, asset collisions, recursion, same-origin enforcement, output escape rejection, private-learning rejection, secret/query redaction, and manifest persistence. Fixture integration verifies a copied page works locally across profiles.
