# Design: brief-surfaces

`briefSetupGuide` says a system uses `api` and surfaces are never empty. `frontMatterWithAgent` checks what the agent wrote and, with problems and the body unchanged, runs it once more on `briefFixPrompt` — the problems with their fixes before the guide. AC-1 → SCN-653a, SCN-653b.
