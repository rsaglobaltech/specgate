/**
 * sealed-acceptance: a change's acceptance tests as part of its approved
 * contract. Someone other than the agent that implements the change writes
 * them, in the project's own test language, and lists each in the change's
 * `acceptance-tests.md` with the scenarios it proves; a person approves them and the
 * approval seals each file by its hash (REQ-757). A sealed file that changes
 * fails the gate (REQ-758); the gate runs them with the project's own
 * `acceptance_cmd` (REQ-759); the guard keeps the agent's tools off them, and
 * the outside judge reads their hashes (REQ-760).
 *
 * Specgate reads no test: it says who may write the oracle.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { parseYamlLite } from "../../packages/core/src/domain/YamlLite";
import type { Identity } from "../../packages/core/src/domain/Approvals";
import { error, warning, type Diagnostic } from "./diagnostics";
import { changeApprovals, gitIdentity, APPROVALS_FILE } from "./approvals";
import { levelOf, readGatePolicy } from "./gate-policy";
import { forShell } from "./shell-command";

export const ACCEPTANCE_LAYER = "acceptance";
export const ACCEPTANCE_FILE = "acceptance-tests.md";

export interface AcceptanceRecord {
  layer: typeof ACCEPTANCE_LAYER;
  role: "tester";
  /** Each sealed test, relative to the project with `/` → its sha256. */
  seals: Record<string, string>;
  by: Identity;
  at: string;
}

export interface AcceptanceLine {
  path: string;
  scenarios: string[];
  /** The line as written, for a refusal that names it. */
  text: string;
}

const changeDir = (projectDir: string, id: string) =>
  path.join(projectDir, "docs", "specs", "changes", id);

