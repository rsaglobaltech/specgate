/** What a team wires around the loop: CI, agent files, upgrades. */
import * as fs from "node:fs";
import * as path from "node:path";

export default [
  {
    name: "ci init writes a workflow that runs the one gate",
    covers: ["ci init"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      t.ok(t.sg(dir, "ci", "init", "--provider", "github"), "ci init --provider github");
      const wf = fs
        .readdirSync(path.join(dir, ".github", "workflows"))
        .map((f) => t.read(dir, `.github/workflows/${f}`))
        .join("\n");
      // `check` is validate --strict plus the project's tests (#70).
      t.expect(/specgate@\S+ check \./.test(wf), "the workflow runs check — the spec and the tests");
      t.expect(/npm (ci|install)/.test(wf), "after installing the project's dependencies");
      t.expect(!/--strict-tdd/.test(wf), "and not the weaker --strict-tdd");
    },
  },
  {
    name: "agents init writes /specgate:* commands for the daily loop",
    covers: ["agents init"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      t.ok(t.sg(dir, "agents", "init", "--tool", "claude,cursor"), "agents init");
      t.expect(t.exists(dir, ".cursor/rules/specgate.mdc"), "cursor rule named specgate");
      t.expect(
        /# \/specgate:apply/.test(t.read(dir, ".claude/commands/specgate/apply.md")),
        "heading"
      );
      for (const step of ["explore", "new", "apply", "check", "done"]) {
        t.expect(
          t.exists(dir, `.claude/commands/specgate/${step}.md`),
          `the daily loop has /specgate:${step}`
        );
      }
      t.expect(
        /specgate check --json/.test(t.read(dir, ".claude/commands/specgate/check.md")),
        "/specgate:check runs check"
      );
      t.expect(
        /That mention is the link/.test(t.read(dir, "AGENTS.md")),
        "AGENTS.md teaches the mention as the link"
      );
    },
  },
  {
    name: "agents install --global puts the guards where OpenCode and Claude Code find them",
    covers: ["agents install"],
    run(dir, t) {
      const home = path.join(dir, "home");
      const env = { HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: path.join(home, ".config") };
      const r = t.sgEnv(dir, env, "agents", "install", "--global");
      t.ok(r, "agents install --global");
      t.expect(
        fs.existsSync(path.join(home, ".config", "opencode", "plugin", "specgate.js")),
        "the OpenCode plugin in its global folder"
      );
      t.expect(/\/plugin install specgate@specgate/.test(r.stdout), "Claude Code is told how to install the plugin");
    },
  },
  {
    name: "update refreshes generated agent files and keeps a team's edit",
    covers: ["update"],
    run(dir, t) {
      t.nodeRepo(dir);
      t.ok(t.sg(dir, "init"), "init");
      t.ok(t.sg(dir, "agents", "init", "--tool", "claude"), "agents init");
      const file = path.join(dir, ".claude/commands/specgate/apply.md");
      t.expect(fs.existsSync(file), "agents init wrote the slash command");
      fs.appendFileSync(file, "\nOUR TEAM RULE\n");
      t.write(dir, "README.md", "# Our project\n");
      t.ok(t.sg(dir, "update"), "update");
      t.expect(fs.readFileSync(file, "utf8").includes("OUR TEAM RULE"), "the team's edit survived");
      t.expect(t.read(dir, "README.md") === "# Our project\n", "the project README is untouched");
      const again = t.json(t.sg(dir, "update", "--json"));
      t.expect(
        again.update.files.every((f) => f.outcome === "unchanged"),
        "a second update is a no-op"
      );
    },
  },
];
