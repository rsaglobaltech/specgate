# Proposal: studio-cli-parity

## Intent

The studio covers the route from a brief to a report, but a person who uses it
still has to open a terminal for much of Specgate: to see every change and not
only the brief's drafts, to archive one, to propose one from an idea or a
ticket, to run the gate, to deliver a requirement coded by hand, to set the
project's preferences, to install the agent guards, to adopt a repository that
already has code, and to sync with Jira or Azure Boards. The user asked on
2026-11-08 for a studio that does everything Specgate offers; this is phase 2
of the plan agreed then, on the design of phase 3.

## Scope

In scope:

- One way for the studio to run a CLI command: from a fixed list of commands,
  each with the arguments it may take, checked; one at a time beside a build;
  its output shown as it runs and its result said. Nothing outside the list
  runs, even with the page's token.
- Changes: every open change with its progress, opened into its proposal,
  deltas and tasks; validated; archived once every requirement in it is
  delivered, after a preview of what the archive writes; a new change from an
  idea, or from a ticket when an ALM is configured.
- The gate (`check`) and the doctor (`doctor`) run from the studio, each
  finding with its fix.
- A requirement coded by hand delivered with `apply`: its test first, the
  gate, Implemented — or the reason it was refused.
- Settings: the project's preferences (`config`), the agent guards for this
  project (`agents init --tool claude-plugin` / `opencode-plugin`) and the
  agent integrations (`agents init`). `agents install`, which installs the
  guards for every project of the user, stays in the terminal.
- A repository that has code and no Specgate: adopted from the studio after a
  preview of every file it would write, touching nothing else.
- ALM, last: the requirement ↔ issue mapping, a sync previewed then run; the
  token stays in the environment, never asked in the browser.

Out of scope:

- Packs, SpecOps, MCP and shell completion: they are set up once, from a
  terminal, by whoever maintains the project.
- A terminal in the browser, or any command the list does not name.
- Running the studio anywhere but on 127.0.0.1 (the cloud runner is a later,
  separate proposal).

## Approach

A small allowlist on the server maps an action (`archive`, `check`, `apply`,
`config-set`…) to the CLI command it runs and a schema for its arguments
(a change id, a requirement id, a known preference key); the page posts the
action with the token, the server checks it, spawns `specgate` itself in the
project folder as a job — like the brief and draft jobs — and keeps its
output in the ignored events folder, which the page reads as it grows. Where
a command already answers with `--json` (`check`, `apply`, `archive`,
`doctor`, `propose`), the studio reads that; the rest is shown as the
command's own text. Each section offers its actions where the work is: Changes
for changes, Home and Report for the gate, the requirement's view for apply,
Settings for preferences, agents, adoption and ALM. Spanish and English,
keyboard, the notices and states of REQ-434, and the browser journey of
REQ-436 extended to the new actions.
