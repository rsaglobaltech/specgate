/**
 * `specgate draft --check <change-id>` — is a draft complete enough to
 * review? (ADR-0029, docs/specs/draft-from-brief.md §4–5)
 *
 * Phase 1 of `draft`: the checklist, runnable on a change written by any
 * agent or person. Drafting it with the project's agent comes later; this is
 * what holds that draft — and any hand-written change — to the rules.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { BaseCommand } from "../../../lib/command";
import { agentIo, wantsJson } from "../../../lib/agent";
import { error, info } from "../../../lib/diagnostics";
import { resolveProjectDir } from "../../../lib/project-root";
import { checkDraft } from "../../../../packages/core/src/domain/DraftChecklist";
import { readDerivationSources } from "../../../../packages/core/src/infrastructure/DerivedMatrixSources";

const CHANGES = path.join("docs", "specs", "changes");

export interface DraftOptions {
  check: string;
  brief: string;
  maxRequirements: number;
  projectDir: string;
  json: boolean;
}

function usage(): string {
  return (
    "Usage:\n" +
    "  specgate draft --check <change-id> [--brief <file>] [--max-requirements <n>] [--project-dir <dir>] [--json]\n\n" +
    "Checks a draft change against the checklist (ADR-0029):\n" +
    "  D1 every requirement has a scenario          D5 a cited law or standard names its source\n" +
    "  D2 every requirement has a kind              D6 a stated value is in the brief or an assumption\n" +
    "  D3 a scenario per surface each actor uses    D7 an open question names what it blocks\n" +
    "  D4 a non-functional requirement is measured  D8 the draft is small enough to review\n" +
    "                                                D9 every scenario passes the harness gate's rules\n\n" +
    "  --brief <file>   The brief the draft came from. Without it D3 and D6 cannot\n" +
    "                   run, and the report says so. Also read from `brief:` in change.yaml.\n"
  );
}

export function parseArgs(argv: string[]): DraftOptions {
  const o: DraftOptions = {
    check: "",
    brief: "",
    maxRequirements: 25,
    projectDir: ".",
    json: wantsJson(argv),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === "--check") o.check = value();
    else if (a === "--brief") o.brief = value();
    else if (a === "--max-requirements") o.maxRequirements = Number(value());
    else if (a === "--project-dir") o.projectDir = value();
    else if (a === "--json") o.json = true;
    else if (a === "--help" || a === "-h") {
      process.stdout.write(usage());
      process.exit(0);
    } else throw new Error(`unknown argument ${a}`);
  }
  if (!o.check) {
    throw new Error(
      "--check <change-id> is required (drafting with an agent is not available yet)"
    );
  }
  if (!Number.isInteger(o.maxRequirements) || o.maxRequirements < 1) {
    throw new Error("--max-requirements needs a positive integer");
  }
  return o;
}

function specFiles(dir: string, rel = ""): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const child = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...specFiles(dir, child));
    else if (e.name === "spec.md") out.push(child);
  }
  return out;
}

/** `spec.md` and the capability specs: values already reviewed in this project (#52). */
function projectSpecText(projectDir: string): string {
  try {
    const sources = readDerivationSources(projectDir);
    return [sources.spec || "", ...(sources.capabilities || []).map((c: any) => c.source)].join(
      "\n"
    );
  } catch {
    return "";
  }
}

const readIf = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : undefined);

export class DraftCommand extends BaseCommand {
  public execute(): void {
    const io0 = agentIo(wantsJson(this.args));
    let o: DraftOptions;
    try {
      o = parseArgs(this.args);
    } catch (err: any) {
      io0.usage({ draft: null }, [
        error("draft_usage", err.message, { fix: "specgate draft --help" }),
      ]);
    }
    const opts = o!;
    const io = agentIo(opts.json);
    const projectDir = resolveProjectDir(opts.projectDir);
    const changeDir = path.join(projectDir, CHANGES, opts.check);
    if (!fs.existsSync(changeDir)) {
      io.fail({ draft: null }, [
        error("draft_no_change", `No change '${opts.check}' under ${CHANGES}/.`, {
          fix: "specgate change list — or open one with `specgate change new <id>`.",
        }),
      ]);
    }

    const specs = path.join(changeDir, "specs");
    const deltas = specFiles(specs).map((rel) => ({
      path: path.join(CHANGES, opts.check, "specs", rel).split(path.sep).join("/"),
      source: fs.readFileSync(path.join(specs, rel), "utf8"),
    }));
    if (deltas.length === 0) {
      io.fail({ draft: null }, [
        error(
          "draft_no_specs",
          `Change '${opts.check}' has no specs/<capability>/spec.md to check.`
        ),
      ]);
    }

    // The brief: --brief, else `brief: <path>` in change.yaml.
    let briefPath = opts.brief;
    if (!briefPath) {
      const yaml = readIf(path.join(changeDir, "change.yaml")) || "";
      const m = /^brief:\s*["']?([^"'\n]+)["']?\s*$/m.exec(yaml);
      if (m) briefPath = m[1].trim();
    }
    let brief: string | undefined;
    if (briefPath) {
      brief = readIf(path.resolve(projectDir, briefPath));
      if (brief === undefined) {
        io.fail({ draft: null }, [
          error("draft_no_brief", `The brief ${briefPath} does not exist.`),
        ]);
      }
    }

    const report = checkDraft({
      deltas,
      brief,
      assumptions: readIf(path.join(changeDir, "assumptions.md")),
      specText: projectSpecText(projectDir),
      questions: readIf(path.join(changeDir, "questions.md")),
      maxRequirements: opts.maxRequirements,
    });
    const status = [
      ...report.status,
      ...report.skipped.map((s) =>
        info("draft_rule_skipped", `${s.rule} did not run: ${s.why}.`, {
          fix: "Pass --brief <file>, with actors and their surfaces in its front matter for D3.",
        })
      ),
    ];
    const errors = report.status.length;

    io.emit(
      {
        draft: {
          change: opts.check,
          requirements: report.requirements,
          scenarios: report.scenarios,
          skipped: report.skipped,
        },
        status,
      },
      () => {
        const out = process.stdout;
        out.write(`\n  specgate draft --check ${opts.check}\n\n`);
        out.write(`  ${report.requirements} requirement(s), ${report.scenarios} scenario(s)\n\n`);
        for (const d of status) {
          out.write(`  ${d.severity === "error" ? "✖" : "ℹ"}  ${d.code}  ${d.message}\n`);
          if (d.fix && d.severity === "error") out.write(`     fix: ${d.fix}\n`);
        }
        const skipped = report.skipped.length;
        out.write(
          errors === 0
            ? `\n  ✔  Ready to review${skipped ? ` (${skipped} rule(s) did not run — see above)` : ""}.\n`
            : `\n  ✖  ${errors} finding(s) to fix before review.\n`
        );
      }
    );
    process.exitCode = errors === 0 ? 0 : 1;
  }
}
