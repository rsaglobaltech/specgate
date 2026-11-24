# Delta — harness

## ADDED Requirements

### Requirement: REQ-698 — The agent in its module's sandbox

<!-- specgate:trace status=Implemented feature=features/harness/REQ-698.feature actor=Developer kind=functional -->

The system SHALL, when harness.config.yaml sets `sandbox:` with `engine: sbx`, run each agent session of a requirement inside the Docker sandbox of its change and module, `sg-<change>-<module>`: made by the first requirement of that module with the sandbox's `kit` and the harness's worktrees as its workspace, its `setup` command run once, and recorded in `.harness/sandboxes.json`; later requirements of the module reuse it; the gate runs on the host.

> Found on 2026-11-23: three sandboxes, clones and installs done by hand for one run.

#### Scenario: SCN-698a — Two requirements of ausleihe, one sandbox

- GIVEN `sandbox: { engine: sbx, kit: opencode, setup: "install-node" }`, and REQ-006 and REQ-007 of ausleihe in change draft-ausleihe pending
- WHEN the Developer runs `specgate harness run --req REQ-006 --req REQ-007`
- THEN one sandbox `sg-draft-ausleihe-ausleihe` was created, `install-node` ran in it once, both agents ran in it in their worktrees, and `.harness/sandboxes.json` records it

### Requirement: REQ-699 — The hosts each sandbox may reach

<!-- specgate:trace status=Implemented feature=features/harness/REQ-699.feature actor=Developer kind=functional -->

The system SHALL open each host of `sandbox.allow` for that sandbox alone, record the rules it added, read the sandbox's whole network policy after creating it and record the hosts its kit added apart; and SHALL say, when the run starts a sandbox, how many hosts it may reach — the Developer's and the kit's.

#### Scenario: SCN-699a — Two hosts opened, twenty-nine from the kit

- GIVEN `allow: [registry.npmjs.org, opencode.ai]`, and a kit whose policy allows 29 hosts
- WHEN the harness creates the sandbox for ausleihe
- THEN registry.npmjs.org and opencode.ai are allowed for that sandbox alone, the record names those 2 and the kit's 29, and the run says "sg-draft-ausleihe-ausleihe may reach 31 hosts: 2 yours, 29 from the kit opencode"

### Requirement: REQ-700 — Archive removes the change's sandboxes

<!-- specgate:trace status=Implemented feature=features/harness/REQ-700.feature actor=Developer kind=functional -->

The system SHALL, on `specgate archive <change>`, remove each sandbox recorded for that change together with the network rules the harness added for it, and drop its record.

#### Scenario: SCN-700a — draft-ausleihe archived

- GIVEN `sg-draft-ausleihe-ausleihe` recorded for draft-ausleihe with 2 rules, and `sg-draft-katalog-katalog` for draft-katalog
- WHEN the Developer runs `specgate archive draft-ausleihe`
- THEN `sg-draft-ausleihe-ausleihe` and its 2 rules are removed, and `sg-draft-katalog-katalog` stays recorded

### Requirement: REQ-701 — No sandbox left behind unseen

<!-- specgate:trace status=Implemented feature=features/harness/REQ-701.feature actor=Developer kind=functional -->

The system SHALL, on `specgate harness sandboxes [--json]`, list each recorded sandbox — its change, module, creation date, the hosts allowed and the kit's, and whether it still exists — and each sbx sandbox named `sg-…` that nobody recorded; and SHALL, with `--prune`, remove those whose change is archived or gone and the unrecorded `sg-…` ones, with their rules.

#### Scenario: SCN-701a — One left behind, one stray

- GIVEN `sg-old-pagos` recorded for a change already archived, `sg-stray` existing and unrecorded, and `sg-draft-katalog-katalog` of an open change
- WHEN the Developer runs `specgate harness sandboxes --prune`
- THEN `sg-old-pagos` and `sg-stray` are removed, and `sg-draft-katalog-katalog` stays
