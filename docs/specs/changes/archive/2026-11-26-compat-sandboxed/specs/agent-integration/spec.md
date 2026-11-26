# Delta — agent-integration

## ADDED Requirements

### Requirement: REQ-736 — The agent runs inside a sandbox that holds its run and nothing else

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-736.feature actor=Developer kind=functional -->

The system SHALL, on `specgate compat run --sandbox sbx`, run each tool's agent inside a Docker sandbox whose only host folder is the batch's own, each run in a folder of it removed when the run ends; install inside it this checkout's Specgate at the levels that have Specgate and none at B; give the agent an environment of named variables and none of the host's — no provider key among them; with `--auth-<tool>`, put the Developer's own stored session of that tool in the sandbox's home, for a model that needs an account, removed with the sandbox; judge the run on the host after the agent has ended; and remove the batch's sandboxes when it ends or is interrupted; with `--use-sandbox <kind>=<name>`, use instead a sandbox the Developer made — logged in to their own account inside —, refusing one whose kind does not match what it has inside, and leave it as it was but for the run's folder.

> Found on 2026-11-24: an agent in no sandbox read the exam's earlier results and searched the Developer's home for the hidden test.

#### Scenario: SCN-736a — Only its own folder

- GIVEN `specgate compat run --tool opencode --level L0 --runs 1 --sandbox sbx` with a fake sbx
- WHEN the run starts
- THEN one sandbox was created whose workspace is the batch's folder, the agent's command was run through `sbx exec` in the run's folder, and its environment names PATH and HOME and none of the host's variables

#### Scenario: SCN-736b — No Specgate at B

- GIVEN a batch at levels B and L0 with a fake sbx
- WHEN the sandboxes are set up
- THEN Specgate's tarball is installed in the sandbox of L0 and not in the sandbox of B

#### Scenario: SCN-736d — The Developer's own session, never another key

- GIVEN `specgate compat run --tool opencode --sandbox sbx --auth-opencode` and a host with OPENCODE_API_KEY set
- WHEN the agent is started in the sandbox
- THEN the Developer's own OpenCode session file is in the sandbox's home, the agent's environment has no OPENCODE_API_KEY, and the session file is gone with the sandbox

#### Scenario: SCN-736e — The Developer's own sandbox

- GIVEN a sandbox my-box the Developer made, with Specgate inside
- WHEN the Developer runs `specgate compat run --tool opencode --level L0 --runs 1 --sandbox sbx --use-sandbox specgate=my-box`
- THEN the agent runs in my-box, no sandbox is made or removed, and my-box's workspace is empty again

#### Scenario: SCN-736c — Nothing left

- GIVEN a batch that created two sandboxes
- WHEN the batch ends
- THEN both were removed, and the batch's folder is gone

### Requirement: REQ-737 — The sandbox's network is its provider and the registry

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-737.feature actor=Developer kind=functional -->

The system SHALL, for each exam sandbox, deny every host its kit allows other than the tool's provider and the package registry, so that a secret the sandbox could use for another provider reaches none, and record in the run the hosts left open.

> Measured on 2026-11-24: the `opencode` kit allows 29 hosts, other providers' among them, and the sandbox's proxy fills in the Developer's keys for them.

#### Scenario: SCN-737a — Other providers closed

- GIVEN a fake sbx whose kit allows api.anthropic.com, api.openai.com, opencode.ai and registry.npmjs.org
- WHEN a sandbox for opencode is made
- THEN deny rules were added for api.anthropic.com and api.openai.com, none for opencode.ai or registry.npmjs.org, and the run records opencode.ai and registry.npmjs.org as open

### Requirement: REQ-738 — A self-approving tool is not run outside a sandbox

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-738.feature actor=Developer kind=functional -->

The system SHALL refuse, on `specgate compat run`, to start a tool whose default command approves its own actions — OpenCode — without `--sandbox`, naming `--sandbox sbx`; and start it on the machine only with `--no-sandbox`, saying that the agent can read what the Developer can.

> The exam dropped the sandbox to spare a login, and a self-approving agent read the disk.

#### Scenario: SCN-738a — Refused without a sandbox

- GIVEN `specgate compat run --tool opencode --level L0`
- WHEN the Developer runs it
- THEN it is refused with `compat_needs_sandbox` naming `--sandbox sbx`, and no agent starts

#### Scenario: SCN-738b — At the Developer's word

- GIVEN `specgate compat run --tool opencode --level L0 --no-sandbox`
- WHEN the Developer runs it
- THEN the run starts, and the output says the agent can read what the Developer can
