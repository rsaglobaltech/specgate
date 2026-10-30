# Automation

This page wires the Specgate loop into the tools your team already runs:
agents, editors, git hooks, CI without Node, and Jira. Pick the sections you
need; each one stands alone.

**You need:** a project where `specgate init` has run, and Specgate installed as
a dev dependency (`npm install --save-dev @rsaglobaltech/specgate`). The CI job
itself is covered in [Validating](validating.md#run-it-in-ci).

## Give an agent the loop over MCP

An MCP client (Claude Desktop, Cursor, Claude Code, Antigravity) can run the
loop as tools: what is open, the gate, delivering a requirement. The server
ships inside the CLI:

```bash
specgate mcp install --client claude
```

Tools that write the specification refuse unless a change is open. Setup, the
tool list and the guard are on [The MCP server](mcp.md).

## Install the Claude Code plugin

The plugin gives Claude Code the loop as slash commands, the spec tree over
MCP, and a hook that runs the gate before a session can end.

```bash
specgate agents init --tool claude-plugin --project-dir ./specgate-plugin
```

That writes a complete plugin: `.claude-plugin/plugin.json`, nine slash
commands under `commands/specgate/`, an `.mcp.json` that starts the MCP server,
and `hooks/hooks.json` with the gate.

**The hook is what no instruction file can do.** Other agent tools get text an
agent may or may not follow. A plugin gets a `Stop` hook, which runs whatever
the agent decides:

```
The spec gate is failing, so this work is not finished:

  • [strict_tdd_1] Test artifact is TBD but status is 'In Dev'
    fix: Write the test first, then set its path in the row's
         'Test artifact' column.

Run `specgate validate . --strict` to see all of it.
```

The session does not end while the gate fails. The hook blocks **once per
prompt**: the second time, it reports the findings and lets the session end,
because a person needs to see the answer. A project without `spec.md`, or a
machine without `specgate` on its `PATH`, is left alone.

`claude-plugin` is the one target `specgate agents init` does not write by
default: a plugin is something you install once, not a file for every project.

## Use the VS Code extension

The extension adds diagnostics for `pack.yaml`, a "Reveal in traceability" link
on requirement ids, and validation on save.

1. Build it. It is not on the Marketplace yet: in a clone of the
   [Specgate repository](https://github.com/rsaglobaltech/specgate/tree/main/packages/vscode-spec-driven),
   run `npm run package` in `packages/vscode-spec-driven`, then install the
   `.vsix` file with **Extensions → Install from VSIX…**.
2. Open a project root. The extension finds `spec.md` and
   `docs/specs/traceability.md` on its own.
3. Open a `pack.yaml`: schema errors appear in the Problems panel.
4. Hover a `REQ-NNN` (or `UC-`, `SCN-`, `AGG-`, `EVT-`, `RUL-`, `CMD-`) to
   get **Reveal in traceability**.
5. To validate on save, open the settings, search **Spec-Driven** and tick
   `validateOnSave`.

| Setting | Default | Purpose |
| --- | --- | --- |
| `spec-driven.validateOnSave` | `false` | Run `validate` on every save. |
| `spec-driven.codeLens` | `true` | Show "Reveal in traceability". |
| `spec-driven.cliPath` | `npx @rsaglobaltech/specgate` | The command that runs Specgate. |
| `spec-driven.schemaPath` | bundled | A custom `pack.schema.json`. |

## Deliver requirements with the harness

The **harness** is Specgate's unattended loop. `specgate harness run` gives
each pending requirement to an agent in its own git worktree, runs the gate,
and marks the requirement Implemented with `specgate apply` when the gate
passes. It merges nothing unless you pass `--chain`. `specgate studio` shows
the run as it happens, at `/live`.

→ [The harness](harness.md) · [Choosing and wiring your agent](agent-setup.md)

## Run the gate without Node

The generated CI jobs call `npx`, which needs Node. When a build agent has no
Node (a Java team's Jenkins agent, a locked-down runner), use the Docker image
or the Maven and Gradle plugins.

**Docker.** Mount the workspace and run the gate:

```bash
docker run --rm -v "$PWD:/workspace" \
  ghcr.io/rsaglobaltech/specgate:0.27.10 validate . --strict
```

Pin the version: `latest` is fine on a laptop, but a gate that changes under a
pipeline is not a gate. Images are published for `linux/amd64` and
`linux/arm64`. Tags before 0.8.0 exist only under the tool's former name,
`ghcr.io/rsaglobaltech/csda`, and their command is not `specgate`; use 0.8.0 or
later.

In GitLab CI, that is the whole job:

```yaml
spec-gate:
  image: ghcr.io/rsaglobaltech/specgate:0.27.10
  stage: test
  script:
    - specgate validate . --strict
```

In Jenkins:

```groovy
stage('Spec gate') {
    agent { docker { image 'ghcr.io/rsaglobaltech/specgate:0.27.10' } }
    steps { sh 'specgate validate . --strict' }
}
```

**Maven or Gradle.** If the build already runs one of them, bind the gate to a
phase instead of adding a container:

```xml
<plugin>
  <groupId>com.rsaglobaltech</groupId>
  <artifactId>specgate-maven-plugin</artifactId>
  <executions>
    <execution>
      <goals><goal>validate</goal></goals>
    </execution>
  </executions>
</plugin>
```

The `validate` goal binds to the `verify` phase, so `mvn verify` runs the gate.
`plan` and `doctor` are goals too. The plugins target Java 11, because a
corporate build agent is where you cannot choose the JDK.

**Not published yet.** The plugin is not on Maven Central. Until it is, run
`mvn -f packages/maven-plugin install` in a clone of the Specgate repository to
put it in your local Maven repository. The Docker image needs nothing.

## Run the gate in a pre-commit hook

A hook catches a requirement without a scenario or a test before the commit
leaves your machine. With plain git, no extra tools:

```bash
# .git/hooks/pre-commit  (make it executable: chmod +x)
#!/usr/bin/env bash
set -e
npx specgate validate . --strict
if [ -f .specops.lock ]; then
  npx specgate validate . --against-lock
fi
```

The second command fails when files a domain pack rendered no longer match the
pack version recorded in `.specops.lock`.

Or with **husky**:

```bash
npm install --save-dev husky
npx husky init
echo 'npx specgate validate . --strict' > .husky/pre-commit
```

Anyone can skip a hook with `git commit --no-verify`, so run the same gate in
CI as well: see [Validating](validating.md#run-it-in-ci).

## Connect Jira

Specgate works with Jira in two modes. Pick one per project.

| Mode | What Specgate does in Jira | Start with |
| --- | --- | --- |
| A ticket as the source of a change | Only reads. The board moves through Jira Automation rules. | [From a Jira ticket](from-a-ticket.md) |
| A mirror of your requirements | Writes: an issue per requirement, closed when it is done. | [Jira and Azure Boards](alm.md) |

In the first mode, `specgate propose --from-ticket <KEY>` opens a change from a
story and its acceptance criteria, and `specgate alm pr <change-id>` opens one
pull request per ticket. In the second, `specgate alm sync` keeps the issues in
step with the requirements, and `specgate alm pull` opens a change for each
labelled issue. Azure Boards supports the mirror mode.

## Next

- [The harness](harness.md)
- [From a Jira ticket](from-a-ticket.md)
