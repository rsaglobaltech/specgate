/**
 * `specgate verify` — what another tool calls done, gated on evidence
 * (ADR-0030, docs/specs/verify-foreign-specs.md).
 *
 * Reads the other tool's files read-only, runs the rules in `VerifyClaims`,
 * and writes nothing outside `.specgate/`. The facts the rules need and a
 * pure module cannot gather — files, git history, the test run, the lock —
 * are gathered here.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { BaseCommand } from "../../../lib/command";
import { agentIo, wantsJson } from "../../../lib/agent";
import { error, type Diagnostic } from "../../../lib/diagnostics";
import { resolveProjectDir } from "../../../lib/project-root";
import { readDerivationSources } from "../../../../packages/core/src/infrastructure/DerivedMatrixSources";
import type { ForeignSpec, SourceText } from "../../../../packages/core/src/domain/ForeignSpec";
import {
  isOpenSpecProject,
  readOpenSpec,
} from "../../../../packages/core/src/domain/OpenSpecReader";
import { verifyClaims, type VerifyResult } from "../../../../packages/core/src/domain/VerifyClaims";

const LOCK = path.join(".specgate", "verify.lock");
const FORMATS = ["openspec"] as const;

export interface VerifyOptions {
  projectDir: string;
  from: string;
  run: boolean;
  testCmd: string;
  since: string;
  record: boolean;
  ids: boolean;
  json: boolean;
  format: "text" | "github" | "json";
}

function usage(): string {
  return (
    "Usage:\n" +
    '  specgate verify [--from openspec] [--project-dir <dir>] [--run] [--test-cmd "<cmd>"]\n' +
    "                  [--since <git-ref>] [--record] [--ids] [--json | --format github]\n\n" +
    "Reads another tool's specification in place and fails while something it\n" +
    "calls done has no test naming each criterion it covers (ADR-0030).\n\n" +
    "  --from <format>   openspec. Detected when omitted.\n" +
    "  --run             Run the test command too; a failing suite fails the check.\n" +
    "  --test-cmd <cmd>  The suite to run (default: `npm test` when package.json has one).\n" +
    "  --since <ref>     Gate only claims made after this git ref; older ones are reported.\n" +
    "  --record          After a green run, record the verified criteria in .specgate/verify.lock.\n" +
    "  --ids             Print every criterion id, to name in tests.\n" +
    "  --format github   GitHub Actions annotations on the spec lines.\n"
  );
}

export function parseArgs(argv: string[]): VerifyOptions {
  const o: VerifyOptions = {
    projectDir: ".",
    from: "",
    run: false,
    testCmd: "",
    since: "",
    record: false,
    ids: false,
    json: wantsJson(argv),
    format: "text",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === "--project-dir") o.projectDir = value();
    else if (a === "--from") o.from = value();
    else if (a === "--run") o.run = true;
    else if (a === "--test-cmd") o.testCmd = value();
    else if (a === "--since") o.since = value();
    else if (a === "--record") o.record = true;
    else if (a === "--ids") o.ids = true;
    else if (a === "--json") o.format = "json";
    else if (a === "--format") {
      const f = value();
      if (f !== "text" && f !== "github" && f !== "json") throw new Error(`unknown --format ${f}`);
      o.format = f;
    } else if (a === "--help" || a === "-h") {
      process.stdout.write(usage());
      process.exit(0);
    } else throw new Error(`unknown argument ${a}`);
  }
  if (o.from && !(FORMATS as readonly string[]).includes(o.from)) {
    throw new Error(`--from ${o.from}: supported formats are ${FORMATS.join(", ")}`);
  }
  return o;
}

function walk(root: string, rel: string, out: string[]) {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const child = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(root, child, out);
    else if (e.isFile() && e.name.endsWith(".md")) out.push(child);
  }
}

export function readSpec(projectDir: string, from: string): ForeignSpec | null {
  const paths: string[] = [];
  walk(projectDir, "openspec", paths);
  if (from === "openspec" || (!from && isOpenSpecProject(paths))) {
    const files: SourceText[] = paths.map((p) => ({
      path: p,
      source: fs.readFileSync(path.join(projectDir, p), "utf8"),
    }));
    return readOpenSpec(files);
  }
  return null;
}

function git(projectDir: string, args: string[]) {
  return spawnSync("git", args, { cwd: projectDir, encoding: "utf8" });
}

/** The claims whose dating path did not exist at `ref`. */
function freshClaims(projectDir: string, spec: ForeignSpec, ref: string): Set<string> {
  const ok = git(projectDir, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  if (ok.status !== 0) throw new Error(`--since ${ref}: not a commit in this repository`);
  const fresh = new Set<string>();
  for (const c of spec.claims) {
    const tree = git(projectDir, ["ls-tree", ref, "--", c.datedBy]);
    if ((tree.stdout || "").trim() === "") fresh.add(c.datedBy);
  }
  return fresh;
}

export function hashCriterion(text: string): string {
  const normal = text.replace(/\s+/g, " ").trim();
  return crypto.createHash("sha256").update(normal).digest("hex").slice(0, 16);
}

function readLock(projectDir: string): Map<string, string> {
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(projectDir, LOCK), "utf8"));
    return new Map(
      Object.entries(doc.criteria || {}).map(([k, v]: [string, any]) => [k, String(v.hash)])
    );
  } catch {
    return new Map();
  }
}