function read(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/** A file's hash as the seal keeps it: line endings do not count. */
export const fileHash = (text: string): string =>
  `sha256:${createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex")}`;

const norm = (p: string) => p.replace(/\\/g, "/").replace(/^\.\//, "");

/** The lines of a change's `acceptance-tests.md`: `- <path> — SCN-…[, SCN-…]`; null when it has none. */
export function acceptanceList(projectDir: string, id: string): AcceptanceLine[] | null {
  const text = read(path.join(changeDir(projectDir, id), ACCEPTANCE_FILE));
  if (text === null) return null;
  const out: AcceptanceLine[] = [];
  for (const line of text.split(/\r?\n/)) {
    // The bullet is optional: a writer may leave it out. The line is a path — it has a `/` or a `.` — then the scenarios.
    const m = /^\s*(?:[-*]\s+)?`?([^\s`]+)`?\s+(?:—|–|--|-|:)\s+(.+)$/.exec(line);
    if (!m || !/[/.]/.test(m[1]!) || !/SCN-/.test(m[2]!)) continue;
    out.push({ path: norm(m[1]!), scenarios: m[2]!.match(/SCN-[\w-]+/g) || [], text: line.trim() });
  }
  return out;
}

/** The scenarios the change's deltas declare. */
function changeScenarios(projectDir: string, id: string): Set<string> {
  const dir = path.join(changeDir(projectDir, id), "specs");
  const out = new Set<string>();
  let caps: string[] = [];
  try {
    caps = fs.readdirSync(dir);
  } catch {
    return out;
  }
  for (const cap of caps) {
    const text = read(path.join(dir, cap, "spec.md")) || "";
    for (const m of text.matchAll(/^#{3,5}\s+Scenario:\s*(SCN-[\w-]+)/gm)) out.add(m[1]!);
  }
  return out;
}

function records(projectDir: string, id: string): Array<Record<string, unknown>> {
  const text = read(path.join(changeDir(projectDir, id), APPROVALS_FILE));
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** The last acceptance approval of a change, or null when none sealed its tests. */
export function readAcceptanceSeals(projectDir: string, id: string): AcceptanceRecord | null {
  const found = records(projectDir, id).filter((r) => r.layer === ACCEPTANCE_LAYER);
  const last = found[found.length - 1] as unknown as AcceptanceRecord | undefined;
  return last && last.seals && typeof last.seals === "object" ? last : null;
}

/** The open changes' ids, the archive left out. */
function openIds(projectDir: string): string[] {
  try {
    return fs
      .readdirSync(path.join(projectDir, "docs", "specs", "changes"), { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== "archive")
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

/** The archived changes, oldest first: their folders start with the date. */
function archivedIds(projectDir: string): string[] {
  try {
    return fs
      .readdirSync(path.join(projectDir, "docs", "specs", "changes", "archive"), {
        withFileTypes: true,
      })
      .filter((e) => e.isDirectory())
      .map((e) => `archive/${e.name}`)
      .sort();
  } catch {
    return [];
  }
}

/**
 * Every sealed acceptance test, with the change that sealed it last and its
 * seal: archived changes first, oldest to newest, then the open ones — a
 * newer seal of the same file replaces an older one. A test sealed by a
 * change that is now archived stays sealed (sealed-acceptance, 2026-11-26).
 */
export function sealedAcceptance(
  projectDir: string
): Array<{ change: string; file: string; hash: string; archived: boolean }> {
  const byFile = new Map<
    string,
    { change: string; file: string; hash: string; archived: boolean }
  >();
  for (const change of [...archivedIds(projectDir), ...openIds(projectDir)]) {
    const archived = change.startsWith("archive/");
    for (const [file, hash] of Object.entries(
      readAcceptanceSeals(projectDir, change)?.seals || {}
    )) {
      byFile.set(file, { change, file, hash, archived });
    }
  }
  return [...byFile.values()];
}

/** The sealed tests of archived changes that differ from their seal or are gone. */
export function archivedAcceptanceDiagnostics(projectDir: string): {
  errors: Diagnostic[];
  warnings: Diagnostic[];
} {
  const found: Diagnostic[] = [];
  for (const t of sealedAcceptance(projectDir).filter((x) => x.archived)) {
    const text = read(path.join(projectDir, t.file));
    if (text !== null && fileHash(text) === t.hash) continue;
    const what = text === null ? "is gone" : "is not what was approved";
    found.push(
      error(
        "acceptance_not_sealed",
        `${t.file}, an acceptance test a person approved and sealed (${t.change.replace(/^archive\//, "")}), ${what}. Restore it (git checkout -- ${t.file}), or open a change that lists it in its acceptance-tests.md and have a person approve it.`,
        {
          target: t.file,
          fix: `git checkout -- ${t.file} — or specgate propose <change-id>, list it in acceptance-tests.md, and a person: specgate change approve <change-id> --layer acceptance`,
        }
      )
    );
  }
  return split(found, ruleLevel(projectDir));
}

export type SealOutcome =
  | { ok: true; change: string; sealed: string[] }
  | { ok: false; code: string; message: string; fix?: string };

/**
 * REQ-757: a person approves the change's acceptance tests: each line of its
 * `acceptance-tests.md` names a file that is there and a scenario of the change; the
 * change itself is approved. Recorded as one more line of `approvals.json`.
 */
export function sealAcceptance(
  projectDir: string,
  id: string,
  today: string,
  who: Identity = gitIdentity(projectDir)
): SealOutcome {
  if (!fs.existsSync(changeDir(projectDir, id))) {
    return { ok: false, code: "change_not_found", message: `No open change ${id}.` };
  }
  const where = `docs/specs/changes/${id}/${ACCEPTANCE_FILE}`;
  const list = acceptanceList(projectDir, id);
  if (!list || list.length === 0) {
    return {
      ok: false,
      code: "acceptance_not_listed",
      message: `${id} lists no acceptance test: ${where} has no line \`- <path> — SCN-…\`.`,
      fix: `Have the tests written by someone other than the agent that implements ${id}, list each in ${where} with the scenarios it proves, then approve them.`,
    };
  }
  if (!changeApprovals(projectDir, id).approved) {
    return {
      ok: false,
      code: "acceptance_change_not_approved",
      message: `${id} is not approved yet: its acceptance tests prove an approved contract, so the change is approved first.`,
      fix: `specgate change approve ${id}, then specgate change approve ${id} --layer acceptance.`,
    };
  }
  const known = changeScenarios(projectDir, id);
  const seals: Record<string, string> = {};
  for (const line of list) {
    const abs = path.resolve(projectDir, line.path);
    const rel = path.relative(projectDir, abs);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      return {
        ok: false,
        code: "acceptance_file_outside",
        message: `${line.path} is outside the project: ${line.text}`,
      };
    }
    const text = read(abs);
    if (text === null) {
      return {
        ok: false,
        code: "acceptance_file_missing",
        message: `${line.path} is listed in ${where} and is not there.`,
        fix: `Write ${line.path}, or take its line out of ${where}.`,
      };
    }
    const unknown = line.scenarios.filter((s) => !known.has(s));
    if (line.scenarios.length === 0 || unknown.length > 0) {
      return {
        ok: false,
        code: "acceptance_unknown_scenario",
        message: line.scenarios.length
          ? `${line.text} — ${unknown.join(", ")} is not a scenario of ${id}.`
          : `${line.text} — it names no scenario of ${id}.`,
        fix: `Each line names the scenarios of ${id} the test proves: ${[...known].join(", ") || "its delta has none yet"}.`,
      };
    }
    seals[norm(rel)] = fileHash(text);
  }
  const all = records(projectDir, id);
  all.push({ layer: ACCEPTANCE_LAYER, role: "tester", seals, by: who, at: today });
  fs.writeFileSync(
    path.join(changeDir(projectDir, id), APPROVALS_FILE),
    `${JSON.stringify(all, null, 2)}\n`,
    "utf8"
  );
  return { ok: true, change: id, sealed: Object.keys(seals) };
}

