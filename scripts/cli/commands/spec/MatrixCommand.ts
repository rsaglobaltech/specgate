import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProjectDir } from "../../../lib/project-root";
import { error, warning, info } from "../../../lib/diagnostics";
import { agentIo, wantsJson } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";
import {
  deriveRows,
  diffRows,
  fieldsToReproduce,
  isDerivedMatrix,
  renderDerivedMatrix,
  requirementsIn,
  rowsOf,
  setTraceFields,
} from "../../../../packages/core/src/domain/DerivedMatrix";
import { readDerivationSources } from "../../../../packages/core/src/infrastructure/DerivedMatrixSources";
import { appendRequirementSection } from "../../../../packages/core/src/domain/SpecSections";

const COLOR =
  process.stdout.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== "dumb";
const c = {
  reset: COLOR ? "\x1b[0m" : "",
  bold: COLOR ? "\x1b[1m" : "",
  dim: COLOR ? "\x1b[2m" : "",
  green: COLOR ? "\x1b[32m" : "",
  yellow: COLOR ? "\x1b[33m" : "",
  red: COLOR ? "\x1b[31m" : "",
};

const NULL_SHAPE = { matrix: null };
const MATRIX = path.join("docs", "specs", "traceability.md");

function usage(): void {
  process.stdout.write(
    `
  🧮 ${c.bold}specgate matrix${c.reset} [--check] [--migrate] [--dry-run] [--json]

  The traceability matrix, generated instead of maintained. Each row comes from
  what the project already says:

    requirement, title   ## REQ-NNN — title in spec.md
    scenario, feature    scenarios tagged @REQ-NNN @SCN-NNN
    test                 test files that mention REQ-NNN
    status, overrides    <!-- csda:trace status=… --> in the requirement's section

  specgate matrix            regenerate docs/specs/traceability.md
  specgate matrix --check    exit 1 if the file no longer matches its sources
  specgate matrix --migrate  turn a hand-kept matrix into a generated one;
                             verifies the result is row-for-row identical first

`
  );
}

/** `# Traceability Matrix — demo` → `demo`. */
function projectNameOf(content: string | null): string | undefined {
  const m = /^#\s+Traceability Matrix\s+—\s+(.+)$/m.exec(content || "");
  return m ? m[1].trim() : undefined;
}

export function derivedMatrixFor(projectDir: string, existing: string | null): string {
  const rows = deriveRows(readDerivationSources(projectDir));
  return renderDerivedMatrix(rows, projectNameOf(existing));
}

/**
 * Regenerate a derived project's matrix. Returns true when the file changed.
 * A hand-kept matrix is never touched.
 */
export function refreshDerivedMatrix(projectDir: string): boolean {
  const file = path.join(projectDir, MATRIX);
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (!isDerivedMatrix(existing)) return false;
  const next = derivedMatrixFor(projectDir, existing);
  if (next === existing) return false;
  fs.writeFileSync(file, next, "utf8");
  return true;
}

/** The migration, computed and not written: what spec.md would become, and why it cannot. */
function planMigration(projectDir: string, original: any[]) {
  const specFile = path.join(projectDir, "spec.md");
  const specBefore = fs.existsSync(specFile) ? fs.readFileSync(specFile, "utf8") : "";
  let spec = specBefore;
  const sources = readDerivationSources(projectDir);
  const blocked: string[] = [];

  const byReq = new Map<string, any[]>();
  for (const row of original) {
    const id = String(row.requirement || "").trim();
    if (!/^REQ-/.test(id)) continue;
    byReq.set(id, [...(byReq.get(id) || []), row]);
  }

  for (const [id, rows] of byReq) {
    const titleCell = String(rows[0].useCase || "")
      .replace(/^UC-\d+\s*/, "")
      .trim();
    spec = appendRequirementSection(
      spec,
      id,
      titleCell && titleCell !== "-" ? titleCell : id
    ).content;
    const req = requirementsIn(spec).find((r) => r.id === id);
    if (!req) {
      // spec.md states it in a table row (the §8 convention), which carries
      // no csda:trace comment to hold status and links.
      blocked.push(`${id}: stated in a table in spec.md, not a \`## ${id}\` section`);
      continue;
    }
    const plan = fieldsToReproduce(req, rows, sources);
    if ("reason" in plan) {
      blocked.push(`${id}: ${plan.reason}`);
      continue;
    }
    spec = setTraceFields(spec, id, plan.fields) ?? spec;
  }

  const derived = deriveRows({ ...sources, spec });
  const d = diffRows(
    original.filter((r) => /^REQ-/.test(r.requirement || "")),
    derived
  );

  return { spec, specFile, derived, blocked, d, byReq };
}

