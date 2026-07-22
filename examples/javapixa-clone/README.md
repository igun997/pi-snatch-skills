# Javapixa static reconstruction

A standalone HTML, CSS, and JavaScript reconstruction of the Javapixa home page for local visual validation. It has no build step and no remote runtime dependencies.

## Reconstruction flow

1. Capture the live authorized reference at desktop and mobile sizes.
2. Map the visible composition: black/charcoal canvas, red conversion accent, large hero typography, client strip, intentionally spacious service and product bands, portfolio grid, journal cards, and four-column footer.
3. Rebuild those relationships with semantic local HTML and CSS. Visual media panels are local neutral placeholders so the page stays deterministic offline.
4. Implement only observed interactions: mobile navigation drawer, language-state toggle, portfolio category filters, anchor navigation, and reduced-motion support.
5. Serve and compare the page at desktop, mobile, and reduced-motion profiles.

## Run locally

```sh
npx serve examples/javapixa-clone -l 4173
```

Then inspect `http://127.0.0.1:4173` with agent-browser. The page does not submit forms, make network requests, or require JavaScript frameworks.
