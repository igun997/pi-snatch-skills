# Icon vendor detection

Capture briefs now expose `icons`: sorted, deduplicated vendor/name/confidence records.

Supported high-confidence rules:

- Font Awesome
- Material Icons and Material Symbols
- Lucide
- Heroicons
- Bootstrap Icons
- Tabler Icons

Generic SVGs return `vendor: "unknown"`, `iconName: null`, `confidence: "low"`.

Capture stores bounded tag, recognized class tokens, and allowlisted icon attributes only. It never stores SVG markup/path data, source HTML, cookies, storage, or remote asset URLs.
