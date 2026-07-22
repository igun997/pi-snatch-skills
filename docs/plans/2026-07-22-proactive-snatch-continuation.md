# Proactive Snatch Continuation Plan

**Goal:** Make `/snatch` visibly progress through capture and trigger a follow-up LLM turn that reads the generated brief and begins a fresh rebuild.

1. Add a `snatch-progress` custom entry renderer using Pi TUI, then append durable progress entries during consent, capture, brief generation, and continuation queueing.
2. Add a regression test proving renderer registration and action prompt behavior.
3. After successful capture and analysis, use `pi.sendUserMessage()` with a brief path, explicit fresh-rebuild constraints, and requested validation output.
4. Add Pi TUI peer dependency, document automatic continuation, run tests/typecheck, commit and push.
