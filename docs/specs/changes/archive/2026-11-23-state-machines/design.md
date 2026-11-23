# Design: state-machines

`StateMachine.ts` (core, pure) parses, checks, applies deltas and renders Markdown and PlantUML. `validate` runs it under the new gate rule `state_machines`; archive applies `<change>/state-machines/*.md` (repository gains `listFiles`); `domain-docs` generates `.puml` and `status --json` `stateMachines`; DraftChecklist D16 and guide section 1d. AC-1 → SCN-637a–e; AC-2 → SCN-638a–e; AC-3 → SCN-639a–d.
