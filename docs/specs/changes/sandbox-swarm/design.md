# Design: sandbox-swarm

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `packages/core/src/domain/Sandbox.ts` — `engine: sbx`, `kit`, `allow`, `setup`; the sandbox name.
- `scripts/lib/sbx.ts` (new) — the sbx adapter: create, exec, policy, rm, ls; `SPECGATE_SBX` names the binary (tests use a fake).
- `scripts/lib/sandbox-registry.ts` (new) — `.harness/sandboxes.json`.
- `scripts/harness/run/gate.ts` `agentLine` — exec in the module's sandbox.
- `scripts/harness/sandboxes.ts` (new) — `specgate harness sandboxes [--prune] [--json]`.
- `ChangeCommand.ts` archive — removes the change's sandboxes.

## Mechanisms

- AC-1 — `sandbox: { engine: sbx, kit: opencode, allow: [hosts], setup: "<cmd>" }`
  in harness.config.yaml. The requirement's sandbox is `sg-<change>-<module>`
  (lowercase, at most 63 characters); the first requirement of that module
  creates it with `sbx create --name <n> <kit> <worktrees root>`, opens its
  hosts, runs `setup` once and records it; each agent session runs with
  `sbx exec -w <worktree> <n> sh -lc '<agent line>'`. The gate stays on the
  host. A requirement outside any change gets `sg-<project>-<module>`.
- AC-2 — each host of `allow` is opened for that sandbox alone
  (`sbx policy allow network --sandbox <n>`); the rule ids are recorded. The
  sandbox's whole policy (`sbx policy ls`) is read after creation: the
  kit's hosts are recorded apart and shown by `harness sandboxes`, and the
  run's first line says how many hosts each sandbox may reach.
- AC-3 — `specgate archive <change>` removes each recorded sandbox of the
  change (`sbx rm --force`) and its rules, then its entries.
- AC-4 — `specgate harness sandboxes [--json]` lists each recorded sandbox
  (change, module, created, hosts allowed, kit hosts, alive) and each sbx
  sandbox named `sg-…` nobody recorded; `--prune` removes those whose change
  is archived or gone, and the unrecorded `sg-…` ones.

## Channels

None: the CLI and files. The studio's swarm view reads `harness sandboxes
--json` (a studio change).

## Decisions

- One sandbox per module of a change, not per requirement: setup (Node, its
  packages) is paid once per module, as in the lab.
- The gate runs on the host: it is the judge, and the agent's sandbox is not
  trusted to report its own result.
- The kit's own network rules are shown, not removed: they belong to the kit
  and the agent may need them.
