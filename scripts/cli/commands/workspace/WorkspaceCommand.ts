import * as fs from "node:fs";
import * as path from "node:path";
import { BaseCommand } from "../../../lib/command";
import { agentIo, wantsJson } from "../../../lib/agent";
import { error, printDiagnostics } from "../../../lib/diagnostics";
import type { Diagnostic } from "../../../lib/diagnostics";
import { ensureIgnored } from "../../../lib/sonar-local";
import * as ui from "../../../lib/ui";
import { c } from "../../../lib/ui";
import {
  REPO_NAME,
  STORIES_DIR,
  WORKSPACE_FILE,
  WORKSPACE_ROLES,
  renderStory,
  renderWorkspace,
} from "../../../../packages/core/src/domain/Workspace";
import type { WorkspaceRepo, WorkspaceRole } from "../../../../packages/core/src/domain/Workspace";
import {
  LAST_CHECK_FILE,
  checkWorkspace,
  loadWorkspace,
  noteNoMembers,
  openSubChange,
  recordCheck,
  readStories,
  subChangeState,
  workspaceModel,
} from "../../../lib/workspace";
import { partRequirements, readWorkspaceLive } from "../../../lib/workspace-live";
import { baselineProblem } from "../harness/RunCommand";
import { spawn, spawnSync } from "node:child_process";
import { findCliRoot } from "../../../lib/project-root";

const NULL_SHAPE = { workspace: null };

function usage(): void {
  process.stdout.write(
    `
  🧩 ${c.bold}specgate workspace${c.reset} <init|status|check|propose|live|harness> [options]

  The repositories of one product, named in ${WORKSPACE_FILE} (ADR-0041).
  Inside a repository REQ-012 is the id; across the workspace it is fleet:REQ-012.

    init [--name <n>] [--repo <name>=<path>[:<role>]]… [--force]
                             write ${WORKSPACE_FILE}; without --repo, every sibling
                             folder that holds a Specgate project (roles: ${WORKSPACE_ROLES.join(", ")})
    status                   each repository (requirements done, branch, last gate) and each story
    check                    each repository's own check, then the qualified ids and the
                             dependencies between repositories; non-zero when any fails
    propose <story> --repos <a,b,…> [--title "<title>"]
                             a business story, and a change for it in each repository named
    live [--port <n>]        every repository's harness and every story, live (studio /live);
                             --json prints the model once
    harness run --story <id> [--dry-run] [-- <harness run options>]
                             one harness per repository with an open part of the story, all at
                             once; none when a repository's base already fails the gate

  Options: --project-dir <workspace dir>, --json.
`
  );
}

