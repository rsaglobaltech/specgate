/**
 * A DDD workshop's boards become the brief's modules (brief-from-workshop
 * REQ-655): the domain model written as a readable file per bounded context
 * under docs/brief/models, and docs/brief.md given — never losing a line it
 * had — each context as a module, the stories' people and systems as actors,
 * and a workshop section naming each context's purpose, questions and model.
 */
import * as fs from "fs";
import * as path from "path";
import {
  domainModelOf,
  modelYamlOf,
  type DomainModel,
  type ModelModule,
} from "../../packages/core/src/domain/DddBoards";

export const MODELS_DIR = path.join("docs", "brief", "models");
export const DEFAULT_BRIEF = path.join("docs", "brief.md");

export interface WorkshopImport {
  /** Every context of the workshop, in the order of its canvases. */
  contexts: string[];
  /** The modules the brief did not have before. */
  added: string[];
  /** The files written, relative to the project. */
  written: string[];
  /** Flows placed in the core context by assumption: confirm them while drafting. */
  assumed: number;
  actors: Array<{ name: string; surface: "web" | "api" }>;
  /** The workshop's language, as the project's `language` now says; null when unknown. */
  language: string | null;
}

const FRONT = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** The people and systems the workshop names: a system on api, anyone else on web. */
function actorsOf(model: DomainModel): WorkshopImport["actors"] {
  const out = new Map<string, "web" | "api">();
  for (const s of model.stories)
    for (const a of s.actorKinds) out.set(a.name, a.kind === "system" ? "api" : "web");
  for (const m of model.modules)
    for (const { flow } of m.flows)
      if (flow.actor && !out.has(flow.actor)) out.set(flow.actor, "web");
  return [...out].map(([name, surface]) => ({ name, surface }));
}

/**
 * A context in the brief's workshop section: its purpose, its questions, its
 * model. Not a `## Module:` card — a card wants rules each with an example
 * (B4), and a workshop gives none; the drafting agent writes them from the model.
 */
function entryOf(m: ModelModule): string {
  const lines = [`### ${m.name} — \`${m.slug}\``, ""];
  if (m.context?.purpose) lines.push(m.context.purpose, "");
  lines.push(`Model: \`${path.posix.join("docs/brief/models", `${m.slug}.yaml`)}\``, "");
  if (m.questions.length) lines.push("Open questions:", ...m.questions.map((q) => `- ${q}`), "");
  return lines.join("\n");
}

const WORKSHOP = "## From the DDD workshop";
const workshopSection = (mods: ModelModule[]) =>
  [
    WORKSHOP,
    "",
    "Each module below is a bounded context of the workshop (DDD Toolbox boards); its",
    "model is the source the drafting agent words, with this brief.",
    "",
    ...mods.map(entryOf),
  ].join("\n");

