/**
 * `specgate propose --use-cases [--agent <cmd>]` (REQ-636, #544): a project
 * whose requirements were delivered before it kept use cases gets a change
 * that proposes them — `use-cases.md` with every use case, and each one's
 * specification — for a person to review, approve and archive like any other.
 * Nothing in the catalog is written here: archive does that.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { renderConfig } from "../../../../packages/core/src/infrastructure/ChangeWorkspace";
import { parseTraceabilityRows } from "../../../../packages/core/src/domain/TraceabilityFormat";
import {
  checkUseCaseDelta,
  parseUseCaseDelta,
  readCatalog,
  templateUseCases,
} from "../../../../packages/core/src/domain/UseCaseDelta";
import {
  checkUseCaseSpec,
  parseUseCaseSpec,
} from "../../../../packages/core/src/domain/UseCaseSpec";
import { runConfinedAgent, withWritePermission } from "../../../draft/confined-agent";
import { projectIds, reserveUseCaseRange } from "./DraftCommand";

export const USE_CASES_CHANGE = "use-cases-catalog";

export interface Uncovered {
  id: string;
  title: string;
  scenarios: string[];
}

const read = (file: string): string | null =>
  fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;

/**
 * The requirements no use case delivers yet (REQ-636): in the matrix, neither
 * naming a use case of the catalog nor listed by one — REQ-000 and the
 * adopted code's baseline left out — each with its scenarios.
 */
