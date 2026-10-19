import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { error } from "../../../lib/diagnostics";
import { agentIo, wantsJson, EXIT, AgentIo } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";

import { findCliRoot } from "../../../lib/project-root";

const CLI = path.join(findCliRoot(__dirname), "bin", "specgate.js");

export function parseReference(reference: string) {
  const at = reference.lastIndexOf("@");
  if (at <= 0) return { repo: reference, version: null };
  return { repo: reference.slice(0, at), version: reference.slice(at + 1) };
}

function run(args: string[], cwd?: string) {
  return spawnSync(process.execPath, [CLI, ...args], {
    stdio: "inherit",
    cwd: cwd || process.cwd(),
    encoding: "utf8",
  });
}

function usage() {
  process.stdout.write(
    "Usage:\n" +
      "  specgate init --from-pack <repo>@<tag> --pack <pack-id> [--config <path>] [--out <dir>]\n\n" +
      "Scaffolds the project and installs the pack in one step, pinned to the tag.\n" +
      "Every other `init` flag is passed through.\n\n" +
      "Example:\n" +
      "  specgate init --from-pack https://github.com/acme/parking-specops.git@v0.2.0 \\\n" +
      "    --pack backend --config ./project.yaml --out ./services\n"
  );
}

export function newestProjectIn(outDir: string) {
  let best: string | null = null;
  let bestTime = -1;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(outDir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(outDir, entry.name);
    if (!fs.existsSync(path.join(dir, "spec.md"))) continue;
    const mtime = fs.statSync(dir).mtimeMs;
    if (mtime > bestTime) {
      bestTime = mtime;
      best = dir;
    }
  }
  return best;
}

export class InitFromPackCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    const io: AgentIo = agentIo(wantsJson(argv));
    const NULL_SHAPE = { project: null };

    if (argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(EXIT.OK);
    }

    const initArgs: string[] = [];
    let reference: string | null = null;
    let packId: string | null = null;
    let outDir = ".";
    const vars: string[] = [];

    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === "--from-pack" && argv[i + 1]) reference = argv[++i];
      else if (a === "--pack" && argv[i + 1]) packId = argv[++i];
      else if (a === "--var" && argv[i + 1]) {
        vars.push("--var", argv[++i]);
      } else {
        if (a === "--out" && argv[i + 1]) outDir = argv[i + 1];
        initArgs.push(a);
      }
    }

    const { repo, version } = parseReference(reference || "");

    if (!reference) {
      io.usage(NULL_SHAPE, [
        error("from_pack_required", "--from-pack needs a <repo>@<tag> reference.", {
          fix: "specgate init --from-pack https://github.com/acme/specops.git@v0.1.0 --pack backend",
        }),
      ]);
    }
    if (!version) {
      io.usage(NULL_SHAPE, [
        error("from_pack_unpinned", `No tag in "${reference}".`, {
          target: reference,
          fix: "Pin it: --from-pack <repo>@<tag>. An unpinned pack means two repos scaffolded a week apart get different specs.",
        }),
      ]);
    }
    if (!packId) {
      io.usage(NULL_SHAPE, [
        error("pack_id_required", "--pack names which pack inside the repo to install.", {
          fix: "Add --pack backend (or whichever id the pack repo declares).",
        }),
      ]);
    }

    const init = run(["init", "--no-sample-req", ...initArgs]);
    if (init.status !== 0) {
      io.fail(NULL_SHAPE, [
        error("init_failed", "Scaffolding failed; the pack was not installed.", {
          fix: "Fix what `specgate init` reported, then re-run.",
        }),
      ]);
    }

    const projectDir = newestProjectIn(outDir);
    if (!projectDir) {
      io.fail(NULL_SHAPE, [
        error("project_dir_not_found", `Could not find the project init created under ${outDir}.`, {
          fix: "Install the pack yourself: specgate specops add --pack-repo … --pack-version … --pack …",
        }),
      ]);
    }

    const add = run([
      "specops",
      "add",
      "--pack-repo",
      repo,
      "--pack-version",
      version!,
      "--pack",
      packId!,
      "--project-dir",
      projectDir!,
      ...vars,
    ]);

    if (add.status !== 0) {
      io.fail({ project: { dir: projectDir, pack: null } }, [
        error("pack_install_failed", "The project was created but the pack was not installed.", {
          target: `${repo}@${version}`,
          fix: `Re-run just the install: specgate specops add --pack-repo ${repo} --pack-version ${version} --pack ${packId} --project-dir ${projectDir}`,
        }),
      ]);
    }

    io.emit({ project: { dir: projectDir, pack: { repo, version, id: packId } } }, () =>
      process.stdout.write(
        `\n  ✔  ${path.basename(projectDir!)} scaffolded with ${packId} @ ${version}\n` +
          `     Next: specgate validate ${projectDir}\n\n`
      )
    );
    process.exit(EXIT.OK);
  }
}