/** The gate's rule `acceptance`, as the policy says; `error` where the policy cannot be read. */
function ruleLevel(projectDir: string): "error" | "warning" | "off" {
  try {
    return levelOf(readGatePolicy(projectDir), "acceptance");
  } catch {
    return "error";
  }
}

const split = (found: Diagnostic[], level: string) =>
  level === "off"
    ? { errors: [], warnings: [] }
    : level === "error"
      ? { errors: found, warnings: [] }
      : {
          errors: [],
          warnings: found.map((d) =>
            warning(d.code, d.message, {
              ...(d.target ? { target: d.target } : {}),
              ...(d.fix ? { fix: d.fix } : {}),
            })
          ),
        };

/** REQ-758: each sealed acceptance test of the change that differs from its seal or is gone. */
export function acceptanceSealDiagnostics(
  projectDir: string,
  id: string
): { errors: Diagnostic[]; warnings: Diagnostic[] } {
  const record = readAcceptanceSeals(projectDir, id);
  if (!record) return { errors: [], warnings: [] };
  const found: Diagnostic[] = [];
  for (const [file, hash] of Object.entries(record.seals)) {
    const text = read(path.join(projectDir, file));
    if (text !== null && fileHash(text) === hash) continue;
    const what = text === null ? "is gone" : "is not what was approved";
    found.push(
      error(
        "acceptance_not_sealed",
        `${file}, an acceptance test of ${id} a person approved, ${what}. Restore it (git checkout -- ${file}), or have a person approve the new version: specgate change approve ${id} --layer acceptance.`,
        {
          target: file,
          fix: `git checkout -- ${file} — or a person: specgate change approve ${id} --layer acceptance`,
        }
      )
    );
  }
  return split(found, ruleLevel(projectDir));
}

/** `acceptance_cmd` of `harness.config.yaml`, or "". */
export function acceptanceCommand(projectDir: string): string {
  const text = read(path.join(projectDir, "harness.config.yaml"));
  if (!text) return "";
  try {
    const parsed = parseYamlLite(text) as Record<string, unknown> | null;
    const v = parsed && typeof parsed === "object" ? parsed.acceptance_cmd : undefined;
    return v === undefined || v === null ? "" : String(v).trim();
  } catch {
    return "";
  }
}

