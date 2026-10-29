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
  workspaceModel,
} from "../../../lib/workspace";

const NULL_SHAPE = { workspace: null };

function usage(): void {
  process.stdout.write(
    `
  🧩 ${c.bold}specgate workspace${c.reset} <init|status|check|propose> [options]

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
