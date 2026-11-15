import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { error } from "../../../lib/diagnostics";
import { agentIo, wantsJson } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";
import * as ui from "../../../lib/ui";
import { resolveProjectDir } from "../../../lib/project-root";
import { parseYamlLite } from "../../../../packages/core/src/domain/YamlLite";
import {
  changeIdOf,
  deliveredBy,
  intentOf,
  renderReleaseNotes,
  type ReleasedChange,
} from "../../../../packages/core/src/domain/ReleaseNotes";

const NULL_SHAPE = { releaseNotes: null };
const ARCHIVE = "docs/specs/changes/archive";

function usage(): void {
  process.stdout.write(
    "Usage:\n  specgate release-notes <from>..<to> [--out <file>] [--project-dir <path>] [--json]\n\n" +
      "The changes archived between two git refs (tags, branches, commits), grouped as\n" +
      "Enhancements, Fixes, then changes that declare no kind — each with its proposal's\n" +
      "intent and the requirements it added or modified. Markdown to --out, or to\n" +
      "standard output.\n\n" +
      "Exit 0 done · 1 an unknown ref · 2 usage error.\n"
  );
}

/** `specgate release-notes` (REQ-542). */
export class ReleaseNotesCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args[0] === "release-notes" ? this.args.slice(1) : this.args;
    if (argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(0);
    }
    const io = agentIo(wantsJson(argv));
    let dirArg = ".";
    let out = "";
    const words: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
      const a = argv[i];
      if (a === "--project-dir") dirArg = argv[++i] || ".";
      else if (a === "--out") out = argv[++i] || "";
      else if (a === "--json") continue;
      else if (a.startsWith("-")) {
        io.usage(NULL_SHAPE, [
          error("unknown_flag", `Unknown flag for release-notes: ${a}`, {
            fix: "specgate release-notes --help",
          }),
        ]);
      } else words.push(a);
    }
    const range = /^(.+?)\.\.(.+)$/.exec(words[0] || "");
    if (words.length !== 1 || !range) {
      io.usage(NULL_SHAPE, [
        error("release_notes_range", "release-notes takes one range, <from>..<to>.", {
          fix: "specgate release-notes v1.0.0..v1.1.0",
        }),
      ]);
      return;
    }
    const [, from, to] = range;
    let projectDir: string;
    try {
      projectDir = resolveProjectDir(dirArg);
    } catch {
      projectDir = path.resolve(dirArg);
    }
    const git = (...args: string[]) =>
      spawnSync("git", ["-C", projectDir, ...args], { encoding: "utf8" });
    for (const ref of [from, to]) {
      if (git("rev-parse", "--verify", "--quiet", `${ref}^{commit}`).status !== 0) {
        io.fail(NULL_SHAPE, [
          error("ref_unknown", `${ref} is not a git ref here.`, {
            target: ref,
            fix: "Name a tag, branch or commit: git tag --list",
          }),
        ]);
        return;
      }
    }
    const at = (rel: string) => {
      const r = git("show", `${to}:${rel}`);
      return r.status === 0 ? r.stdout : "";
    };
    const added = git("diff", "--name-only", "--diff-filter=A", from, to, "--", `${ARCHIVE}/`);
    const folders = [
      ...new Set(
        (added.stdout || "")
          .split("\n")
          .map(
            (l) =>
              l
                .trim()
                .slice(ARCHIVE.length + 1)
                .split("/")[0]
          )
          .filter(Boolean)
      ),
    ].sort();
    const changes: ReleasedChange[] = folders.map((folder) => {
      const base = `${ARCHIVE}/${folder}`;
      const config = parseYamlLite(at(`${base}/change.yaml`) || "") as { kind?: unknown };
      const deltas = (git("ls-tree", "-r", "--name-only", to, "--", `${base}/specs`).stdout || "")
        .split("\n")
        .filter((f) => f.endsWith("/spec.md"));
      return {
        id: changeIdOf(folder),
        kind: String(config?.kind || "").toLowerCase(),
        // A 1.0 change's Discover, or a 0.x change's proposal (REQ-542).
        intent: intentOf(at(`${base}/discover.md`) || at(`${base}/proposal.md`)),
        requirements: deltas.flatMap((d) => deliveredBy(at(d))),
      };
    });
    const markdown = renderReleaseNotes(from, to, changes);
    if (out) {
      const file = path.resolve(projectDir, out);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, markdown, "utf8");
    }
    io.emit({ releaseNotes: { from, to, changes, out: out || null, markdown } }, () => {
      if (out) {
        process.stdout.write(
          ui.header("release-notes", `${from}..${to}`) +
            ui.fileLine("added", out, `${changes.length} change(s)`) +
            "\n"
        );
      } else process.stdout.write(markdown);
    });
  }
}