/** A front matter list, inline (`[a, b]`) or as a block (`  - a`). */
function listOf(fm: string, key: string): string[] {
  const inline = new RegExp(`^${key}:[ \\t]*\\[([^\\]]*)\\]`, "m").exec(fm);
  if (inline)
    return inline[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const block = new RegExp(`^${key}:[ \\t]*\\n((?:[ \\t]+-[^\\n]*\\n?)+)`, "m").exec(fm);
  return block
    ? block[1]
        .split("\n")
        .map((l) => l.replace(/^[ \t]+-[ \t]*/, "").trim())
        .filter(Boolean)
    : [];
}

/** A front matter list written inline, in place of the one it had (or added at the end). */
function setList(fm: string, key: string, items: string[]): string {
  const line = `${key}: [${items.join(", ")}]`;
  const inline = new RegExp(`^${key}:[ \\t]*\\[[^\\]]*\\][^\\n]*$`, "m");
  if (inline.test(fm)) return fm.replace(inline, line);
  const block = new RegExp(`^${key}:[ \\t]*\\n(?:[ \\t]+-[^\\n]*\\n?)+`, "m");
  if (block.test(fm)) return fm.replace(block, `${line}\n`);
  return `${fm.replace(/\s*$/, "")}\n${line}`;
}

/** The brief merged: new modules, actors and surfaces added; every line it had kept. */
export function mergeBrief(
  brief: string | null,
  model: DomainModel,
  actors: WorkshopImport["actors"]
): { text: string; added: string[] } {
  const slugs = model.modules.map((m) => m.slug);
  const core =
    model.modules.find((m) => m.context?.classification.domain === "core") ?? model.modules[0];
  const actorLine = (a: { name: string; surface: string }) =>
    `  - { name: ${a.name}, surfaces: [${a.surface}] }`;
  if (!brief || !FRONT.test(brief)) {
    const surfaces = [...new Set(actors.map((a) => a.surface))].sort();
    const fm = [
      "---",
      `product: ${core?.name ?? "Product"}`,
      `surfaces: [${surfaces.join(", ") || "web"}]`,
      "actors:",
      ...actors.map(actorLine),
      `modules: [${slugs.join(", ")}]`,
      "---",
      "",
    ].join("\n");
    const body = [
      `# ${core?.name ?? "Product"}`,
      "",
      ...(brief ? [brief.trimEnd(), ""] : []),
      workshopSection(model.modules),
    ].join("\n");
    return { text: fm + body, added: slugs };
  }
  const m = FRONT.exec(brief)!;
  let fm = m[1];
  const had = listOf(fm, "modules");
  const added = slugs.filter((s) => !had.includes(s));
  fm = setList(fm, "modules", [...had, ...added]);
  const surfaces = listOf(fm, "surfaces");
  const more = [...new Set(actors.map((a) => a.surface))].filter((s) => !surfaces.includes(s));
  if (more.length) fm = setList(fm, "surfaces", [...surfaces, ...more]);
  // Actors: each new one added after the last actor line, in the brief's own form.
  const known = new Set(
    [...fm.matchAll(/name:\s*([^,}\n]+)/g)].map((x) => x[1].trim().toLowerCase())
  );
  const newActors = actors.filter((a) => !known.has(a.name.toLowerCase()));
  if (newActors.length) {
    const block = /^actors:[ \t]*\n((?:(?:[ \t]+-[^\n]*|[ \t]*#[^\n]*)\n?)+)/m.exec(fm);
    if (block) {
      const end = block.index + block[0].length;
      const sep = block[0].endsWith("\n") ? "" : "\n";
      fm = fm.slice(0, end) + sep + newActors.map(actorLine).join("\n") + "\n" + fm.slice(end);
      fm = fm.replace(/\n{2,}(?=\S)/g, "\n");
    } else fm = `${fm.replace(/\s*$/, "")}\nactors:\n${newActors.map(actorLine).join("\n")}`;
  }
  const rest = brief.slice(m[0].length);
  const fresh = model.modules.filter((x) => added.includes(x.slug));
  const body = rest.replace(/\s*$/, "");
  // New contexts join the workshop section, or start it at the end of the brief.
  const at = body.indexOf(WORKSHOP);
  const text =
    `---\n${fm.replace(/\s*$/, "")}\n---\n` +
    (fresh.length === 0
      ? `${body}\n`
      : at < 0
        ? `${body}\n\n${workshopSection(fresh)}`
        : `${body}\n\n${fresh.map(entryOf).join("\n")}`);
  return { text, added };
}

const CONFIG = path.join(".specgate", "config.json");

/** The project's `language` (config.json), or null when none is set. */
export function projectLanguage(projectDir: string): string | null {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(projectDir, CONFIG), "utf8")) as {
      language?: unknown;
    };
    return typeof c.language === "string" && c.language ? c.language : null;
  } catch {
    return null;
  }
}

