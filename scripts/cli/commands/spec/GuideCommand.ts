import * as fs from "node:fs";
import * as path from "node:path";
import { error } from "../../../lib/diagnostics";
import { agentIo, wantsJson } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";
import * as ui from "../../../lib/ui";
import { resolveProjectDir } from "../../../lib/project-root";
import { readCapabilityRequirements } from "../../../lib/capability-specs";
import { requirementsIn } from "../../../../packages/core/src/domain/DerivedMatrix";
import { extractRequirementSection } from "../../../../packages/core/src/domain/SpecSections";
import { parseTraceabilityRows } from "../../../../packages/core/src/domain/TraceabilityFormat";
import {
  GUIDE_DIR,
  actorSlug,
  deliveredActors,
  renderGuide,
  type GuideRequirement,
} from "../../../../packages/core/src/domain/UserGuide";

const NULL_SHAPE = { guide: null };

function usage(): void {
  process.stdout.write(
    "Usage:\n  specgate guide [--actor <name>] [--project-dir <path>] [--json]\n\n" +
      "Writes docs/guide/<actor>.md for each actor a delivered requirement names — or the\n" +
      "one named — with a section per delivered requirement, ordered by capability: its\n" +
      "text, and its scenarios as numbered steps. Draft work is left out.\n\n" +
      "Exit 0 done · 2 usage error.\n"
  );
}

const read = (dir: string, rel: string) => {
  try {
    return fs.readFileSync(path.join(dir, rel), "utf8");
  } catch {
    return "";
  }
};

/** A requirement's prose: no heading, no trace comment. */
const prose = (section: string) =>
  section
    .split("\n")
    .slice(1)
    .filter((l) => !l.trim().startsWith("<!--"))
    .join("\n")
    .trim();

/** Scenarios in feature files tagged with each requirement: title and steps. */
function taggedScenarios(dir: string) {
  const out = new Map<string, Array<{ title: string; steps: string[] }>>();
  const walk = (rel: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const child = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(child);
      else if (e.name.endsWith(".feature")) {
        let tags: string[] = [];
        let current: { title: string; steps: string[] } | null = null;
        for (const raw of read(dir, child).split(/\r?\n/)) {
          const line = raw.trim();
          if (line.startsWith("@")) {
            tags = line.split(/\s+/);
            continue;
          }
          const sc = /^Scenario(?: Outline)?:\s*(.*)$/.exec(line);
          if (sc) {
            current = { title: sc[1], steps: [] };
            for (const t of tags.filter((x) => /^@REQ-\d+$/.test(x))) {
              const id = t.slice(1);
              out.set(id, [...(out.get(id) || []), current]);
            }
            tags = [];
            continue;
          }
          if (current && /^(Given|When|Then|And|But)\b/.test(line)) current.steps.push(line);
        }
      }
    }
  };
  walk("features");
  return out;
}

/** Every requirement with an actor, from spec.md and the capability specs. */
function guideRequirements(dir: string): GuideRequirement[] {
  const rows = new Map<string, string>();
  try {
    for (const row of parseTraceabilityRows(read(dir, "docs/specs/traceability.md")).rows || []) {
      const r = row as { requirement?: string; status?: string };
      if (r.requirement) rows.set(String(r.requirement).trim(), String(r.status || "").trim());
    }
  } catch {
    // No readable matrix: traces decide.
  }
  const out: GuideRequirement[] = [];
  const spec = read(dir, "spec.md");
  const scenarios = taggedScenarios(dir);
  for (const r of requirementsIn(spec)) {
    if (!r.trace.actor) continue;
    out.push({
      id: r.id,
      title: r.title,
      capability: "General",
      actor: r.trace.actor,
      status: r.trace.status || rows.get(r.id) || "",
      text: prose(extractRequirementSection(spec, r.id) || ""),
      scenarios: scenarios.get(r.id) || [],
    });
  }
  for (const c of readCapabilityRequirements(dir)) {
    const trace = (c.req.trace || {}) as Record<string, string>;
    if (!c.req.id || !trace.actor) continue;
    out.push({
      id: c.req.id,
      title: c.req.name.replace(/^REQ-\d+\s*[—:-]\s*/, "").trim(),
      capability: c.capability,
      actor: trace.actor,
      status: trace.status || rows.get(c.req.id) || "",
      text: Array.isArray(c.req.text) ? c.req.text.join("\n") : c.req.text,
      scenarios: c.req.scenarios.map((s) => ({ title: s.name || s.heading, steps: s.steps })),
    });
  }
  return out;
}

/** `specgate guide` (REQ-544). */
export class GuideCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args[0] === "guide" ? this.args.slice(1) : this.args;
    if (argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(0);
    }
    const io = agentIo(wantsJson(argv));
    let dirArg = ".";
    let actor = "";
    for (let i = 0; i < argv.length; i += 1) {
      const a = argv[i];
      if (a === "--project-dir") dirArg = argv[++i] || ".";
      else if (a === "--actor") actor = (argv[++i] || "").trim();
      else if (a === "--json") continue;
      else {
        io.usage(NULL_SHAPE, [
          error("unknown_argument", `Unknown argument for guide: ${a}`, {
            fix: "specgate guide --help",
          }),
        ]);
      }
    }
    let projectDir: string;
    try {
      projectDir = resolveProjectDir(dirArg);
    } catch {
      projectDir = path.resolve(dirArg);
    }
    const reqs = guideRequirements(projectDir);
    const actors = actor ? [actor] : deliveredActors(reqs);
    const written = actors.map((a) => {
      const rel = `${GUIDE_DIR}/${actorSlug(a)}.md`;
      const file = path.join(projectDir, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, renderGuide(a, reqs), "utf8");
      return { actor: a, path: rel };
    });
    io.emit({ guide: { written } }, () => {
      process.stdout.write(ui.header("guide", actor || "every actor"));
      if (written.length === 0) {
        process.stdout.write(
          ui.info("No delivered requirement names an actor yet: nothing to write.") + "\n"
        );
      }
      for (const w of written) process.stdout.write(ui.fileLine("added", w.path, w.actor));
      process.stdout.write("\n");
    });
  }
}