export class WorkspaceCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(argv.length === 0 ? 2 : 0);
    }
    const json = wantsJson(argv);
    const io = agentIo(json);
    const sub = argv[0];
    if (sub === "live" || sub === "harness") {
      runLiveOrHarness(argv, json, io);
      return;
    }
    let dirArg = ".";
    let name = "";
    let title = "";
    let force = false;
    const repoArgs: string[] = [];
    let repos = "";
    const positional: string[] = [];
    for (let i = 1; i < argv.length; i += 1) {
      const a = argv[i];
      if (a === "--project-dir") dirArg = argv[++i] || ".";
      else if (a === "--name") name = argv[++i] || "";
      else if (a === "--repo") repoArgs.push(argv[++i] || "");
      else if (a === "--repos") repos = argv[++i] || "";
      else if (a === "--title") title = argv[++i] || "";
      else if (a === "--force") force = true;
      else if (a === "--json") continue;
      else if (!a.startsWith("-")) positional.push(a);
      else
        io.usage(NULL_SHAPE, [
          error("unknown_flag", `Unknown argument for workspace: ${a}`, {
            fix: "specgate workspace --help",
          }),
        ]);
    }
    if (!["init", "status", "check", "propose"].includes(sub)) {
      io.usage(NULL_SHAPE, [
        error("unknown_subcommand", `workspace has no ${sub}.`, {
          fix: "specgate workspace --help",
        }),
      ]);
    }
    const dir = path.resolve(dirArg);

    if (sub === "init") {
      // REQ-290: the workspace file, from --repo or from the sibling projects.
      const file = path.join(dir, WORKSPACE_FILE);
      if (fs.existsSync(file) && !force) {
        io.fail(NULL_SHAPE, [
          error("workspace_exists", `${WORKSPACE_FILE} already exists.`, {
            fix: "specgate workspace init --force writes it again.",
          }),
        ]);
      }
      const members: WorkspaceRepo[] = [];
      const problems: Diagnostic[] = [];
      for (const spec of repoArgs) {
        const m = /^([^=]+)=([^:]+(?::[\\/][^:]*)?)(?::([a-z]+))?$/.exec(spec);
        const repoName = m ? m[1].trim() : "";
        const role = ((m && m[3]) || "service") as WorkspaceRole;
        if (!m || !REPO_NAME.test(repoName)) {
          problems.push(
            error(
              "workspace_repo_arg",
              `--repo ${spec}: write <name>=<path>[:<role>], as fleet=../fleet.`,
              {
                fix: "specgate workspace init --repo fleet=../fleet --repo web=../web:web",
              }
            )
          );
          continue;
        }
        if (!WORKSPACE_ROLES.includes(role)) {
          problems.push(
            error("workspace_role", `--repo ${spec}: the role is ${WORKSPACE_ROLES.join(", ")}.`, {
              fix: `specgate workspace init --repo ${repoName}=${m[2]}:service`,
            })
          );
          continue;
        }
        members.push({
          name: repoName,
          path: m[2].trim(),
          role,
          capabilities: capabilitiesOf(path.resolve(dir, m[2].trim())),
        });
      }
      if (problems.length) io.usage(NULL_SHAPE, problems);
      if (repoArgs.length === 0) members.push(...siblings(dir));
      if (members.length === 0) io.fail(NULL_SHAPE, [noteNoMembers()]);
      const config = { name: name || path.basename(dir), repos: members };
      fs.writeFileSync(file, renderWorkspace(config), "utf8");
      ensureIgnored(dir, LAST_CHECK_FILE);
      io.emit({ workspace: { file: WORKSPACE_FILE, ...config } }, () => {
        process.stdout.write(ui.header("workspace init", config.name));
        for (const r of members)
          process.stdout.write(ui.kv(r.name, `${r.path}  ${c.muted}${r.role}${c.reset}`) + "\n");
        process.stdout.write(
          `\n  ${ui.next("specgate workspace status", "each repository and each story")}\n`
        );
      });
      return;
    }

    const { ws, problems } = loadWorkspace(dir);
    if (!ws) io.fail(NULL_SHAPE, problems);

    if (sub === "status") {
      const model = workspaceModel(ws!);
      io.emit({ workspace: model }, () => {
        process.stdout.write(ui.header("workspace status", model.name));
        process.stdout.write(ui.section("Repositories"));
        const rows = model.repos.map((r) => [
          r.name,
          r.role,
          r.exists
            ? r.requirements
              ? `${r.requirements.done} of ${r.requirements.total} done`
              : "no status"
            : "missing",
          r.branch || "-",
          r.gate.state,
        ]);
        process.stdout.write(ui.table(rows) + "\n");
        if (model.stories.length) {
          process.stdout.write(ui.section("Stories"));
          for (const s of model.stories) {
            const parts = s.subchanges.map((sc) => `${sc.repo} ${sc.state}`).join(" · ");
            process.stdout.write(
              `    ${ui.state(s.done ? "done" : "doing")} ${s.id}  ${c.muted}${parts}${c.reset}\n`
            );
          }
        }
        process.stdout.write(
          `\n  ${ui.next("specgate workspace check", "every repository's gate, and the links between them")}\n`
        );
      });
      return;
    }

    if (sub === "check") {
      const result = checkWorkspace(ws!);
      recordCheck(ws!.dir, result);
      const diags = [
        ...result.repos.flatMap((r) =>
          r.ok
            ? []
            : r.problems.length
              ? r.problems.map((p) => ({ ...p, message: `${r.name}: ${p.message}` }))
              : [
                  error("workspace_repo_gate", `${r.name}: specgate check fails.`, {
                    target: r.name,
                    fix: `Run specgate check in ${r.name}.`,
                  }),
                ]
        ),
        ...result.problems,
      ];
      const payload = {
        workspace: { ok: result.ok, repos: result.repos.map((r) => ({ name: r.name, ok: r.ok })) },
      };
      if (!result.ok) {
        if (json) io.fail(payload as never, diags);
        process.stdout.write(ui.header("workspace check", ws!.config.name));
        for (const r of result.repos)
          process.stdout.write(`    ${ui.state(r.ok ? "done" : "blocked")} ${r.name}\n`);
        printDiagnostics(diags);
        process.exit(1);
      }
      io.emit(payload, () => {
        process.stdout.write(ui.header("workspace check", ws!.config.name));
        for (const r of result.repos) process.stdout.write(`    ${ui.state("done")} ${r.name}\n`);
        process.stdout.write(
          `\n  ${c.ok}✔${c.reset}  Every repository passes, and the links between them hold.\n`
        );
      });
      return;
    }

    // propose — REQ-296
    const story = positional[0] || "";
    if (!/^[a-z0-9][a-z0-9-]*$/.test(story)) {
      io.usage(NULL_SHAPE, [
        error(
          "workspace_story_id",
          "propose needs a story id: lower-case words joined by dashes.",
          {
            fix: "specgate workspace propose follow-shipment --repos fleet,tracking,web",
          }
        ),
      ]);
    }
    const names = repos
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const unknown = names.filter((n) => !ws!.dirs[n]);
    if (names.length === 0 || unknown.length) {
      io.usage(NULL_SHAPE, [
        error(
          "workspace_story_repos",
          names.length
            ? `Not repos of this workspace: ${unknown.join(", ")}.`
            : "propose needs --repos.",
          { fix: `--repos ${ws!.config.repos.map((r) => r.name).join(",")}` }
        ),
      ]);
    }
    const storyDir = path.join(ws!.dir, STORIES_DIR, story);
    if (fs.existsSync(storyDir)) {
      io.fail(NULL_SHAPE, [
        error("workspace_story_exists", `The story ${story} already exists.`, {
          fix: "specgate workspace status",
        }),
      ]);
    }
    const busy = names.filter((n) =>
      fs.existsSync(path.join(ws!.dirs[n], "docs", "specs", "changes", story))
    );
    if (busy.length) {
      io.fail(NULL_SHAPE, [
        error(
          "workspace_change_exists",
          `A change ${story} is already open in ${busy.join(", ")}.`,
          {
            fix: "Choose another story id, or archive that change first.",
          }
        ),
      ]);
    }
    const storyTitle = title || story.replace(/-/g, " ");
    const failed: Diagnostic[] = [];
    for (const n of names) {
      const p = openSubChange(ws!, n, story, storyTitle);
      if (p) failed.push(p);
    }
    if (failed.length) io.fail(NULL_SHAPE, failed);
    fs.mkdirSync(storyDir, { recursive: true });
    const record = {
      id: story,
      title: storyTitle,
      subchanges: names.map((n) => ({ repo: n, change: story })),
    };
    fs.writeFileSync(path.join(storyDir, "story.yaml"), renderStory(record), "utf8");
    fs.writeFileSync(
      path.join(storyDir, "story.md"),
      `# Story: ${storyTitle}\n\n## Intent\n\n<!-- The business story, in the words of whoever asked for it. It stays as it is while each repository's change works out the how. -->\n\n## Repositories\n\n` +
        names.map((n) => `- \`${n}\`: \`docs/specs/changes/${story}/\``).join("\n") +
        "\n",
      "utf8"
    );
    io.emit({ workspace: { story: record } }, () => {
      process.stdout.write(ui.header("workspace propose", story));
      for (const n of names)
        process.stdout.write(ui.fileLine("added", `${n}/docs/specs/changes/${story}/`) + "\n");
      process.stdout.write(ui.fileLine("added", `${STORIES_DIR}/${story}/story.md`) + "\n");
      process.stdout.write(
        `\n  ${ui.next("specgate workspace status", "the story is done when every repository archives its change")}\n`
      );
    });
  }
}

