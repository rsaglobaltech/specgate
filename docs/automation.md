# Automation

Wiring the loop into the tools a team already runs: editors, agents,
hooks and CI.

---

## Wire the MCP server into Claude / Cursor / Aider

**Goal:** let an MCP-aware AI agent work the daily loop — status, new, check, done — without a terminal.

The server ships inside the CLI: `specgate mcp serve` runs it over stdio.
`specgate mcp install --client claude` (or `cursor`) writes the
config for you; by hand it is:

Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "spec-driven": {
      "command": "npx",
      "args": ["-y", "@rsaglobaltech/specgate", "mcp", "serve"]
    }
  }
}
```

Every command is a tool, named `specgate_<command>` (`specgate_status`,
`specgate_ci_init`, …), and each declares the argument it needs. The daily
loop, and the seven names published before the rest were generated:

| Tool | Purpose |
| --- | --- |
| `specgate_status` | What is open, and the next command. |
| `specgate_new` | `specgate new <title>`: a requirement with its scenario. Takes `title`. |
| `specgate_check` | The gate, then the tests when a test command is configured. |
| `mark_requirement_done` | `specgate done <REQ>`: runs the gate, then marks it Implemented. Takes `requirement`. |
| `validate_project` | `validate --strict`, parsed. |
| `plan` | The pending queue, with what each requirement still needs. |
| `read_spec` | Returns `spec.md` and lists every `docs/specs/*.md`. |
| `list_requirements` | Returns every `REQ-NNN` with title, file, and line. |
| `update_traceability` | Appends a row to a hand-kept matrix; refuses on a generated one. |
| `lint_pack` | Runs `pack lint` and returns structured errors. |

**Tools that write the specification are guarded.** An agent may not rewrite
the spec it is measured against, so `specgate_new`, `mark_requirement_done`
and the other writers refuse unless a change is open (`specgate change new
<id>`) or the team allows it in `.csda/config.json`:

```json
{ "mcpAllowContractEdits": true }
```

Restart the client; the tools appear in the model's tool list as `spec-driven.*`.

---

---

## Install the Claude Code plugin

**Goal:** the loop as slash commands, the spec tree over MCP, and the gate
running *before* the session can end rather than after it in CI.

```bash
specgate agents init --tool claude-plugin --project-dir ./csda-plugin
```

That writes a complete plugin: `.claude-plugin/plugin.json`, the six commands
of the loop under `commands/specgate/`, an `.mcp.json` pointing at the spec-driven
MCP server, and `hooks/hooks.json` with the gate.

**The hook is the part no other target can offer.** Every other tool here gets
*instructions* — text an agent may or may not follow. A plugin gets a `Stop`
hook, which runs whether the agent likes it or not:

```
The spec gate is failing, so this work is not finished:

  • [strict_tdd_1] Test artifact is TBD but status is 'In Dev'
    fix: Write the test first, then set its path in the row's
         'Test artifact' column.

Run `specgate validate . --strict` to see all of it.
```

The session does not end while that is true. `validate --strict` stops
being something that reviews an agent's work after it has gone and becomes
something it cannot walk past.

**It will not trap you.** The hook blocks **once per prompt**. The second time
the same prompt reaches it, the findings are reported and the session ends: by
then the agent has been told, and a human needs to see the answer more than the
loop needs another turn. A project without `spec.md`, or a machine without
`specgate` on `PATH`, is left alone entirely.

`claude-plugin` is the one target `specgate agents init` does *not* write by
default — a plugin is an installable artefact, not something to scatter into
every project.

---

---

## Use the VS Code extension

**Goal:** get inline diagnostics for `pack.yaml`, code-lens to jump to the traceability row, and validate-on-save.

1. Install [`vscode-spec-driven`](../packages/vscode-spec-driven) from the Marketplace (`ext install rsaglobaltech.vscode-spec-driven`).
2. Open a project root. The extension auto-detects `spec.md` / `docs/specs/traceability.md`.
3. Open any `pack.yaml` — diagnostics from the JSON Schema appear in the Problems panel.
4. Hover any `REQ-NNN` (or `UC-`, `SCN-`, `AGG-`, `EVT-`, `RUL-`, `CMD-`) → CodeLens shows "Reveal in traceability".
5. Enable validate-on-save: open settings, search **Spec-Driven**, tick `validateOnSave`. The CLI runs after every save and posts results to the Problems panel.

Settings:

| Setting | Default | Purpose |
| --- | --- | --- |
| `spec-driven.validateOnSave` | `false` | Run `validate` on every file save. |
| `spec-driven.codeLens` | `true` | Show "Reveal in traceability" code lenses. |
| `spec-driven.cliPath` | `npx @rsaglobaltech/specgate` | Override if you ship the CLI vendored. |
| `spec-driven.schemaPath` | bundled | Point at a custom `pack.schema.json`. |

---

---
## Drive delivery with the harness

`specgate harness run` drives plan → agent → verify → done for every pending
requirement, each in its own git worktree, in dependency order, and it never
merges.

→ [The harness](harness.md)

---

---

## Run the gate without Node on the build agent

The generated CI configs call `npx`, which needs Node. Plenty of build agents
do not have it — a Java shop's Jenkins agent, a locked-down runner — and that
is the whole reason the Docker image and the Maven and Gradle plugins exist.

> **Image name across the rename.** The examples below name
> `ghcr.io/rsaglobaltech/specgate:<version>`, which is where every tag cut from
> 0.8.0 on lands. Tags published before the rename live at
> `ghcr.io/rsaglobaltech/csda:<version>` and keep working — a published tag is
> never rebuilt in place, so nothing was republished under the new name
> retroactively. They are the same tool, but only the `specgate` images carry a
> `specgate` binary: an image tagged `csda:0.2.1` answers to `csda` and
> `create-spec-driven-app`, so pin the image and the command name together.

**Docker.** Mount the workspace and run the gate:

```bash
docker run --rm -v "$PWD:/workspace" \
  ghcr.io/rsaglobaltech/specgate:0.17.8 validate . --strict
```

Pin the version. `latest` is a convenience for a laptop, not for a pipeline —
a gate that changes under you is not a gate. The image is published for
`linux/amd64` and `linux/arm64`, so ARM runners work unchanged.

In GitLab CI, that is the whole job:

```yaml
spec-gate:
  image: ghcr.io/rsaglobaltech/specgate:0.17.8
  stage: test
  script:
    - specgate validate . --strict
```

In Jenkins:

```groovy
stage('Spec gate') {
    agent { docker { image 'ghcr.io/rsaglobaltech/specgate:0.17.8' } }
    steps { sh 'specgate validate . --strict' }
}
```

**Maven or Gradle.** If the build already runs one of those, bind the gate to a
phase instead of adding a container:

```xml
<plugin>
  <groupId>com.rsaglobaltech</groupId>
  <artifactId>csda-maven-plugin</artifactId>
  <executions>
    <execution>
      <goals><goal>validate</goal></goals>
    </execution>
  </executions>
</plugin>
```

`validate` binds to the `verify` phase by default, so `mvn verify` runs the
gate without further wiring. `plan` and `doctor` are goals too.

**Not published yet.** The plugin builds and its tests run in CI, but it is not
on Maven Central — that needs an OSSRH account and a signing key. Until then,
`mvn -f packages/maven-plugin install` from a clone puts it in your local
repository. The Docker path above needs nothing.

The plugins target **Java 11** deliberately: a corporate build agent is exactly
where you cannot choose the JDK.

## Wire `validate` into a pre-commit hook

**Goal:** block commits that drop a `REQ` without a `.feature` or a `traceability.md` row before they ever leave the developer's machine.

Plain shell (works without husky/lefthook):

```bash
# .git/hooks/pre-commit  (chmod +x)
#!/usr/bin/env bash
set -e
echo "→ specgate validate --strict"
npx --yes @rsaglobaltech/specgate@0.17.8 validate . --strict
echo "→ specgate specops diff (must be clean)"
DIFF=$(npx --yes @rsaglobaltech/specgate@0.17.8 specops diff --format json 2>/dev/null || true)
if echo "$DIFF" | grep -q '"added":\[\([^]].\)\]\|"modified":\[\([^]].\)\]'; then
  echo "✖ Pack content drifted. Run \`specgate specops sync\` and commit again."
  exit 1
fi
```

Or with **husky** (`package.json`):

```bash
npm install --save-dev husky
npx husky init
echo 'npx --yes @rsaglobaltech/specgate@0.17.8 validate . --strict' > .husky/pre-commit
```

Mirror the same call in CI (see §4) so the gate survives `--no-verify`.

---

---

## Sync requirements with Jira or Azure Boards

`specgate alm sync` keeps the traceability matrix and the board in step — creating
an issue for each unlinked requirement, closing it when the requirement is
done, and reporting drift rather than resolving it.

→ [Jira and Azure Boards](alm.md)

---

---

## Next

- [The harness](harness.md)
- [Jira and Azure Boards](alm.md)
- [The agent contract](specs/agent-contract.md)
- [The harness spec](specs/harness.md)