export interface AcceptanceVerdict {
  /** Whether there were sealed tests to run. */
  ran: boolean;
  command: string;
  ms: number | null;
  errors: Diagnostic[];
  warnings: Diagnostic[];
}

/** A path as one word of a shell command. */
const quote = (p: string) => (/^[\w./@+-]+$/.test(p) ? p : `"${p.replace(/(["\\$`])/g, "\\$1")}"`);

/**
 * REQ-759: the sealed acceptance tests of every open change, run with the
 * project's own command — `{files}` the sealed paths. Specgate installs
 * nothing and reads no output but the exit code.
 */
export function acceptanceRun(projectDir: string): AcceptanceVerdict {
  const sealed = sealedAcceptance(projectDir);
  const level = ruleLevel(projectDir);
  const none: AcceptanceVerdict = { ran: false, command: "", ms: null, errors: [], warnings: [] };
  if (sealed.length === 0 || level === "off") return none;
  // A sealed test of an archived change is still the contract.
  const archived = archivedAcceptanceDiagnostics(projectDir);
  if (archived.errors.length)
    return { ...none, errors: archived.errors, warnings: archived.warnings };
  const files = [...new Set(sealed.map((s) => s.file))];
  const cmd = acceptanceCommand(projectDir);
  if (!cmd) {
    return {
      ...none,
      ...split(
        [
          error(
            "acceptance_no_command",
            `${files.length} acceptance test(s) are sealed and the project names no command that runs them.`,
            {
              target: "acceptance",
              fix: 'specgate config set acceptance_cmd "<the command that runs them, {files} the sealed paths>" — mvn -q verify -Dit.test=… · npx playwright test {files} · pytest {files}',
            }
          ),
        ],
        level
      ),
    };
  }
  const command = cmd.includes("{files}")
    ? cmd.split("{files}").join(files.map(quote).join(" "))
    : cmd;
  const started = Date.now();
  const run = spawnSync(forShell(command), {
    cwd: projectDir,
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  const ms = Date.now() - started;
  if (run.status === 0) return { ran: true, command, ms, errors: [], warnings: [] };
  const output = `${run.stdout || ""}${run.stderr || ""}`.trim().split("\n").slice(-30).join("\n");
  return {
    ran: true,
    command,
    ms,
    ...split(
      [
        error(
          "acceptance_red",
          `The approved acceptance tests did not pass — ran ${command}${output ? `:\n${output}` : ""}`,
          {
            target: "acceptance",
            fix: "Make the code do what the approved tests say: the tests are the contract, not the thing to change.",
          }
        ),
      ],
      level
    ),
  };
}

/**
 * guard-scope-and-seal-run REQ-794: the tests just sealed, run once with the
 * project's command, for the person who sealed them to read. Before the code
 * exists they are expected to fail — but for the code, not for a path that
 * leads nowhere. Null when no command is set.
 */
export function firstAcceptanceRun(
  projectDir: string,
  files: string[]
): { command: string; passed: boolean; output: string } | null {
  const cmd = acceptanceCommand(projectDir);
  if (!cmd || files.length === 0) return null;
  const command = cmd.includes("{files}")
    ? cmd.split("{files}").join(files.map(quote).join(" "))
    : cmd;
  const run = spawnSync(forShell(command), {
    cwd: projectDir,
    encoding: "utf8",
    shell: true,
    timeout: 300_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const lines = `${run.stdout || ""}${run.stderr || ""}`.trim().split("\n");
  // The lines that say why — an error, a failure, a missing file — rather than a stack's tail.
  const why = lines.filter(
    (l) => /error|fail|cannot|not found|no such|✖|assert/i.test(l) && !/^\s+at\s/.test(l)
  );
  const output = (why.length ? why.slice(0, 10) : lines.slice(-15)).join("\n");
  return { command, passed: run.status === 0, output };
}