export function uncoveredRequirements(projectDir: string): Uncovered[] {
  const trace = read(path.join(projectDir, "docs", "specs", "traceability.md")) ?? "";
  const catalog = readCatalog(read(path.join(projectDir, "docs", "specs", "use-cases.md"))).filter(
    (c) => !c.template
  );
  const ids = new Set(catalog.map((c) => c.id));
  const listed = new Set(catalog.flatMap((c) => c.requirements));
  const owners = projectIds(projectDir);
  const out = new Map<string, Uncovered>();
  for (const r of parseTraceabilityRows(trace).rows) {
    const req = r.requirement ?? "";
    if (!/^REQ-/.test(req) || req === "REQ-000") continue;
    if (/preserve existing behaviour/i.test(r.useCase ?? "")) continue;
    if (ids.has((r.useCase ?? "").trim()) || listed.has(req)) continue;
    if (!out.has(req)) out.set(req, { id: req, title: "", scenarios: [] });
  }
  const titles = new Map(
    [
      ...(read(path.join(projectDir, "spec.md")) ?? "").matchAll(
        /^\|\s*(REQ-[\w.]+)\s*\|\s*([^|]+?)\s*\|/gm
      ),
    ].map((m) => [m[1], m[2]] as [string, string])
  );
  for (const u of out.values()) {
    u.title = titles.get(u.id) ?? "";
    u.scenarios = [...owners]
      .filter(([id, owner]) => /^SCN-/.test(id) && owner === u.id)
      .map(([id]) => id)
      .sort();
  }
  return [...out.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/** What the agent, or the person, is asked to write (REQ-636). */
export function useCasesGuide(
  changeId: string,
  range: [string, string],
  reqs: readonly Uncovered[]
): string {
  return [
    `# Use cases for the requirements already delivered — ${changeId}`,
    "",
    "Group these requirements by what an actor achieves. Write each use case in",
    "`use-cases.md` under `## ADDED Use Cases` with every requirement that",
    "delivers it, and its specification in `use-cases/UC-NNN.md` — each flow",
    "naming the scenarios that prove it, every scenario of its requirements",
    `named by some flow. Ids from ${range[0]} to ${range[1]}.`,
    "",
    "## The requirements",
    "",
    "| Requirement | Title | Scenarios |",
    "| --- | --- | --- |",
    ...reqs.map((r) => `| ${r.id} | ${r.title || "-"} | ${r.scenarios.join(", ") || "-"} |`),
    "",
    "## use-cases.md",
    "",
    "```markdown",
    "## ADDED Use Cases",
    "",
    "| ID | Use Case | Actor | Requirements |",
    "| --- | --- | --- | --- |",
    `| ${range[0]} | <what the actor achieves> | <an actor of the brief> | ${reqs[0]?.id ?? "REQ-NNN"} |`,
    "```",
    "",
    "## use-cases/UC-NNN.md",
    "",
    "```markdown",
    `# ${range[0]} — <what the actor achieves>`,
    "",
    "## Overview",
    "",
    "## Actors",
    "",
    "## Preconditions",
    "",
    `## Main flow (${reqs[0]?.scenarios[0] ?? "SCN-NNN"})`,
    "",
    "1. <the actor does one thing>",
    "",
    "## Alternative flows",
    "",
    "### A1 — <what goes otherwise> (at step 1) (SCN-NNN)",
    "",
    "## Postconditions",
    "",
    "## Business rules",
    "```",
    "",
    "Write only inside this change's folder. Then run",
    "`specgate propose --use-cases` again to see what is left.",
    "",
  ].join("\n");
}

/** What the change's use cases still lack (REQ-636): the faults REQ-625 and REQ-631 name, and a requirement left out. */
export function useCasesFindings(
  projectDir: string,
  changeDir: string,
  reqs: readonly Uncovered[]
) {
  const delta = parseUseCaseDelta(read(path.join(changeDir, "use-cases.md")) ?? "");
  const catalog = readCatalog(read(path.join(projectDir, "docs", "specs", "use-cases.md")));
  const out = checkUseCaseDelta(delta, catalog).map((f) => ({ ...f, file: "use-cases.md" }));
  const scenarioOf = new Map(reqs.map((r) => [r.id, r.scenarios]));
  for (const u of delta.added) {
    const text = read(path.join(changeDir, "use-cases", `${u.id}.md`));
    if (text === null) {
      out.push({
        code: "ucs_missing",
        message: `${u.id} has no specification.`,
        fix: `Write use-cases/${u.id}.md.`,
        target: u.id,
        file: `use-cases/${u.id}.md`,
      });
      continue;
    }
    const scenarios = new Set(u.requirements.flatMap((q) => scenarioOf.get(q) ?? []));
    for (const f of checkUseCaseSpec(parseUseCaseSpec(text), u.id, scenarios))
      out.push({ ...f, file: `use-cases/${u.id}.md` });
  }
  const covered = new Set(delta.added.flatMap((u) => u.requirements));
  for (const r of reqs) {
    if (!covered.has(r.id))
      out.push({
        code: "uc_requirement_left",
        message: `${r.id} is in no use case.`,
        fix: `List ${r.id} in the use case that delivers it.`,
        target: r.id,
        file: "use-cases.md",
      });
  }
  return out;
}

/** Opens the change, or reads it again; with --agent, has the agent write it first. */
export function proposeUseCases(argv: string[]): void {
  const at = argv.indexOf("--project-dir");
  const projectDir = path.resolve(at >= 0 && argv[at + 1] ? argv[at + 1] : process.cwd());
  const agentAt = argv.indexOf("--agent");
  const agent = agentAt >= 0 ? argv[agentAt + 1] : undefined;
  const json = argv.includes("--json");
  const say = (doc: Record<string, unknown>, text: string, code = 0) => {
    process.stdout.write(json ? `${JSON.stringify(doc, null, 2)}\n` : text);
    process.exitCode = code;
  };
  if (!fs.existsSync(path.join(projectDir, "docs", "specs", "use-cases.md"))) {
    say(
      {
        useCases: null,
        status: [
          {
            severity: "error",
            code: "uc_no_catalog",
            message: "This project keeps no docs/specs/use-cases.md.",
          },
        ],
      },
      "\n  ✖  This project keeps no docs/specs/use-cases.md: it does not model use cases.\n\n",
      1
    );
    return;
  }
  const changeDir = path.join(projectDir, "docs", "specs", "changes", USE_CASES_CHANGE);
  const reqs = uncoveredRequirements(projectDir);
  if (!fs.existsSync(changeDir)) {
    if (reqs.length === 0) {
      say(
        { useCases: { change: null, uncovered: [] }, status: [] },
        "\n  ✔  Every requirement is in a use case of docs/specs/use-cases.md.\n\n"
      );
      return;
    }
    const range = reserveUseCaseRange(projectDir, [
      "REQ-001",
      `REQ-${String(reqs.length).padStart(3, "0")}`,
    ]);
    fs.mkdirSync(path.join(changeDir, "use-cases"), { recursive: true });
    const today = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(
      path.join(changeDir, "change.yaml"),
      `${renderConfig({ specgate_change_version: 1, schema: "spec-driven", created: today, rigor: "lite", skip_specs: true } as never).trimEnd()}\nuc_range: [${range[0]}, ${range[1]}]\n`
    );
    fs.writeFileSync(
      path.join(changeDir, "proposal.md"),
      `# Proposal: ${USE_CASES_CHANGE}\n\nThe use cases of the requirements delivered before the project kept them (#544).\n`
    );
    fs.writeFileSync(
      path.join(changeDir, "tasks.md"),
      "# Tasks\n\n- [ ] 1.1 Review the use cases and their specifications\n"
    );
    fs.writeFileSync(path.join(changeDir, "use-cases.md"), templateUseCases(USE_CASES_CHANGE));
    fs.writeFileSync(
      path.join(changeDir, "USE-CASES.md"),
      useCasesGuide(USE_CASES_CHANGE, range, reqs)
    );
  }
  if (agent) {
    const own = path.relative(projectDir, changeDir).split(path.sep).join("/") + "/";
    const run = runConfinedAgent({
      projectDir,
      changeId: USE_CASES_CHANGE,
      allowed: (rel) => rel.startsWith(own),
      command: withWritePermission(agent).command,
      prompt: read(path.join(changeDir, "USE-CASES.md")) ?? "",
      showOutput: !json,
    });
    if (!run.ok && run.problem === "no_git") {
      say(
        {
          useCases: null,
          status: [
            {
              severity: "error",
              code: "uc_agent_needs_git",
              message: "--agent needs a git repository.",
            },
          ],
        },
        "\n  ✖  --agent needs a git repository.\n\n",
        1
      );
      return;
    }
  }
  const findings = useCasesFindings(projectDir, changeDir, reqs);
  const rel = path.relative(projectDir, changeDir).split(path.sep).join("/");
  say(
    {
      useCases: {
        change: USE_CASES_CHANGE,
        uncovered: reqs.map((r) => r.id),
        ready: findings.length === 0,
      },
      status: findings.map((f) => ({ severity: "error", ...f, file: `${rel}/${f.file}` })),
    },
    findings.length === 0
      ? `\n  ✔  ${rel}: ready to review — then specgate change approve ${USE_CASES_CHANGE} and specgate archive ${USE_CASES_CHANGE}.\n\n`
      : `\n  ${rel}: ${reqs.length} requirement(s) to place in use cases.\n` +
          findings
            .map((f) => `  ✖  ${rel}/${f.file}  ${f.message}  [${f.code}]\n     fix: ${f.fix}\n`)
            .join("") +
          `\n  ➜  write them (USE-CASES.md says how), or: specgate propose --use-cases --agent "<cmd>"\n\n`,
    findings.length === 0 ? 0 : 1
  );
}