/** The language a workshop's words are in: Spanish or English, by their common words. */
export function languageOf(text: string): string | null {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  const count = (set: string[]) => words.filter((w) => set.includes(w)).length;
  const es =
    count([
      "el",
      "la",
      "los",
      "las",
      "de",
      "del",
      "que",
      "se",
      "un",
      "una",
      "por",
      "con",
      "para",
      "siempre",
      "cada",
    ]) + (/[ñ¿¡]/.test(text) ? 5 : 0);
  const en = count([
    "the",
    "of",
    "and",
    "to",
    "a",
    "an",
    "is",
    "are",
    "for",
    "with",
    "whenever",
    "each",
  ]);
  if (es + en < 5) return null;
  return es > en ? "es" : "en";
}

/** The workshop's boards read, its models written, the brief merged. */
export function importWorkshop(
  projectDir: string,
  files: readonly string[],
  briefRel = DEFAULT_BRIEF
): WorkshopImport {
  const boards = [...new Set(files.map((f) => path.resolve(projectDir, f)))].map((f) => {
    const text = fs.readFileSync(f, "utf8");
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error(
        `${path.relative(projectDir, f)} is not a board exported by DDD Toolbox: it is not JSON.`
      );
    }
  });
  const model = domainModelOf(boards);
  if (model.modules.every((m) => !m.context && !m.flows.length && !m.stories.length))
    throw new Error("No story, Event Storming or Bounded Context Canvas in these files.");
  const written: string[] = [];
  const dir = path.join(projectDir, MODELS_DIR);
  fs.mkdirSync(dir, { recursive: true });
  for (const m of model.modules) {
    const rel = path.join(MODELS_DIR, `${m.slug}.yaml`);
    fs.writeFileSync(path.join(projectDir, rel), modelYamlOf(m), "utf8");
    written.push(rel.split(path.sep).join("/"));
  }
  const actors = actorsOf(model);
  // The workshop's language becomes the project's, when it had none (REQ-655).
  let language = projectLanguage(projectDir);
  if (!language) {
    language = languageOf(model.modules.map((m) => modelYamlOf(m)).join("\n"));
    if (language) {
      const file = path.join(projectDir, CONFIG);
      let config: Record<string, unknown> = {};
      try {
        config = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
      } catch {
        // none yet
      }
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ ...config, language }, null, 2) + "\n", "utf8");
      written.push(CONFIG.split(path.sep).join("/"));
    }
  }
  const briefPath = path.join(projectDir, briefRel);
  const before = fs.existsSync(briefPath) ? fs.readFileSync(briefPath, "utf8") : null;
  const { text, added } = mergeBrief(before, model, actors);
  fs.mkdirSync(path.dirname(briefPath), { recursive: true });
  fs.writeFileSync(briefPath, text, "utf8");
  written.push(briefRel.split(path.sep).join("/"));
  return {
    contexts: model.modules.map((m) => m.slug),
    added,
    written,
    assumed: model.modules.reduce(
      (n, m) => n + m.flows.filter((f) => f.by === "assumed").length,
      0
    ),
    actors,
    language,
  };
}

/** How many flows a module's model holds (REQ-656). */
export function modelFlows(projectDir: string, module: string): number {
  const rel = modelOf(projectDir, module);
  if (!rel) return 0;
  const text = fs.readFileSync(path.join(projectDir, rel), "utf8");
  return (text.match(/^ {2}- (command|policy):/gm) ?? []).length;
}

/** The text of every model of the workshop: values stated there count as stated (REQ-656). */
export function modelsText(projectDir: string): string {
  const dir = path.join(projectDir, MODELS_DIR);
  if (!fs.existsSync(dir)) return "";
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((f) => fs.readFileSync(path.join(dir, f), "utf8"))
    .join("\n");
}

/** The model of a module, relative to the project, when the workshop gave it one. */
export function modelOf(projectDir: string, module: string): string | null {
  const rel = path.posix.join("docs/brief/models", `${module}.yaml`);
  return fs.existsSync(path.join(projectDir, rel)) ? rel : null;
}
