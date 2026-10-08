/**
 * OpenSpec, read in place (ADR-0030).
 *
 *   openspec/specs/<capability>/spec.md               the current specification
 *   openspec/changes/<change>/specs/<capability>/spec.md   a change's delta
 *   openspec/changes/<change>/tasks.md                 its task list
 *   openspec/changes/archive/<date>-<change>/…          a change that shipped
 *
 * ```markdown
 * ### Requirement: Path configuration for supported tools
 * The `AI_TOOLS` array SHALL include `skillsDir` …
 * #### Scenario: Claude Code paths defined
 * - **WHEN** looking up the `claude` tool
 * - **THEN** `skillsDir` SHALL be `.claude`
 * ```
 *
 * OpenSpec names requirements and scenarios; it numbers neither. The id is
 * built from the names: `openspec:<capability>/<slug(requirement)>/<slug(scenario)>`,
 * where a nested capability keeps its path (`time-attendance/clock-punches`).
 *
 * Its claim of done is the archive: a change moved under `changes/archive/`
 * has been applied to the specification, and every requirement its delta
 * ADDED or MODIFIED is claimed. What it owes is judged against the scenarios
 * the current specification holds for that requirement — the archive records
 * what changed then; the specification is what holds now.
 *
 * An active change with every task ticked is a claim too, but OpenSpec itself
 * has not called it finished until it is archived, so it is reported, not
 * gated.
 */

import {
  type ForeignClaim,
  type ForeignCriterion,
  type ForeignRequirement,
  type ForeignSpec,
  type ReadProblem,
  type SourceText,
  slug,
} from "./ForeignSpec";

const ROOT = "openspec/";
// A capability may be nested — `specs/time-attendance/clock-punches/spec.md`
// (OpenSpec 1.14). Reading one level only skipped those files silently, which
// is the one thing this reader must never do; found by the verify pilot.
const MAIN_SPEC = /^openspec\/specs\/(.+)\/spec\.md$/;
const DELTA_SPEC = /^openspec\/changes\/(archive\/)?([^/]+)\/specs\/(.+)\/spec\.md$/;
const TASKS = /^openspec\/changes\/(archive\/)?([^/]+)\/tasks\.md$/;

