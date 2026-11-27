/**
 * One page for a change's evidence (ADR-0047, REQ-807):
 * `docs/specs/changes/<change>/EVIDENCE.md`, each requirement before its code
 * and after it — the last screenshot of each test side by side, copied beside
 * the page under a size cap, its diagrams, and where its videos and traces
 * are. Written the same way every time: no clock, everything sorted.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { EVIDENCE_DIR } from "./evidence";
import { requirementDiagrams } from "./evidence-diagrams";

/** A picture larger than this is named on the page, not copied into the repository. */
export const MAX_PICTURE_BYTES = 300 * 1024;
const PICTURE = /\.(png|jpe?g|webp|gif)$/i;
const MEDIA = /\.(webm|mp4|zip)$/i;

export interface PageRequirement {
  id: string;
  title: string;
  before: boolean;
  after: boolean;
  screenshots: number;
  sequences: number;
  classes: number;
}

/** The requirements a change's deltas add or modify, in the order they are written. */
function requirementsOf(changeDir: string): Array<{ id: string; title: string }> {
  const out: Array<{ id: string; title: string }> = [];
  const specs = path.join(changeDir, "specs");
  let caps: string[] = [];
  try {
    caps = fs.readdirSync(specs).sort();
  } catch {
    return out;
  }
  for (const cap of caps) {
    let text = "";
    try {
      text = fs.readFileSync(path.join(specs, cap, "spec.md"), "utf8");
    } catch {
      continue;
    }
    for (const m of text.matchAll(/^#{2,4}\s+Requirement:\s*(REQ-[\w.]+)\s*[—–-]\s*(.+)$/gm)) {
      if (!out.some((r) => r.id === m[1])) out.push({ id: m[1], title: m[2].trim() });
    }
  }
  return out;
}

function readJson(file: string): { artifacts?: string[] } | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** `artifacts/[<workspace>/]<test>/<file>` → the test's folder, the runner's one per test. */
const testOf = (artifact: string) => artifact.split("/").slice(-2)[0] || "-";

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * A test's folder as a reader names it: the scenario it ran, when the folder
 * ends with that scenario's title — Playwright cuts the start of the title
 * and adds its file, a hash and the project — or the folder without them.
 */
function testLabel(folder: string, titles: string[]): string {
  const rest = folder.replace(/^.*?-[0-9a-f]{5}-+/, "");
  const found = titles
    .filter((t) => slug(t).length > 0 && slug(rest).includes(slug(t).slice(-24)))
    .sort((a, b) => b.length - a.length)[0];
  return found || rest.replace(/-/g, " ");
}

/** The last picture of each test, by its folder. */
function lastPictures(artifacts: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const a of [...artifacts].sort()) if (PICTURE.test(a)) out.set(testOf(a), a);
  return out;
}

const code = (p: string) => `\`${p}\``;

/**
 * Writes the page. `base` is the ref its diagrams compare with (REQ-814);
 * empty, the base `check --affected` uses.
 */
