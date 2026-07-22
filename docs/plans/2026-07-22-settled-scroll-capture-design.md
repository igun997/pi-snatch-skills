# Settled Scroll Capture Design

Each desktop/mobile capture waits for network idle, waits eight seconds for hydration and intro motion, then scrolls in 700px steps with 500ms pauses to trigger lazy content and intersection observers. It returns to top, waits one second, then captures screenshots and facts.

Capture is bounded to 60 steps and 45 seconds per profile. It records height before/after, step count, stabilization state, and an `infinite-scroll-suspected` finding when document height continues growing across three bottom checks.

Reduced-motion is captured separately. It repeats settling and scroll loading with `prefers-reduced-motion`, freezes screenshot animation state, and preserves normal-profile motion facts for design analysis.