/**
 * Switch a project to a generated matrix if that is lossless, silently.
 * Used by `init` and `adopt`, which create the matrix a moment before: a new
 * project should start generated, and one whose fresh matrix cannot be
 * reproduced (it never happens with what they write) stays hand-kept.
 */
export function migrateToDerived(projectDir: string): boolean {
  const file = path.join(projectDir, MATRIX);
  if (!fs.existsSync(file)) return false;
  const existing = fs.readFileSync(file, "utf8");
  if (isDerivedMatrix(existing)) return true;
  const original = rowsOf(existing);
  if (original.length === 0) return false;
  const { spec, specFile, derived, blocked, d } = planMigration(projectDir, original);
  if (blocked.length > 0 || d.missing.length > 0 || d.extra.length > 0) return false;
  fs.writeFileSync(specFile, spec, "utf8");
  fs.writeFileSync(file, renderDerivedMatrix(derived, projectNameOf(existing)), "utf8");
  return true;
}

export class MatrixCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    if (argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(0);
    }
    const io = agentIo(wantsJson(argv));
    const known = new Set(["--check", "--migrate", "--dry-run", "--json", "--project-dir"]);
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === "--project-dir") i++;
      else if (argv[i].startsWith("-") && !known.has(argv[i])) {
        io.usage(NULL_SHAPE, [
          error("unknown_flag", `Unknown flag for matrix: ${argv[i]}`, {
            fix: "specgate matrix --help",
          }),
        ]);
      }
    }
    const dirAt = argv.indexOf("--project-dir");
    let projectDir: string;
    try {
      projectDir = resolveProjectDir(dirAt >= 0 ? argv[dirAt + 1] : ".");
    } catch {
      projectDir = path.resolve(dirAt >= 0 ? argv[dirAt + 1] : ".");
    }
    const file = path.join(projectDir, MATRIX);
    const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    const dryRun = argv.includes("--dry-run");

    if (argv.includes("--migrate")) return this.migrate(io, projectDir, existing, dryRun);

    if (!isDerivedMatrix(existing)) {
      io.emit(
        {
          matrix: { projectDir, derived: false },
          status: [
            info("matrix_hand_kept", "This project keeps its matrix by hand.", {
              fix: "specgate matrix --migrate",
            }),
          ],
        },
        () =>
          process.stdout.write(
            `\n  ${c.dim}This project keeps its matrix by hand.${c.reset}\n` +
              `  ${c.green}specgate matrix --migrate${c.reset}${c.dim} generates it from spec.md, features and tests instead.${c.reset}\n\n`
          )
      );
      return;
    }

    const next = derivedMatrixFor(projectDir, existing);
    const stale = next !== existing;

    if (argv.includes("--check")) {
      if (!stale) {
        io.emit({ matrix: { projectDir, derived: true, stale: false } }, () =>
          process.stdout.write(`${c.green}✔${c.reset}  The matrix matches its sources.\n`)
        );
        return;
      }
      const d = diffRows(rowsOf(next), rowsOf(existing || ""));
      if (!io.json) {
        for (const k of d.missing) process.stderr.write(`  ${c.green}+ ${k}${c.reset}\n`);
        for (const k of d.extra) process.stderr.write(`  ${c.red}- ${k}${c.reset}\n`);
      }
      io.fail(NULL_SHAPE, [
        error("matrix_stale", "docs/specs/traceability.md no longer matches its sources.", {
          file: "docs/specs/traceability.md",
          fix: "Run `specgate matrix` and commit the result.",
        }),
      ]);
    }

    if (stale && !dryRun) fs.writeFileSync(file, next, "utf8");
    const rows = rowsOf(next).length;
    io.emit({ matrix: { projectDir, derived: true, written: stale && !dryRun, rows } }, () =>
      process.stdout.write(
        stale
          ? `${c.green}✔${c.reset}  ${dryRun ? "Would regenerate" : "Regenerated"} docs/specs/traceability.md ${c.dim}(${rows} rows)${c.reset}\n`
          : `${c.green}✔${c.reset}  The matrix is up to date ${c.dim}(${rows} rows)${c.reset}\n`
      )
    );
  }

  /**
   * Hand-kept → generated, or nothing at all.
   *
   * Writes into each requirement's section only what derivation would get
   * wrong, then derives and compares row for row against the original. Any
   * difference restores both files and names the requirements that cannot be
   * expressed yet — a migration that loses a row is worse than none.
   */
  private migrate(io: any, projectDir: string, existing: string | null, dryRun: boolean): void {
    if (existing === null) {
      io.usage(NULL_SHAPE, [
        error("traceability_not_found", "No docs/specs/traceability.md to migrate.", {
          fix: "specgate init",
        }),
      ]);
    }
    if (isDerivedMatrix(existing)) {
      io.emit({ matrix: { projectDir, derived: true, migrated: false } }, () =>
        process.stdout.write(`${c.dim}Already generated — nothing to migrate.${c.reset}\n`)
      );
      return;
    }
    const original = rowsOf(existing as string);
    if (original.length === 0) {
      io.fail(NULL_SHAPE, [
        error("matrix_not_rich", "Only the ten-column matrix can be migrated.", {
          file: "docs/specs/traceability.md",
        }),
      ]);
    }

    const { spec, specFile, derived, blocked, d, byReq } = planMigration(projectDir, original);

    if (blocked.length > 0 || d.missing.length > 0 || d.extra.length > 0) {
      if (!io.json) {
        for (const b of blocked) process.stderr.write(`  ${c.red}✖${c.reset} ${b}\n`);
        for (const k of d.missing) process.stderr.write(`  ${c.red}lost: ${k}${c.reset}\n`);
        for (const k of d.extra) process.stderr.write(`  ${c.yellow}new:  ${k}${c.reset}\n`);
      }
      io.fail(NULL_SHAPE, [
        error(
          "migration_not_lossless",
          "The generated matrix would not match this one row for row, so nothing was changed.",
          {
            file: "docs/specs/traceability.md",
            fix:
              "Tag each scenario @REQ-NNN @SCN-NNN in its feature file for requirements with " +
              "several rows, then run `specgate matrix --migrate` again.",
          }
        ),
      ]);
    }

    const next = renderDerivedMatrix(derived, projectNameOf(existing));
    if (!dryRun) {
      fs.writeFileSync(specFile, spec, "utf8");
      fs.writeFileSync(path.join(projectDir, MATRIX), next, "utf8");
    }
    const notes = [
      warning(
        "matrix_now_generated",
        "docs/specs/traceability.md is now generated. Edit spec.md, features and tests instead.",
        { fix: "specgate matrix regenerates it; validate fails when it is stale." }
      ),
    ];
    io.emit(
      {
        matrix: {
          projectDir,
          derived: true,
          migrated: !dryRun,
          requirements: byReq.size,
          rows: derived.length,
        },
        status: notes,
      },
      () =>
        process.stdout.write(
          `${c.green}✔${c.reset}  ${dryRun ? "Would migrate" : "Migrated"} ${byReq.size} requirement(s), ${derived.length} row(s) — identical row for row.\n` +
            `   ${c.dim}spec.md now owns status and explicit links (csda:trace); the matrix is generated.${c.reset}\n` +
            `   ${c.dim}Next: commit both files. From now on: specgate new · specgate done · specgate check.${c.reset}\n`
        )
    );
  }
}