export function writeEvidencePage(
  projectDir: string,
  changeId: string,
  base = ""
): { file: string; requirements: PageRequirement[] } {
  const changeDir = path.join(projectDir, "docs", "specs", "changes", changeId);
  const copies = path.join(changeDir, "evidence");
  fs.rmSync(copies, { recursive: true, force: true });
  const lines = [
    `# Evidence — ${changeId}`,
    "",
    `> Written by \`specgate evidence ${changeId}\` (ADR-0047): each requirement before its code and after it.`,
    "> The screens are the last screenshot of each test; videos and traces stay in `.specgate/evidence/`, out of git.",
    "",
  ];
  const summary: PageRequirement[] = [];

  for (const { id, title } of requirementsOf(changeDir)) {
    const root = path.join(projectDir, EVIDENCE_DIR, id);
    const before = readJson(path.join(root, "before", "run.json"));
    const after = readJson(path.join(root, "evidence.json"));
    const sides = [
      { name: "before", doc: before, from: `${EVIDENCE_DIR}/${id}/before` },
      { name: "after", doc: after, from: `${EVIDENCE_DIR}/${id}` },
    ];
    lines.push(`## ${id} — ${title}`, "");
    const d = requirementDiagrams(projectDir, id, base);

    // Screens: a row per test, its last picture on each side.
    const pictures = sides.map((s) => lastPictures(s.doc?.artifacts || []));
    const tests = [...new Set(pictures.flatMap((p) => [...p.keys()]))].sort();
    const tooBig: string[] = [];
    let copied = 0;
    const cell = (i: number, test: string) => {
      const a = pictures[i].get(test);
      if (!a) return "—";
      const source = path.join(projectDir, sides[i].from, a);
      let size = Infinity;
      try {
        size = fs.statSync(source).size;
      } catch {
        return "—";
      }
      const shown = `${sides[i].from}/${a}`;
      if (size > MAX_PICTURE_BYTES) {
        tooBig.push(shown);
        return `${code(path.basename(a))} (over 300 KB)`;
      }
      const rel = `evidence/${id}/${sides[i].name}/${a.replace(/^artifacts\//, "")}`;
      fs.mkdirSync(path.dirname(path.join(changeDir, rel)), { recursive: true });
      fs.copyFileSync(source, path.join(changeDir, rel));
      copied += 1;
      return `![${sides[i].name}](${rel})`;
    };
    if (tests.length) {
      lines.push("| Test | Before | After |", "| --- | --- | --- |");
      const titles = d.sequences.map((s) => s.scenario);
      for (const t of tests) lines.push(`| ${testLabel(t, titles)} | ${cell(0, t)} | ${cell(1, t)} |`);
      lines.push("");
    }
    for (const s of sides) {
      for (const a of (s.doc?.artifacts || []).filter((x) => PICTURE.test(x)).sort()) {
        const shown = `${s.from}/${a}`;
        if (tooBig.includes(shown)) continue;
        try {
          if (fs.statSync(path.join(projectDir, shown)).size > MAX_PICTURE_BYTES)
            tooBig.push(shown);
        } catch {
          /* gone since the run */
        }
      }
    }

    const notes: string[] = [];
    for (const p of tooBig.sort()) notes.push(`- ${code(p)} — over 300 KB, not copied`);
    const media = sides.flatMap((s) =>
      (s.doc?.artifacts || []).filter((a) => MEDIA.test(a)).map((a) => code(`${s.from}/${a}`))
    );
    if (media.length) notes.push(`- Video and traces: ${media.sort().join(", ")}`);
    if (!before) notes.push(`- No before: \`specgate evidence before ${id}\``);
    if (!after) notes.push(`- Not delivered yet: \`specgate apply ${id}\``);
    if ((before || after) && tests.length === 0)
      notes.push("- No screenshots: `specgate doctor` says how to have the runner keep them");
    if (notes.length) lines.push(...notes, "");

    // Diagrams: each scenario, then the code, now — and the base folded under it.
    const fence = (text: string) => ["```mermaid", text.trimEnd(), "```"];
    const folded = (label: string, text: string) => [
      `<details><summary>${label}</summary>`,
      "",
      ...fence(text),
      "",
      "</details>",
    ];
    for (const s of d.sequences) {
      lines.push(`### ${s.scenario}`, "");
      if (s.after) lines.push(...fence(s.after), "");
      if (s.before === null) lines.push("New since the base.", "");
      else if (s.after === null) lines.push(...folded("Removed — at the base", s.before), "");
      else if (s.before === s.after) lines.push("Unchanged since the base.", "");
      else lines.push(...folded("At the base", s.before), "");
    }
    for (const c of d.classes) {
      lines.push(`### Classes — ${c.file}`, "", ...fence(c.after), "");
      if (c.legend) lines.push(c.legend, "");
      if (c.before !== null) lines.push(...folded("At the base", c.before), "");
      else lines.push("New since the base.", "");
    }

    summary.push({
      id,
      title,
      before: before !== null,
      after: after !== null,
      screenshots: copied,
      sequences: d.sequences.length,
      classes: d.classes.length,
    });
  }

  const file = path.join(changeDir, "EVIDENCE.md");
  fs.writeFileSync(file, lines.join("\n").trimEnd() + "\n", "utf8");
  return {
    file: path.relative(projectDir, file).split(path.sep).join("/"),
    requirements: summary,
  };
}