const REQUIREMENT = /^###\s+Requirement:\s*(.+?)\s*$/;
const SCENARIO = /^####\s+Scenario:\s*(.+?)\s*$/;
const DELTA_SECTION = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\b/i;
const FENCE = /^\s*(```|~~~)/;

interface Block {
  name: string;
  line: number;
  body: string[];
  scenarios: Array<{ name: string; line: number; body: string[] }>;
}

/** The requirements of one spec file, with the delta section each sits in. */
function requirementBlocks(source: string): Array<Block & { section: string }> {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: Array<Block & { section: string }> = [];
  let section = "";
  let fenced = false;
  let req: (Block & { section: string }) | null = null;
  let scn: Block["scenarios"][number] | null = null;
  lines.forEach((text, i) => {
    if (FENCE.test(text)) fenced = !fenced;
    if (fenced) {
      (scn ? scn.body : req ? req.body : []).push(text);
      return;
    }
    const sec = DELTA_SECTION.exec(text);
    if (sec) {
      section = sec[1].toUpperCase();
      req = null;
      scn = null;
      return;
    }
    const r = REQUIREMENT.exec(text);
    if (r) {
      req = { name: r[1], line: i + 1, body: [], scenarios: [], section };
      scn = null;
      out.push(req);
      return;
    }
    const s = SCENARIO.exec(text);
    if (s && req) {
      scn = { name: s[1], line: i + 1, body: [] };
      req.scenarios.push(scn);
      return;
    }
    // Any other heading at level 1–3 closes the requirement.
    if (/^#{1,3}\s/.test(text)) {
      req = null;
      scn = null;
      return;
    }
    (scn ? scn.body : req ? req.body : []).push(text);
  });
  return out;
}

function toRequirement(capability: string, file: string, block: Block): ForeignRequirement {
  const requirementId = `openspec:${capability}/${slug(block.name)}`;
  const seen = new Map<string, number>();
  const criteria: ForeignCriterion[] = block.scenarios.map((s) => {
    const base = slug(s.name);
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return {
      id: `${requirementId}/${n === 1 ? base : `${base}-${n}`}`,
      requirementId,
      title: s.name,
      text: [s.name, ...s.body].join("\n").trim(),
      file,
      line: s.line,
    };
  });
  return { id: requirementId, title: block.name, file, line: block.line, criteria };
}

/** Every task line, and whether it is ticked. */
function tasksIn(source: string): Array<{ done: boolean }> {
  return source
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => /^\s*[-*]\s+\[([ xX])\]\s+/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ done: m[1].toLowerCase() === "x" }));
}

export function isOpenSpecProject(paths: readonly string[]): boolean {
  return paths.some((p) => MAIN_SPEC.test(p) || DELTA_SPEC.test(p));
}

export function readOpenSpec(files: readonly SourceText[]): ForeignSpec {
  const problems: ReadProblem[] = [];
  const requirements: ForeignRequirement[] = [];
  const byId = new Map<string, ForeignRequirement>();

  for (const f of files) {
    const m = MAIN_SPEC.exec(f.path);
    if (!m) continue;
    const blocks = requirementBlocks(f.source);
    if (blocks.length === 0) {
      problems.push({
        file: f.path,
        line: 1,
        message: "no `### Requirement:` heading found — the file does not read as an OpenSpec spec",
      });
      continue;
    }
    for (const b of blocks) {
      const req = toRequirement(m[1], f.path, b);
      requirements.push(req);
      byId.set(req.id, req);
    }
  }

  // One claim per change: its deltas, plus its task list.
  interface Change {
    archived: boolean;
    name: string;
    deltas: Array<{ capability: string; file: string; blocks: Array<Block & { section: string }> }>;
    tasks: Array<{ done: boolean }> | null;
    tasksFile: string;
    dir: string;
  }
  const changes = new Map<string, Change>();
  const changeFor = (archived: boolean, name: string): Change => {
    const key = `${archived ? "archive/" : ""}${name}`;
    let c = changes.get(key);
    if (!c) {
      const dir = `${ROOT}changes/${key}`;
      c = { archived, name, deltas: [], tasks: null, tasksFile: `${dir}/tasks.md`, dir };
      changes.set(key, c);
    }
    return c;
  };
  for (const f of files) {
    const d = DELTA_SPEC.exec(f.path);
    if (d) {
      let blocks = requirementBlocks(f.source);
      if (blocks.length > 0 && !blocks.some((b) => b.section)) {
        // Before delta-based changes (OpenSpec, August 2025) a change carried
        // the capability's whole future spec. Every requirement in it is what
        // the change delivered — read as ADDED, not as an unreadable delta.
        blocks = blocks.map((b) => ({ ...b, section: "ADDED" }));
      } else if (
        blocks.length === 0 &&
        !d[1] &&
        !/^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\b/im.test(f.source)
      ) {
        // Archived history older than OpenSpec's structured format (free-form
        // "## Core Requirements" prose, 2025) has nothing to verify and is not
        // the project's current state; only a change in flight is an error.
        problems.push({
          file: f.path,
          line: 1,
          message:
            "no `### Requirement:` and no `## ADDED|MODIFIED|REMOVED|RENAMED Requirements` section — the file does not read as an OpenSpec delta",
        });
      }
      changeFor(Boolean(d[1]), d[2]).deltas.push({ capability: d[3], file: f.path, blocks });
      continue;
    }
    const t = TASKS.exec(f.path);
    if (t) changeFor(Boolean(t[1]), t[2]).tasks = tasksIn(f.source);
  }

  const claims: ForeignClaim[] = [];
  for (const c of [...changes.values()].sort((a, b) => a.dir.localeCompare(b.dir))) {
    const allTicked = Boolean(c.tasks && c.tasks.length > 0 && c.tasks.every((t) => t.done));
    if (!c.archived && !allTicked) continue; // work in progress claims nothing
    const criteria = new Set<string>();
    const unresolved: Array<{ ref: string; why: string }> = [];
    let first: { file: string; line: number } | null = null;
    for (const delta of c.deltas) {
      for (const b of delta.blocks) {
        if (b.section !== "ADDED" && b.section !== "MODIFIED") continue;
        first = first || { file: delta.file, line: b.line };
        const id = `openspec:${delta.capability}/${slug(b.name)}`;
        // Shipped: judged against the current spec. In flight: the delta is
        // the only text there is.
        const req = c.archived ? byId.get(id) : toRequirement(delta.capability, delta.file, b);
        if (!req) {
          unresolved.push({
            ref: id,
            why: `"${b.name}" is not in openspec/specs/${delta.capability}/spec.md — removed or renamed since`,
          });
          continue;
        }
        for (const k of req.criteria) criteria.add(k.id);
      }
    }
    claims.push({
      label: `${c.archived ? "archived change" : "change, every task ticked"} ${c.name}`,
      file: first ? first.file : c.tasksFile,
      line: first ? first.line : 1,
      finished: c.archived,
      criteria: [...criteria],
      unresolved,
      datedBy: c.dir,
    });
  }

  return { format: "openspec", requirements, claims, problems };
}
