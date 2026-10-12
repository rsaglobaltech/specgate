import * as fs from "node:fs";
import * as path from "node:path";
import { BaseCommand } from "../../../lib/command";
import { parseGherkin } from "../../../../packages/core/src/domain/Gherkin";
import * as ui from "../../../lib/ui";

function logError(msg: string) {
  process.stderr.write(ui.fail(msg));
}

export interface InferPackOptions {
  /** The first source, kept so existing callers and tests still read one path. */
  from: string | null;
  /** Every `--from`, in order. A directory expands to the files inside it. */
  sources: string[];
  format: string;
}

function usage() {
  process.stdout.write(
    "Usage:\n" +
      "  specgate pack infer --from <feature-file> [--format yaml|json]\n\n" +
      "Reads a Gherkin .feature file and prints a proposed pack.yaml fragment\n" +
      "(requirements, use_cases, commands, events, scenarios) to stdout. The\n" +
      "output is a heuristic skeleton — review every TODO before merging.\n\n" +
      "Options:\n" +
      "  --from <path>     Gherkin .feature file, or a directory of them.\n" +
      "                    Repeat for several: one fragment is inferred from all\n" +
      "                    of them together, so a command shared by three files\n" +
      "                    is proposed once rather than three times.\n" +
      "  --format <fmt>    Output format: yaml (default) or json\n"
  );
}

export function parseArgs(argv: string[]) {
  const opts: InferPackOptions = { from: null, sources: [], format: "yaml" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--from" && argv[i + 1]) {
      // Repeatable: a capability is rarely one file, and inferring per file
      // proposes the same command once per file, each with its own id.
      const value = argv[++i];
      opts.sources.push(value);
      opts.from = opts.from ?? value;
    } else if (a === "--format" && argv[i + 1]) {
      opts.format = argv[++i];
    } else if (a === "--help" || a === "-h") {
      usage();
      process.exit(0);
    }
  }
  if (!["yaml", "json"].includes(opts.format)) {
    logError(`Invalid --format: ${opts.format}. Expected: yaml | json.`);
    process.exit(2);
  }
  return opts;
}

/**
 * What `pack infer` reads out of a `.feature` file.
 *
 * Delegates to `parseGherkin`, the one reader in this repository (F1). It used
 * to carry its own regular expressions — one of three sets that disagreed with
 * each other — and matched case-insensitively, so it would have reported steps
 * for a file Cucumber reads as prose.
 *
 * The shape is kept as it was so the rest of this command is untouched.
 */
export function parseFeatureFile(content: string) {
  const doc = parseGherkin(content);
  return {
    featureName: doc.feature ?? "",
    featureTags: [...doc.featureTags],
    scenarios: doc.scenarios.map((scenario) => ({
      title: scenario.name,
      tags: [...scenario.tags],
      steps: scenario.steps.map((step) => ({ keyword: step.keyword, text: step.text })),
    })),
  };
}

function pad(n: number) {
  return String(n).padStart(3, "0");
}

/**
 * Words that carry no meaning in a name.
 *
 * Gherkin is written as prose — "the user submits the form for a new order" —
 * and a name built from every word is `TheUserSubmitsThe`. Dropping the glue
 * leaves `UserSubmitsForm`, which is the name a person would have written.
 *
 * Deliberately short. A long stopword list starts removing domain words that
 * happen to be common, and a name missing its noun is worse than a long one.
 */
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "for",
  "to",
  "in",
  "on",
  "at",
  "by",
  "with",
  "from",
  "into",
  "that",
  "this",
  "then",
  "when",
  "is",
  "are",
  "be",
  "has",
  "have",
  "it",
  "its",
  "as",
  "so",
  "if",
]);

/**
 * Strip `<placeholder>` tokens, repeatedly until nothing changes.
 *
 * One pass leaves a nested or malformed token behind — `<<a>b>` becomes `<b>` —
 * which CodeQL reports as `js/incomplete-multi-character-sanitization`. Nothing
 * here reaches a browser, but a half-stripped step would still produce a wrong
 * command name, and `build-site.ts` strips tags the same way for the same
 * reason.
 */
function stripPlaceholders(text: string): string {
  let out = String(text);
  let previous;
  do {
    previous = out;
    out = out.replace(/<[^<>]*>/g, " ");
  } while (out !== previous);
  return out;
}

export function toPascalCase(text: string) {
  const words = stripPlaceholders(text.replace(/"[^"]*"/g, ""))
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !/^\d+$/.test(w))
    .filter((w) => !STOPWORDS.has(w.toLowerCase()))
    .slice(0, 4);
  if (words.length === 0) return "Action";
  return words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("");
}

