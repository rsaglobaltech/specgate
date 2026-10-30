/**
 * The project's interface contracts and the requirements that cite them
 * (REQ-335, REQ-336).
 *
 * A contract is an OpenAPI or AsyncAPI document anywhere in the project, or
 * any file an `api=` reference names. A reference is read off the
 * `specgate:trace` comment of a requirement in spec.md or a capability spec.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  contractKind,
  contractOperations,
  parseApiRef,
  resolveApiRef,
  type ApiOperation,
} from "../../packages/core/src/domain/ApiContract";
import { parseTraceComment } from "../../packages/core/src/domain/SpecParser";
import { DELIVERED_STATUS } from "../../packages/core/src/domain/TraceabilityFormat";
import { CAPABILITIES_DIR } from "../../packages/core/src/infrastructure/ChangeWorkspace";
import { error, warning, type Diagnostic } from "./diagnostics";

export interface ApiCitation {
  requirement: string;
  ref: string;
  /** The `status=` of the requirement's trace, when it says one. */
  status?: string;
}

const SKIP = new Set([
  ".git",
  "node_modules",
  "dist",
  "target",
  "build",
  ".next",
  "coverage",
  ".harness",
]);
const CANDIDATE = /\.(ya?ml|json)$/i;

/** Every requirement's `api=` references, from spec.md and the capability specs. */
export function apiCitations(projectDir: string): ApiCitation[] {
  const files = [path.join(projectDir, "spec.md")];
  const caps = path.join(projectDir, CAPABILITIES_DIR);
  if (fs.existsSync(caps)) {
    for (const e of fs.readdirSync(caps, { withFileTypes: true })) {
      if (e.isDirectory()) files.push(path.join(caps, e.name, "spec.md"));
    }
  }
  const out: ApiCitation[] = [];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    let requirement = "";
    const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const h = /^#{2,4}\s+(?:Requirement:\s*)?(REQ-\d+)\b/.exec(lines[i]);
      if (h) {
        requirement = h[1];
        continue;
      }
      if (!requirement || !/<!--\s*specgate:trace\b/.test(lines[i])) continue;
      let comment = lines[i];
      while (!comment.includes("-->") && i + 1 < lines.length) comment += `\n${lines[++i]}`;
      const trace = parseTraceComment(comment);
      const api = trace.api;
      if (!api) continue;
      for (const ref of api
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)) {
        out.push({ requirement, ref, ...(trace.status ? { status: trace.status } : {}) });
      }
    }
  }
  return out;
}

/** The contracts: every OpenAPI/AsyncAPI file found, plus those cited by path. */
export function projectContracts(
  projectDir: string,
  cited: ApiCitation[] = apiCitations(projectDir)
): Record<string, ApiOperation[]> {
  const found: Record<string, ApiOperation[]> = {};
  const read = (rel: string) => {
    const abs = path.join(projectDir, rel);
    let text: string;
    try {
      text = fs.readFileSync(abs, "utf8");
    } catch {
      return;
    }
    if (!contractKind(text)) return;
    found[rel.replace(/\\/g, "/")] = contractOperations(text, rel);
  };
  const walk = (rel: string, depth: number) => {
    if (depth > 6) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(path.join(projectDir, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (SKIP.has(e.name) || e.name.startsWith(".")) continue;
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p, depth + 1);
      else if (CANDIDATE.test(e.name) && /openapi|asyncapi|swagger|contract|api/i.test(p)) read(p);
    }
  };
  walk("", 0);
  for (const c of cited) {
    const { file } = parseApiRef(c.ref);
    const norm = file.replace(/\\/g, "/").replace(/^\.\//, "");
    if (norm && !found[norm] && fs.existsSync(path.join(projectDir, norm))) read(norm);
  }
  return found;
}

export interface ApiCheckOptions {
  /** `--delivering REQ-NNN`: held to its citations as a delivered requirement. */
  delivering?: string;
  /** A requirement's status as the matrix gives it, when its trace says none. */
  statusOf?: (requirement: string) => string | undefined;
}

/**
 * `validate`'s findings: each reference that does not resolve (REQ-335).
 *
 * REQ-385: only a delivered requirement — or the one being delivered — owes a
 * citation that resolves. A contracts repository writes its contract one
 * requirement at a time, and its later operations' files do not exist yet:
 * failing on them refused its first requirement (truck-flote, MS4-2). A
 * pending one is a warning, the same code, saying when it becomes an error.
 */
export function apiReferenceProblems(projectDir: string, opts: ApiCheckOptions = {}): Diagnostic[] {
  const cited = apiCitations(projectDir);
  if (cited.length === 0) return [];
  const contracts = projectContracts(projectDir, cited);
  const owed = (c: ApiCitation) => {
    if (opts.delivering && c.requirement === opts.delivering) return true;
    const statuses = [c.status, opts.statusOf ? opts.statusOf(c.requirement) : undefined];
    return statuses.some((s) => DELIVERED_STATUS.has(String(s || "").trim()));
  };
  const problems: Diagnostic[] = [];
  for (const c of cited) {
    const r = resolveApiRef(c.ref, contracts);
    if (r.ok) continue;
    const held = owed(c);
    const raise = held ? error : warning;
    const later = held ? "" : " It must resolve once it is delivered.";
    problems.push(
      r.reason === "contract_missing"
        ? raise(
            "api_contract_missing",
            `${c.requirement} cites api=${c.ref}, and ${r.file} is not a contract in this project.${later}`,
            {
              target: c.requirement,
              fix: `Correct the path in ${c.requirement}'s specgate:trace comment, or add the contract.`,
            }
          )
        : raise(
            "api_operation_missing",
            `${c.requirement} cites api=${c.ref}, which is not an operation of ${r.file || "any contract in this project"}.${later}`,
            {
              target: c.requirement,
              fix: `Correct the operation in ${c.requirement}'s specgate:trace comment, or add it to the contract.`,
            }
          )
    );
  }
  return problems;
}

export interface ContractReport {
  contracts: Array<{
    file: string;
    kind: string;
    operations: number;
    cited: string[];
    uncited: string[];
  }>;
}

/** `specgate contract check` (REQ-336). */
export function contractReport(projectDir: string): {
  report: ContractReport;
  status: Diagnostic[];
} {
  const cited = apiCitations(projectDir);
  const contracts = projectContracts(projectDir, cited);
  const status: Diagnostic[] = apiReferenceProblems(projectDir);
  const citedBy = new Map<string, string[]>();
  for (const c of cited) {
    const r = resolveApiRef(c.ref, contracts);
    if (!r.ok) continue;
    const key = `${r.file}#${r.operation.pointer}`;
    citedBy.set(key, [...(citedBy.get(key) || []), c.requirement]);
  }
  const report: ContractReport = { contracts: [] };
  for (const [file, ops] of Object.entries(contracts).sort(([a], [b]) => a.localeCompare(b))) {
    const entry = {
      file,
      kind: ops[0]?.kind || "",
      operations: ops.length,
      cited: [] as string[],
      uncited: [] as string[],
    };
    for (const op of ops) {
      const by = citedBy.get(`${file}#${op.pointer}`);
      if (by) entry.cited.push(`${op.label} — ${[...new Set(by)].join(", ")}`);
      else {
        entry.uncited.push(op.label);
        status.push(
          warning("api_operation_uncited", `${file}: ${op.label} is cited by no requirement.`, {
            target: op.operationId || op.pointer,
            fix: `Specify it: a requirement whose specgate:trace says api=${file}#${op.operationId || op.pointer}.`,
          })
        );
      }
    }
    report.contracts.push(entry);
  }
  return { report, status };
}
