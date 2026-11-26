# Design: quoted-actor-names

`DraftChecklist.ts` exports `ACTOR_NAME` (quoted or bare), `actorName` (drops
the quotes) and `yamlName` (quotes a name YAML would split). The five actor
readers use them: `brief-setup.ts`, `DraftChecklist.actorSurfaces`,
`BriefForm.readBriefForm`, `BriefCards` (B13), `domain-docs.ts`; the form
writer uses `yamlName`. AC-1 → SCN-622a; AC-2 → SCN-622b.