/**
 * Does this `When` read the system, or change it?
 *
 * The pack model already separates the two — commands and `QRY-*` ids — and
 * inference did not, so every query arrived proposed as a command and had to be
 * corrected by hand. The verb is the only signal a heuristic has, and it is a
 * good one: "views", "searches", "lists" are not writes in any domain.
 *
 * Wrong sometimes, like everything here. The output keeps its `TODO` and is a
 * skeleton to review (ADR-0014).
 */
const QUERY_VERBS =
  /\b(views?|sees?|reads?|lists?|searches|filters?|browses?|gets?|fetch(es)?|queries|requests? the|opens?|checks?)\b/i;

export function isQueryStep(text: string): boolean {
  return QUERY_VERBS.test(String(text || ""));
}

/**
 * Field names a step mentions, as a starting point for a payload.
 *
 * Two sources, both explicit in the Gherkin rather than guessed from prose:
 * `<placeholders>` from a Scenario Outline, and `key: value` or `key = value`
 * pairs. Quoted literals are values, not names, so they are not fields.
 *
 * The least certain of the five inferences, which is why every field it
 * proposes carries `TODO` for its type.
 */
export function extractPayloadHints(text: string): string[] {
  const found = new Set<string>();
  for (const m of String(text || "").matchAll(/<([A-Za-z][\w ]*)>/g)) {
    found.add(m[1].trim().replace(/\s+/g, "_").toLowerCase());
  }
  for (const m of String(text || "").matchAll(/\b([a-z][\w]*)\s*[:=]\s*(?:"|\d)/gi)) {
    found.add(m[1].toLowerCase());
  }
  return [...found];
}

export function collectRequirementIds(parsed: any) {
  const ids = new Set<string>();
  const scan = (tags: string[]) => {
    for (const tag of tags || []) {
      const m = String(tag).match(/REQ-\d+/i);
      if (m) ids.add(m[0].toUpperCase());
    }
  };
  scan(parsed.featureTags);
  for (const scn of parsed.scenarios) scan(scn.tags);
  return [...ids];
}

export function extractEventNames(text: string) {
  const out: string[] = [];
  const re = /"([A-Z][A-Za-z0-9]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

export function inferModel(parsed: any, sourceFile: string) {
  const reqIds = collectRequirementIds(parsed);
  const requirements =
    reqIds.length > 0
      ? reqIds.map((id) => ({ id, title: `TODO: describe ${id}` }))
      : [
          {
            id: "REQ-XXX",
            title: `TODO: requirement behind "${parsed.featureName || sourceFile}"`,
          },
        ];
  const primaryReq = requirements[0].id;

  const useCase: any = {
    id: "UC-XXX",
    name: parsed.featureName || "TODO: name the use case",
    requirement: primaryReq,
    command: "TODO: command",
    aggregate: "TODO: aggregate",
    emits: [],
  };

  const commands: any[] = [];
  const queries: any[] = [];
  const events: any[] = [];
  const scenarios: any[] = [];
  let ci = 1;
  let qi = 1;
  let ei = 1;
  let si = 1;

  for (const scn of parsed.scenarios) {
    const scnId = `SCN-${pad(si++)}`;

    const whenStep = scn.steps.find((s: any) => s.keyword === "when");
    let operationName: string | null = null;
    let isQuery = false;

    if (whenStep) {
      isQuery = isQueryStep(whenStep.text);
      operationName = `${toPascalCase(whenStep.text)}${isQuery ? "Query" : "Command"}`;
      const bucket = isQuery ? queries : commands;

      // Deduplicated by name. Two scenarios exercising the same operation —
      // the happy path and its failure — used to produce two identical entries
      // with different ids, which was the most common thing a reader deleted
      // by hand.
      const existing = bucket.find((c) => c.name === operationName);
      if (existing) {
        // A second scenario usually mentions fields the first did not.
        for (const field of extractPayloadHints(whenStep.text)) {
          if (!existing.fields.some((f: any) => f.name === field)) {
            existing.fields.push({ name: field, type: "TODO: type" });
          }
        }
      } else {
        bucket.push({
          id: isQuery ? `QRY-${pad(qi++)}` : `CMD-${pad(ci++)}`,
          name: operationName,
          fields: extractPayloadHints(whenStep.text).map((name) => ({
            name,
            type: "TODO: type",
          })),
        });
      }
    }

    const eventNames: string[] = [];
    for (const step of scn.steps.filter((s: any) => s.keyword === "then")) {
      for (const name of extractEventNames(step.text)) {
        if (!events.some((e) => e.name === name)) {
          events.push({ id: `EVT-${pad(ei++)}`, name });
        }
        if (!eventNames.includes(name)) eventNames.push(name);
      }
    }

    scenarios.push({
      id: scnId,
      title: scn.title,
      use_case: useCase.id,
      // The key still says `command` for a query, because that is what the
      // matrix column is called. Renaming it here would be a format change
      // wearing an inference's clothes.
      command: operationName || "TODO: command",
      events: eventNames,
    });
  }

  if (commands.length > 0) useCase.command = commands[0].name;
  else if (queries.length > 0) useCase.command = queries[0].name;
  useCase.emits = [...new Set(events.map((e) => e.name))];

  return {
    requirements,
    use_cases: [useCase],
    commands,
    queries,
    events,
    scenarios,
    __file: sourceFile,
  };
}

/**
 * One model from several feature files.
 *
 * A capability is rarely one file, and inferring per file loses what they
 * share: the same command appears in three of them and is proposed three
 * times, each with its own id. Merging by name is the same rule the per-file
 * dedup uses, applied one level up.
 *
 * Requirement ids are unioned; the placeholder `REQ-XXX` only survives when no
 * file named a real one, so one tagged file rescues the whole set.
 */
export function mergeModels(models: any[], sourceFiles: string[]) {
  if (models.length === 1) return models[0];

  const merged: any = {
    requirements: [],
    use_cases: [],
    commands: [],
    queries: [],
    events: [],
    scenarios: [],
  };

  const byName = (list: any[], entry: any) => list.find((e) => e.name === entry.name);
  let si = 1;

  for (const model of models) {
    for (const req of model.requirements) {
      if (req.id === "REQ-XXX") continue;
      if (!merged.requirements.some((r: any) => r.id === req.id)) merged.requirements.push(req);
    }
    for (const key of ["commands", "queries", "events"]) {
      for (const entry of model[key] || []) {
        const existing = byName(merged[key], entry);
        if (!existing) {
          merged[key].push({ ...entry });
          continue;
        }
        for (const field of entry.fields || []) {
          if (!(existing.fields || []).some((f: any) => f.name === field.name)) {
            existing.fields = [...(existing.fields || []), field];
          }
        }
      }
    }
    // `__file` is bookkeeping for the renumbering below and never rendered:
    // two files may both carry `UC-XXX`, so the name alone cannot say which
    // use case a scenario belonged to.
    for (const scn of model.scenarios) {
      merged.scenarios.push({ ...scn, id: `SCN-${pad(si++)}`, __file: model.__file });
    }
    for (const uc of model.use_cases) {
      if (!merged.use_cases.some((u: any) => u.name === uc.name)) {
        merged.use_cases.push({ ...uc, __file: model.__file });
      }
    }
  }

  // Ids are renumbered so the fragment reads as one document rather than as
  // three concatenated ones with three CMD-001s.
  const renumber = (list: any[], prefix: string) =>
    list.forEach((entry, i) => {
      entry.id = `${prefix}-${pad(i + 1)}`;
    });
  renumber(merged.commands, "CMD");
  renumber(merged.queries, "QRY");
  renumber(merged.events, "EVT");

  if (merged.requirements.length === 0) {
    merged.requirements.push({
      id: "REQ-XXX",
      title: `TODO: requirement behind ${sourceFiles.length} feature file(s)`,
    });
  }

  // Each use case keeps the requirement its own file tagged. Overwriting them
  // all with the first file's would be an inference nobody made, and it would
  // read as a fact rather than as the placeholder it is.
  for (const uc of merged.use_cases) {
    if (!merged.requirements.some((r: any) => r.id === uc.requirement)) {
      uc.requirement = merged.requirements[0].id;
    }
  }

  // A single file keeps `UC-XXX`, which is honest: nothing inferred an id.
  // Several files cannot, because two `UC-XXX` entries in one fragment is not
  // a placeholder, it is invalid YAML semantics a reader has to repair.
  if (merged.use_cases.length > 1) {
    merged.use_cases.forEach((uc: any, i: number) => {
      const from = uc.id;
      uc.id = `UC-${pad(i + 1)}`;
      for (const scn of merged.scenarios) {
        if (scn.use_case === from && scn.__file === uc.__file) scn.use_case = uc.id;
      }
    });
  }
  for (const list of [merged.use_cases, merged.scenarios]) {
    for (const entry of list) delete entry.__file;
  }
  return merged;
}

function yamlScalar(value: any) {
  const s = String(value);
  if (s === "") return '""';
  if (/^[A-Za-z0-9_][A-Za-z0-9_ .\-/]*$/.test(s) && !/:\s/.test(s) && !s.includes(": ")) {
    if (/^(true|false|null|yes|no|~|\d+(\.\d+)?)$/i.test(s)) return `"${s}"`;
    return s;
  }
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function renderYamlFragment(model: any, sourceFile: string) {
  const out = [
    `# Proposed pack.yaml fragment inferred from ${sourceFile}`,
    `# Heuristic skeleton — review and resolve every TODO before merging.`,
    "",
    "requirements:",
  ];
  for (const r of model.requirements) {
    out.push(`  - id: ${yamlScalar(r.id)}`);
    out.push(`    title: ${yamlScalar(r.title)}`);
  }
  out.push("");
  out.push("use_cases:");
  for (const u of model.use_cases) {
    out.push(`  - id: ${yamlScalar(u.id)}`);
    out.push(`    name: ${yamlScalar(u.name)}`);
    out.push(`    requirement: ${yamlScalar(u.requirement)}`);
    out.push(`    command: ${yamlScalar(u.command)}`);
    out.push(`    aggregate: ${yamlScalar(u.aggregate)}`);
    if (u.emits.length === 0) {
      out.push(`    emits: []`);
    } else {
      out.push(`    emits:`);
      for (const e of u.emits) out.push(`      - ${yamlScalar(e)}`);
    }
  }
  out.push("");
  // Commands and queries render the same way; the pack model separates them and
  // so does this, because a query proposed as a command is a correction every
  // reader had to make by hand.
  const renderOperations = (label: string, list: any[]) => {
    // `label: []` on one line. The project's YAML reader rejects a bare `[]`
    // on the line below the key, and an empty `commands:` could always produce
    // one — it just never had an empty list to render until queries arrived.
    if (!list || list.length === 0) {
      out.push(`${label}: []`);
      return;
    }
    out.push(`${label}:`);
    for (const c of list) {
      out.push(`  - id: ${yamlScalar(c.id)}`);
      out.push(`    name: ${yamlScalar(c.name)}`);
      if (c.fields && c.fields.length > 0) {
        // Field *names* come from the Gherkin — placeholders and `key: value`
        // pairs — and never the types. A guessed type that looked confident
        // would be the failure ADR-0014 names: an inference that stops looking
        // like a guess.
        out.push(`    fields:`);
        for (const f of c.fields) {
          out.push(`      - name: ${yamlScalar(f.name)}`);
          out.push(`        type: ${yamlScalar(f.type)}`);
        }
      }
    }
  };

  renderOperations("commands", model.commands);
  out.push("");
  renderOperations("queries", model.queries || []);
  out.push("");
  out.push("events:");
  if (model.events.length === 0) out.push("  []");
  for (const e of model.events) {
    out.push(`  - id: ${yamlScalar(e.id)}`);
    out.push(`    name: ${yamlScalar(e.name)}`);
  }
  out.push("");
  out.push("scenarios:");
  for (const s of model.scenarios) {
    out.push(`  - id: ${yamlScalar(s.id)}`);
    out.push(`    title: ${yamlScalar(s.title)}`);
    out.push(`    use_case: ${yamlScalar(s.use_case)}`);
    out.push(`    command: ${yamlScalar(s.command)}`);
    if (s.events.length === 0) {
      out.push(`    events: []`);
    } else {
      out.push(`    events:`);
      for (const e of s.events) out.push(`      - ${yamlScalar(e)}`);
    }
  }
  out.push("");
  return out.join("\n");
}

export class InferPackCommand extends BaseCommand {
  public execute(): void {
    const rawArgs = this.args[0] === "pack" ? this.args.slice(1) : this.args;
    const args = rawArgs[0] === "infer" ? rawArgs.slice(1) : rawArgs;
    const opts = parseArgs(args);

    if (!opts.from) {
      logError("--from <feature-file> is required.");
      usage();
      process.exit(2);
    }

    // A directory expands to the `.feature` files in it, which is how a
    // capability is usually laid out.
    const files: string[] = [];
    for (const source of opts.sources) {
      let stat;
      try {
        stat = fs.statSync(source);
      } catch (err: any) {
        logError(`Cannot read '${source}': ${err.message}`);
        process.exit(1);
      }
      if (stat.isDirectory()) {
        const found = fs
          .readdirSync(source)
          .filter((name) => name.endsWith(".feature"))
          .sort()
          .map((name) => path.join(source, name));
        if (found.length === 0) {
          logError(`No .feature files in directory '${source}'.`);
          process.exit(1);
        }
        files.push(...found);
      } else {
        files.push(source);
      }
    }

    const models: any[] = [];
    for (const file of files) {
      let content: string;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch (err: any) {
        logError(`Cannot read feature file '${file}': ${err.message}`);
        process.exit(1);
      }
      const parsed = parseFeatureFile(content);
      if (parsed.scenarios.length === 0) {
        logError(`No Gherkin scenarios found in '${file}'.`);
        process.exit(1);
      }
      models.push(inferModel(parsed, file));
    }

    const model = mergeModels(models, files);
    const label = files.length === 1 ? files[0] : `${files.length} feature files`;

    if (opts.format === "json") {
      process.stdout.write(
        JSON.stringify({ schemaVersion: 1, source: files, ...model }, null, 2) + "\n"
      );
    } else {
      process.stdout.write(renderYamlFragment(model, label) + "\n");
    }
    process.exit(0);
  }
}