/** The capabilities a member specifies: its `docs/specs/capabilities/*`. */
function capabilitiesOf(dir: string): string[] {
  const caps = path.join(dir, "docs", "specs", "capabilities");
  if (!fs.existsSync(caps)) return [];
  return fs
    .readdirSync(caps, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/** Every sibling folder that holds a Specgate project, as a member. */
function siblings(dir: string): WorkspaceRepo[] {
  const parent = path.dirname(dir);
  const out: WorkspaceRepo[] = [];
  for (const e of fs.readdirSync(parent, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const full = path.join(parent, e.name);
    if (path.resolve(full) === path.resolve(dir)) continue;
    if (!fs.existsSync(path.join(full, "spec.md"))) continue;
    const repoName = e.name
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^[^a-z]+/, "");
    if (!REPO_NAME.test(repoName)) continue;
    const role: WorkspaceRole = /contracts?$/.test(repoName)
      ? "contracts"
      : /web$|frontend$/.test(repoName)
        ? "web"
        : "service";
    out.push({ name: repoName, path: `../${e.name}`, role, capabilities: capabilitiesOf(full) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** The value after a flag, or "". */
function flag(argv: string[], name: string): string {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] || "" : "";
}

/**
 * `workspace live` (REQ-323) and `workspace harness run --story` (REQ-324):
 * the workspace's live view, and the build that gives it something to show.
 */
function runLiveOrHarness(argv: string[], json: boolean, io: ReturnType<typeof agentIo>): void {
  const sep = argv.indexOf("--");
  const own = sep >= 0 ? argv.slice(0, sep) : argv;
  const passthrough = sep >= 0 ? argv.slice(sep + 1) : [];
  const dir = path.resolve(flag(own, "--project-dir") || ".");
  const { ws, problems } = loadWorkspace(dir);
  if (!ws) io.fail(NULL_SHAPE, problems);
  const cli = path.join(findCliRoot(__dirname), "bin", "specgate.js");

  if (own[0] === "live") {
    if (json) {
      io.emit({ live: readWorkspaceLive(ws!) }, () => undefined);
      return;
    }
    // The studio serves the workspace's /live when it runs in its repository.
    const port = flag(own, "--port");
    const r = spawnSync(
      process.execPath,
      [cli, "studio", "--project-dir", ws!.dir, ...(port ? ["--port", port] : [])],
      { stdio: "inherit" }
    );
    process.exit(r.status ?? 1);
  }

  if (own[1] !== "run") {
    io.usage(NULL_SHAPE, [
      error("unknown_subcommand", "workspace harness has run only.", {
        fix: "specgate workspace harness run --story <id>",
      }),
    ]);
  }
  const storyId = flag(own, "--story");
  const story = readStories(ws!.dir).find((s) => s.id === storyId);
  if (!story) {
    io.usage(NULL_SHAPE, [
      error("workspace_story_unknown", `No story ${storyId || "(none given)"} in this workspace.`, {
        fix: "specgate workspace status lists the stories.",
      }),
    ]);
  }
  const runs: Array<{
    repo: string;
    dir: string;
    requirements: string[];
    args: string[];
    command: string;
  }> = [];
  const red: Diagnostic[] = [];
  for (const sc of story!.subchanges) {
    const memberDir = ws!.dirs[sc.repo];
    if (!memberDir || !fs.existsSync(memberDir)) continue;
    if (subChangeState(memberDir, sc.change) !== "open") continue;
    const reqs = partRequirements(memberDir, sc.change);
    if (reqs.length === 0) continue;
    const ids = reqs.map((r) => r.id);
    // REQ-175, judged as the member's own harness judges it: a base red outside
    // this part fails every attempt, so no repository starts.
    const owned = new Set<string>([...ids, ...reqs.flatMap((r) => r.scenarios)]);
    const problem = baselineProblem(memberDir, owned);
    if (problem) {
      red.push(
        error("workspace_base_red", `${sc.repo}: ${problem.split("\n")[0]}`, {
          target: sc.repo,
          fix: `Run specgate check in ${sc.repo}, and make its base pass first.`,
        })
      );
    }
    const args = [
      "harness",
      "run",
      "--project-dir",
      memberDir,
      ...ids.flatMap((id) => ["--req", id]),
      ...passthrough,
    ];
    runs.push({
      repo: sc.repo,
      dir: memberDir,
      requirements: ids,
      args,
      command: `specgate ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" ")}`,
    });
  }
  if (red.length) io.fail({ harness: null } as never, red);
  const payload = {
    harness: { story: story!.id, runs: runs.map(({ dir: _d, args: _a, ...r }) => r) },
  };
  if (own.includes("--dry-run")) {
    io.emit(payload, () => {
      process.stdout.write(ui.header("workspace harness run", `${story!.id} · dry run`));
      for (const r of runs)
        process.stdout.write(`    ${r.repo}  ${c.muted}${r.command}${c.reset}\n`);
    });
    return;
  }
  if (runs.length === 0) {
    io.emit(payload, () => process.stdout.write("  Nothing open to build in this story.\n"));
    return;
  }
  // One process per repository, all at once; each keeps its own output.
  const logs = path.join(ws!.dir, ".specgate", "workspace-runs", story!.id);
  fs.mkdirSync(logs, { recursive: true });
  if (!json) process.stdout.write(ui.header("workspace harness run", story!.id));
  let left = runs.length;
  let worst = 0;
  const results: Array<{ repo: string; exit: number; log: string }> = [];
  for (const r of runs) {
    const log = path.join(logs, `${r.repo}.log`);
    const fd = fs.openSync(log, "w");
    const child = spawn(process.execPath, [cli, ...r.args], {
      stdio: ["ignore", fd, fd],
      env: { ...process.env, NO_COLOR: "1" },
    });
    if (!json) process.stdout.write(`    ${r.repo}  started · ${path.relative(ws!.dir, log)}\n`);
    child.on("close", (code) => {
      fs.closeSync(fd);
      const exit = code ?? 1;
      worst = Math.max(worst, exit);
      results.push({ repo: r.repo, exit, log });
      if (!json)
        process.stdout.write(`    ${ui.state(exit === 0 ? "done" : "blocked")} ${r.repo}\n`);
      left -= 1;
      if (left === 0) {
        if (json)
          process.stdout.write(JSON.stringify({ harness: { story: story!.id, results } }) + "\n");
        process.exit(worst);
      }
    });
  }
}
