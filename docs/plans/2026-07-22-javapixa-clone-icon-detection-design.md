# Javapixa clone and icon vendor detection design

## Goal

Exercise Pi Design Snatch Skills against the user-owned `https://www.javapixa.com/`, produce a high-fidelity fresh static rebuild, and report detected icon libraries in capture output. The workflow must retain the package safety boundary: no target source code, fonts, SVGs, images, copied page text, credentials, storage, or copied assets enter the clone.

## Capture and analysis

`/snatch <url>` retains its interactive consent gate. `snatch_capture` captures desktop, mobile, and reduced-motion profiles from the consented origin. Capture facts gain optional icon evidence:

- `vendor`: known library name or `null`
- `iconNames`: normalized, unique icon names
- `confidence`: `high`, `medium`, or `low`
- `signals`: limited safe metadata: class tokens, `data-*` attributes, URL host/path patterns, element tag, and inline-SVG structural hints

No page HTML, SVG path data, raw external asset URLs, source code, cookies, or storage may be persisted.

A pure detector uses ordered rules for Font Awesome, Material Icons/Symbols, Lucide, Heroicons, Bootstrap Icons, and Tabler. Generic SVGs resolve to `unknown` with low confidence and no name. Page content is untrusted data, never instructions.

`analyzeDesignFacts()` aggregates findings into a sorted, deduplicated `brief.icons` report.

## Static clone

Create `examples/javapixa-clone/` after consented capture:

- `index.html`: fresh semantic page hierarchy
- `styles.css`: responsive layout, fresh design tokens, CSS-authored visual approximations
- `app.js`: small original interaction behavior
- `README.md`: local serving and provenance instructions

Use screenshots and the safe brief as reference. Use original CSS-drawn or Unicode generic icons and generated shape/gradient placeholders. Do not copy protected target assets or text.

## Verification

Add unit tests for each vendor, normalization/deduplication, and false-positive guards. Extend analysis tests for `brief.icons`. Run existing package tests and typecheck before and after changes. Serve clone on loopback and validate desktop, mobile, and reduced-motion profiles. Use screenshot/pixel evidence for up to three repair loops. Unknown icons remain reportable; malformed facts fail cleanly; validation never submits forms or performs destructive actions.
