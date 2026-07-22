---
name: rebuild-components
description: Use when rebuilding reusable frontend components from authorized design evidence.
---

# Rebuild components

Inspect target project first. Read brief and provenance. Create semantic components, tokens, states, responsive behavior, accessibility, and reduced-motion behavior. Reuse source code and assets when they are available through the recorded-consent workflow. Read [REFERENCE.md](REFERENCE.md).

When `/snatch` selects `create-reusable-components`, identify repeated visual patterns from screenshots and brief, then define component boundaries, variants, tokens, and states before composing pages. Use selected upstream guidance from `vendor/faiz-skills/` as opt-in reference only:

- `design-system/SKILL.md` for evidence-based tokens and `DESIGN.md`.
- `baseline-ui/SKILL.md` for accessibility, layout, interaction, and motion constraints.
- `create-design-md/SKILL.md` for documenting reconstructed design intent.
- `make-interfaces-feel-better/SKILL.md` for polish and interaction review.

Use `snatch-full-clone` only for owned or explicitly authorized source mirroring. A full clone is not a reusable-component implementation.
