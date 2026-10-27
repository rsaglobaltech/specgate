import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { briefModules } from "../../packages/core/src/domain/DraftChecklist";
import { listChangeIds } from "../../packages/core/src/infrastructure/ChangeWorkspace";
import { findCliRoot } from "./project-root";

/**
 * `specgate brief add <module> "<text>"` (REQ-192): a new requirement for a
 * module the brief already covers, archived or not, starts from the brief.
 */

export type BriefAddOutcome =
  | { ok: true; change: string; requirement: string; created: boolean; delta: string }
  | { ok: false; code: string; message: string; fix: string };

function briefFile(projectDir: string): string | null {
  for (const rel of [path.join("docs", "brief.md"), "brief.md"]) {
    const file = path.join(projectDir, rel);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

function rangeOf(changeDir: string): [number, number] | null {
  try {
    const yaml = fs.readFileSync(path.join(changeDir, "change.yaml"), "utf8");
    const m = /req_range:\s*\[\s*REQ-(\d+)\s*,\s*REQ-(\d+)\s*\]/.exec(yaml);
    return m ? [Number(m[1]), Number(m[2])] : null;
  } catch {
    return null;
  }
}

function idsIn(changeDir: string): Set<number> {
  const used = new Set<number>();
  const walk = (dir: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".md")) {
        for (const m of fs.readFileSync(full, "utf8").matchAll(/###\s+Requirement:\s+REQ-(\d+)/g)) {
          used.add(Number(m[1]));
        }
      }
    }
  };
  walk(path.join(changeDir, "specs"));
  return used;
}

const pad = (n: number) => `REQ-${String(n).padStart(3, "0")}`;

/** The block `brief add` writes: a requirement whose title and statement are the author's to write. */
function block(id: string, text: string): string {
  return [
    `### Requirement: ${id} — <a short name>`,
    "",
    "The system SHALL <what it does, from the brief line below>.",
    "",
    `> Brief: "${text.replace(/"/g, "'")}"`,
    "",
    "<!-- specgate:trace status=Draft kind=functional -->",
    "",
  ].join("\n");
}

function addToDelta(file: string, capability: string, req: string): void {
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `# Delta — ${capability}\n\n## ADDED Requirements\n\n${req}`, "utf8");
    return;
  }
  const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const at = text.indexOf("## ADDED Requirements");
  if (at === -1) {
    fs.writeFileSync(
      file,
      `${text.replace(/\n*$/, "\n")}\n## ADDED Requirements\n\n${req}`,
      "utf8"
    );
    return;
  }
  const after = text.slice(at + 3);
  const next = after.search(/^## /m);
  const end = next === -1 ? text.length : at + 3 + next;
  const before = text.slice(0, end).replace(/\n*$/, "\n\n");
  fs.writeFileSync(file, `${before}${req}${next === -1 ? "" : `\n${text.slice(end)}`}`, "utf8");
}

export function briefAdd(
  projectDir: string,
  module: string,
  text: string,
  today: string
): BriefAddOutcome {
  const brief = briefFile(projectDir);
  if (!brief) {
    return {
      ok: false,
      code: "brief_not_found",
      message: "No brief: neither docs/brief.md nor brief.md exists.",
      fix: "Write the brief first; specgate draft explains what it needs.",
    };
  }
  const modules = briefModules(fs.readFileSync(brief, "utf8"));
  if (!modules.includes(module)) {
    return {
      ok: false,
      code: "brief_module_unknown",
      message: `The brief lists no module "${module}". Its modules: ${modules.join(", ") || "none"}.`,
      fix: "Use one of them, or add the module to the brief's front matter.",
    };
  }

  const open = listChangeIds(projectDir);
  let change = [`draft-${module}`, `${module}-additions`].find((c) => open.includes(c));
  let created = false;
  if (!change) {
    change = `${module}-additions`;
    const r = spawnSync(
      process.execPath,
      [
        path.join(findCliRoot(__dirname), "bin", "specgate.js"),
        "change",
        "new",
        change,
        "--reserve",
        "3",
        "--project-dir",
        projectDir,
        "--json",
      ],
      { cwd: projectDir, encoding: "utf8" }
    );
    if (r.status !== 0) {
      return {
        ok: false,
        code: "brief_change_not_created",
        message: `Could not create ${change}: ${(r.stdout + r.stderr).trim().split("\n").pop()}`,
        fix: `specgate change new ${change}`,
      };
    }
    created = true;
  }

  const dir = path.join(projectDir, "docs", "specs", "changes", change);
  const range = rangeOf(dir);
  const used = idsIn(dir);
  let id: number | null = null;
  if (range) {
    for (let n = range[0]; n <= range[1]; n += 1) {
      if (!used.has(n)) {
        id = n;
        break;
      }
    }
  }
  if (id === null) {
    return {
      ok: false,
      code: "brief_range_used_up",
      message: `${change} has no free id left in its range${range ? ` ${pad(range[0])}…${pad(range[1])}` : ""}.`,
      fix: `Grow it with specgate draft --reserve <n> when it is the last open draft, or open another change.`,
    };
  }

  const delta = path.join(dir, "specs", module, "spec.md");
  addToDelta(delta, module, block(pad(id), text));
  const raw = fs.readFileSync(brief, "utf8");
  const line = `- ${module} (${today}): ${text}`;
  fs.writeFileSync(
    brief,
    /^## Additions\s*$/m.test(raw)
      ? `${raw.replace(/\n*$/, "\n")}${line}\n`
      : `${raw.replace(/\n*$/, "\n")}\n## Additions\n\n${line}\n`,
    "utf8"
  );
  return {
    ok: true,
    change,
    requirement: pad(id),
    created,
    delta: path.relative(projectDir, delta).split(path.sep).join("/"),
  };
}
