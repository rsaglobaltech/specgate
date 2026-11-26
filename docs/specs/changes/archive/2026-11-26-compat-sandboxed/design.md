# Design: compat-sandboxed

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `scripts/lib/compat-sandbox.ts` — one sandbox per tool and kind (with Specgate, bare) for a batch: create, network, what is installed inside, the line that runs a command in it, removal (AC-1, AC-2, AC-3, AC-6). Built on `scripts/lib/sbx.ts`.
- `scripts/cli/commands/harness/CompatCommand.ts` — `--sandbox sbx`, the refusal of an unsandboxed self-approving tool (AC-4), what goes into the run's folder and environment (AC-5).

## Mechanisms

Measured with sbx on 2026-11-24, kit `opencode`: a sandbox takes 27 s to create, sees its workspace and no other host folder, has opencode 2.3.2 and no node, npm or git; its kit allows 29 hosts, among them other providers'; the secrets in its environment are placeholders the proxy fills in for an allowed host — the agent cannot read a key and could spend one.

- A batch's sandbox has one workspace; each run is a folder in it, removed after the run, so a run does not read another's work (AC-1, AC-5).
- Network (AC-2): after creating, every host of the kit that is not the tool's provider or the registry gets a deny rule of that sandbox — a deny wins over the kit's allow. OpenCode: `opencode.ai`, `*.opencode.ai`, `registry.npmjs.org`.
- Inside (AC-3): node from the registry's own tarball, as the harness's sandboxes do; Specgate from a tarball of this checkout made once per batch (`npm pack`), installed in the sandbox with Specgate and not in the bare one. No decoy is needed at B: the command is not there.
- The agent's environment (AC-5) is named variable by variable: PATH, HOME and the run's own; none of the host's. Its session is the sandbox command's own output, written on the host as it happens; what Specgate's server and plugin record is written inside the run's folder and copied out when the run ends.
- The gate and the hidden check judge on the host, after the agent has ended, on the run's folder (AC-5).
- A model that needs an account (decided 2026-11-24: the Developer's own OpenCode Go, never the company's key): `--auth-opencode` copies the Developer's stored OpenCode session into the sandbox's home, where it is removed with the sandbox; OPENCODE_API_KEY — the variable through which sbx's proxy would fill in the global secret — is never among the agent's variables. The sandbox's network leaves the session nowhere to go but its own provider.
- Self-approving (AC-4): OpenCode with `--auto`. Without `--sandbox`, its runs are refused naming `--sandbox sbx`; `--no-sandbox` is the Developer's word to run it on the machine.
- Removal (AC-6): at the batch's end, and on interruption; `specgate harness sandboxes` already lists what a crash leaves.

Claude Code and Codex are not moved into a sandbox here: Claude Code's commands are limited to a list, Codex has its own sandbox for writes, and both would need a login inside. They can be asked for with `--sandbox sbx` once that is solved.
- A sandbox of the Developer's own (2026-11-24): the stored OpenCode Go key had expired, and a session is better put in by its owner than carried in. `--use-sandbox specgate=<name>,bare=<name>` takes sandboxes the Developer made and logged in to; the exam checks each has, or has not, Specgate inside as its kind says, runs in it, and never removes it.