function writeLock(projectDir: string, spec: ForeignSpec, proved: readonly string[]) {
  const file = path.join(projectDir, LOCK);
  let doc: any = { version: 1, criteria: {} };
  try {
    doc = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    // a first record
  }
  const head = (git(projectDir, ["rev-parse", "HEAD"]).stdout || "").trim() || null;
  const texts = new Map(spec.requirements.flatMap((r) => r.criteria.map((c) => [c.id, c.text])));
  for (const id of [...proved].sort()) {
    const text = texts.get(id);
    if (text !== undefined) doc.criteria[id] = { hash: hashCriterion(text), commit: head };
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
}

function defaultTestCmd(projectDir: string): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf8"));
    if (pkg.scripts && pkg.scripts.test) return "npm test";
  } catch {
    // not a node project
  }
  return "";
}

function renderText(result: VerifyResult) {
  const gated = result.claims.filter((c) => c.gated);
  const out = process.stdout;
  out.write(`\n  specgate verify — ${result.format}\n\n`);
  out.write(
    `  ${result.claims.length} claim(s) of done, ${gated.length} gated · ` +
      `${result.coverage.named}/${result.coverage.total} criteria named by a test\n\n`
  );
  for (const d of result.status) {
    const mark = d.severity === "error" ? "✖" : d.severity === "warning" ? "▲" : "ℹ";
    out.write(`  ${mark}  ${d.message}\n`);
    if (d.fix && d.severity === "error") out.write(`     fix: ${d.fix}\n`);
  }
  const errors = result.status.filter((d) => d.severity === "error").length;
  if (errors === 0 && gated.length === 0) {
    out.write(
      `\n  ✔  Nothing to gate: no finished claim of done${result.claims.length ? " is new" : ""}. ` +
        `${result.claims.length - gated.length} older or unfinished claim(s) reported above.\n`
    );
    return;
  }
  out.write(
    errors === 0
      ? `\n  ✔  Every gated claim of done is named by a test.\n` +
          `     A test that names a criterion is evidence it ran, not proof it asserts the right thing.\n`
      : `\n  ✖  ${errors} problem(s) with what is called done.\n`
  );
}

function renderGithub(status: Diagnostic[]) {
  for (const d of status) {
    if (d.severity === "info") continue;
    const level = d.severity === "error" ? "error" : "warning";
    const where = d.file ? ` file=${d.file}${d.line ? `,line=${d.line}` : ""}` : "";
    process.stdout.write(`::${level}${where},title=${d.code}::${d.message.replace(/\n/g, " ")}\n`);
  }
}

export class VerifyCommand extends BaseCommand {
  public execute(): void {
    let o: VerifyOptions;
    const io0 = agentIo(wantsJson(this.args));
    try {
      o = parseArgs(this.args);
    } catch (err: any) {
      io0.usage({ verify: null }, [
        error("verify_usage", err.message, { fix: "specgate verify --help" }),
      ]);
    }
    const io = agentIo(o!.format === "json" || o!.json);
    const opts = o!;
    const projectDir = resolveProjectDir(opts.projectDir);

    const spec = readSpec(projectDir, opts.from);
    if (!spec) {
      io.fail({ verify: null }, [
        error("verify_no_spec", `No OpenSpec specification found in ${projectDir}.`, {
          fix: "Run it at the root of a project with an `openspec/` directory, or pass --project-dir.",
        }),
      ]);
    }

    if (opts.ids) {
      if (io.json) {
        io.emit({ verify: { ids: spec!.requirements } });
        return;
      }
      for (const r of spec!.requirements) {
        process.stdout.write(`${r.id}  ${r.title}\n`);
        for (const c of r.criteria) process.stdout.write(`  ${c.id}  ${c.title}\n`);
      }
      return;
    }

    let fresh: Set<string> | undefined;
    try {
      fresh = opts.since ? freshClaims(projectDir, spec!, opts.since) : undefined;
    } catch (err: any) {
      io.usage({ verify: null }, [error("verify_since", err.message)]);
    }

    const tests = readDerivationSources(projectDir).tests;
    const result = verifyClaims({
      spec: spec!,
      tests,
      freshClaims: fresh,
      lock: readLock(projectDir),
      hash: hashCriterion,
    });

    if (opts.run) {
      const cmd = opts.testCmd || defaultTestCmd(projectDir);
      if (!cmd) {
        result.status.push(
          error("V2_failing_suite", "--run was given and no test command is known.", {
            fix: 'Pass --test-cmd "<the command that runs the suite>".',
          })
        );
      } else {
        const r = spawnSync(cmd, {
          cwd: projectDir,
          shell: true,
          stdio: io.json ? "pipe" : "inherit",
        });
        if (r.status !== 0) {
          result.status.push(
            error(
              "V2_failing_suite",
              `\`${cmd}\` failed (exit ${r.status}); a red suite proves nothing done.`
            )
          );
        }
      }
    }

    const failed = result.status.some((d) => d.severity === "error");
    if (opts.record && !failed) writeLock(projectDir, spec!, result.proved);

    if (opts.format === "github") {
      renderGithub(result.status);
      process.exitCode = failed ? 1 : 0;
      return;
    }
    // Exit through exitCode, not process.exit: a large JSON document piped to
    // another process must drain first (golden_app finding #33).
    const { status, ...payload } = result;
    io.emit({ verify: payload, status }, () => renderText(result));
    process.exitCode = failed ? 1 : 0;
  }
}
