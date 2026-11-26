# Design: use-cases-lifecycle

- `packages/core/src/domain/UseCaseDelta.ts`: parse, check and apply a
  change's use cases; `useCaseCoverage` for the gate. Pure.
- Archive (`ArchiveChangeUseCase`): reads `<change>/use-cases.md`, checks it
  against the catalog and the matrix as the change leaves it, writes the
  catalog (`kind: "use-cases"`).
- Drafts (`DraftCommand.openDraft`): `uc_range`, `use-cases.md`; the guide's
  section 1b; `DraftChecklist` D14 when the draft has use-cases.md.
- Gate (`gate-policy.ts`, `ValidateSpecsCommand.checkUseCases`): rule
  `use_cases`, warning by default.
- AC-1 → SCN-625a–c; AC-2 → SCN-626a–b; AC-3 → SCN-627a–c.
