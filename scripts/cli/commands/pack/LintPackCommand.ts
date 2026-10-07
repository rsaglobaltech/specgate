import * as fs from "node:fs";
import * as path from "node:path";
import {
  loadPack,
  validatePackModel,
} from "../../../../packages/core/src/infrastructure/DiskPackRepository";
import { asArray } from "../../../../packages/core/src/domain/PackSpec";
import { BaseCommand } from "../../../lib/command";
import { parseGherkin } from "../../../../packages/core/src/domain/Gherkin";
import {
  analyseKeywordCase,
  analyseScenario,
  isGenericTitle as isGenericTitleRule,
} from "../../../../packages/core/src/domain/GherkinQuality";
import { agentIo, wantsJson } from "../../../lib/agent";
import { error as diagError, warning as diagWarning } from "../../../lib/diagnostics";

function logInfo(msg: string) {
  process.stdout.write(`ℹ️  [INFO] ${msg}\n`);
}
function logWarn(msg: string) {
  process.stdout.write(`⚠️  [WARN] ${msg}\n`);
}
function logError(msg: string) {
  process.stderr.write(`❌ [ERROR] ${msg}\n`);
}

export interface LintPackOptions {
  packRoot: string | null;
  packId: string | null;
  strict: boolean;
  graph: boolean;
  graphFormat: string;
  json: boolean;
}

function usage() {
  process.stdout.write(
    "Usage:\n" +
      "  specgate pack lint --pack-root <path> --pack <domain/type> [--strict]\n" +
      "  specgate pack lint --pack-root <path> --pack <domain/type> --graph [--graph-format mermaid|dot]\n\n" +
      "Options:\n" +
      "  --pack-root      Root directory containing domain packs (required)\n" +
      "  --pack           Pack identifier, e.g. parking-management/backend (required)\n" +
      "  --strict         Promote scenario-quality warnings to errors. Use in CI and\n" +
      "                   before a pack feeds `harness run` — a weak scenario is a\n" +
      "                   weak reward signal.\n" +
      "  --graph          Print the REQ→UC→AGG/EVT/CMD reference graph instead of the\n" +
      "                   lint report. Broken references are highlighted and listed;\n" +
      "                   exits non-zero when any reference is dangling.\n" +
      "  --graph-format   Graph output format: mermaid (default) or dot.\n"
  );
}

export function parseArgs(argv: string[]) {
  const opts: LintPackOptions = {
    packRoot: null,
    packId: null,
    strict: false,
    graph: false,
    graphFormat: "mermaid",
    json: wantsJson(argv),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--pack-root" && argv[i + 1]) {
      opts.packRoot = argv[++i];
    } else if (a === "--pack" && argv[i + 1]) {
      opts.packId = argv[++i];
    } else if (a === "--strict") {
      opts.strict = true;
    } else if (a === "--graph") {
      opts.graph = true;
    } else if (a === "--graph-format" && argv[i + 1]) {
      opts.graphFormat = argv[++i];
    } else if (a === "--json") {
      opts.json = true;
    } else if (a === "--format" && argv[i + 1] === "json") {
      opts.json = true;
      i++;
    } else if (a === "--help" || a === "-h") {
      usage();
      process.exit(0);
    }
  }
  if (!["mermaid", "dot"].includes(opts.graphFormat)) {
    logError(`Invalid --graph-format: ${opts.graphFormat}. Expected: mermaid | dot.`);
    process.exit(2);
  }
  return opts;
}

const NULL_SHAPE = { pack: null, packRoot: null, graph: null };

function lintTodos(pack: any, errors: string[], warnings: string[]) {
  const yaml = JSON.stringify(pack);
  const count = (yaml.match(/TODO/g) || []).length;
  if (count > 0) {
    warnings.push(`Pack contains ${count} TODO placeholder(s). Replace before shipping.`);
  }
}

function lintRequirementsCoverage(pack: any, errors: string[], _warnings: string[]) {
  const reqIds = new Set(asArray(pack.requirements).map((r: any) => r.id));
  const usedInUC = new Set(
    asArray(pack.use_cases).flatMap((uc: any) =>
      asArray(uc.requirements || (uc.requirement ? [uc.requirement] : []))
    )
  );
  // The schema names the field `requirement_id`; reading only `requirement`
  // made every scenario invisible here, so a requirement covered only by a
  // scenario failed `--strict` as unreferenced.
  const usedInSCN = new Set(
    asArray(pack.scenarios)
      .map((s: any) => s.requirement_id || s.requirement)
      .filter(Boolean)
  );
  const usedInAC = new Set(
    asArray(pack.api_contracts)
      .map((ac: any) => ac.requirement)
      .filter(Boolean)
  );
  const usedInCDT = new Set(
    asArray(pack.consumer_driven_tests)
      .map((cdt: any) => cdt.requirement)
      .filter(Boolean)
  );
  const usedInBCR = new Set(
    asArray(pack.breaking_change_rules)
      .map((bcr: any) => bcr.requirement)
      .filter(Boolean)
  );
  for (const id of reqIds) {
    if (
      !usedInUC.has(id) &&
      !usedInSCN.has(id) &&
      !usedInAC.has(id) &&
      !usedInCDT.has(id) &&
      !usedInBCR.has(id)
    ) {
      errors.push(
        `REQ ${id} is not referenced by any use case, scenario, api_contract, consumer_driven_test, or breaking_change_rules entry.`
      );
    }
  }
}

function lintUseCaseActors(pack: any, _errors: string[], warnings: string[]) {
  for (const uc of asArray(pack.use_cases)) {
    if (!uc.actor || uc.actor.trim() === "") {
      warnings.push(`UC ${uc.id} has no actor defined.`);
    }
  }
}

function lintBoundedContextAggregates(pack: any, errors: string[], _warnings: string[]) {
  const bcIds = new Set(asArray(pack.bounded_contexts).map((bc: any) => bc.id));
  for (const agg of asArray(pack.aggregates)) {
    if (agg.bounded_context && !bcIds.has(agg.bounded_context)) {
      errors.push(
        `Aggregate ${agg.id || agg.name} references unknown bounded_context: ${agg.bounded_context}`
      );
    }
  }
}

function lintEventAggregates(pack: any, errors: string[], _warnings: string[]) {
  const aggNames = new Set(asArray(pack.aggregates).map((a: any) => a.name));
  for (const evt of asArray(pack.events)) {
    if (evt.aggregate && aggNames.size > 0 && !aggNames.has(evt.aggregate)) {
      errors.push(`Event ${evt.id || evt.name} references unknown aggregate: ${evt.aggregate}`);
    }
  }
}

function lintScenarioRefs(pack: any, errors: string[], _warnings: string[]) {
  const reqIds = new Set(asArray(pack.requirements).map((r: any) => r.id));
  const ucIds = new Set(asArray(pack.use_cases).map((uc: any) => uc.id));
  for (const scn of asArray(pack.scenarios)) {
    if (scn.requirement && !reqIds.has(scn.requirement)) {
      errors.push(`Scenario ${scn.id} references unknown requirement: ${scn.requirement}`);
    }
    if (scn.use_case && !ucIds.has(scn.use_case)) {
      errors.push(`Scenario ${scn.id} references unknown use_case: ${scn.use_case}`);
    }
  }
}

function lintRuleContextRefs(pack: any, _errors: string[], warnings: string[]) {
  const bcIds = new Set(asArray(pack.bounded_contexts).map((bc: any) => bc.id));
  for (const rule of asArray(pack.rules)) {
    if (rule.context && bcIds.size > 0 && !bcIds.has(rule.context)) {
      warnings.push(
        `Rule ${rule.id} context '${rule.context}' does not match any bounded_context id.`
      );
    }
  }
}

function lintIdUniqueness(pack: any, errors: string[], _warnings: string[]) {
  const sections = [
    "requirements",
    "use_cases",
    "bounded_contexts",
    "aggregates",
    "value_objects",
    "events",
    "rules",
    "scenarios",
    "commands",
  ];
  for (const section of sections) {
    const items = asArray(pack[section]);
    const seen = new Set();
    for (const item of items) {
      if (!item.id) continue;
      if (seen.has(item.id)) {
        errors.push(`Duplicate id '${item.id}' in ${section}.`);
      }
      seen.add(item.id);
    }
  }
}

function lintVariables(pack: any, errors: string[], _warnings: string[]) {
  const required = asArray(pack.variables && pack.variables.required);
  for (const v of required) {
    if (typeof v !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(v)) {
      errors.push(`Variable '${v}' must be UPPER_SNAKE_CASE.`);
    }
  }
}

/**
 * What `pack lint` reads out of a `.feature` template.
 *
 * Delegates to `parseGherkin`, the one reader in this repository (F1). This is
 * the parser that shipped H14: it matched keywords case-insensitively, so it
 * saw three steps in a scenario where Cucumber saw none and reported the pack
 * as fine. A linter that approves what the runner ignores is worse than no
 * linter, because it grants a guarantee that does not exist.
 *
 * Reading through the shared parser makes the linter case-sensitive, which is
 * the whole point: it now judges the file the runner will actually execute.
 */
export function parseFeature(content: string) {
  return parseGherkin(content).scenarios.map((scenario) => ({
    outline: scenario.outline,
    title: scenario.name,
    steps: scenario.steps.map((step) => ({ keyword: step.keyword, text: step.text })),
    hasExamples: scenario.hasExamples,
  }));
}

/** Re-exported so `pack lint`'s public surface is unchanged; the rule is in the domain. */
export const isGenericTitle = isGenericTitleRule;

/**
 * The eight quality rules, applied to one scenario.
 *
 * The rules themselves moved to `GherkinQuality` in the domain (A3) so that
 * `validate`, `doctor` and `harness run` judge a scenario the same way this
 * does. What stays here is delivery: which bucket a finding lands in and how
 * the line reads. `errors` fail the lint; `scenarioIssues` are reported and
 * only fail under `--strict`.
 *
 * Severity comes from the rule, never from the caller — `scenario_has_no_steps`
 * is an error wherever it is raised, which is the correction H14 forced.
 */
function checkGherkin(where: string, gherkin: any, errors: string[], scenarioIssues: string[]) {
  const findings = analyseScenario(
    {
      name: gherkin.title || "",
      steps: gherkin.steps,
      outline: Boolean(gherkin.outline),
      hasExamples: Boolean(gherkin.hasExamples),
    },
    where
  );
  for (const finding of findings) {
    // The message carries its own code where the code is worth reading aloud
    // (`scenario_has_no_steps`); the rest read as prose. Preserved verbatim:
    // this extraction changes where the rules live, not what a user sees.
    const line = `${where}: ${finding.message}`;
    if (finding.severity === "error") errors.push(line);
    else scenarioIssues.push(line);
  }
}

function inlineGherkin(scn: any) {
  const steps: any[] = [];
  for (const keyword of ["given", "when", "then"]) {
    for (const text of asArray(scn[keyword])) {
      if (typeof text === "string" && text.trim()) steps.push({ keyword, text: text.trim() });
    }
  }
  return { title: scn.title || scn.scenario || "", steps, outline: false, hasExamples: true };
}

export function lintScenarioQuality(
  pack: any,
  packRoot: string,
  errors: string[],
  scenarioIssues: string[]
) {
  for (const scn of asArray(pack.scenarios)) {
    const label = scn.id || scn.title || scn.scenario || "(unnamed scenario)";

    if (!scn.template && (scn.given || scn.when || scn.then)) {
      checkGherkin(
        `${label} → "${scn.title || "(no title)"}"`,
        inlineGherkin(scn),
        errors,
        scenarioIssues
      );
      continue;
    }

    if (!scn.template) {
      scenarioIssues.push(
        `Scenario ${label} declares no scenario content (template file or given/when/then).`
      );
      continue;
    }
    const templatePath = path.resolve(packRoot, scn.template);
    if (!fs.existsSync(templatePath)) {
      errors.push(`Scenario ${label} template not found: ${scn.template}`);
      continue;
    }

    const templateSource = fs.readFileSync(templatePath, "utf8");

    // `keyword_case_invalid` — an error, always. Cucumber discards these lines
    // in silence, which is precisely what makes them dangerous: the file looks
    // like it has steps and behaves as if it has none. Named with the literal
    // correction, because "it must be `Given`" is a fix and "no steps found" is
    // a riddle.
    for (const finding of analyseKeywordCase(templateSource, scn.template)) {
      errors.push(`${finding.file}:${finding.line}: ${finding.code} — ${finding.message}`);
    }

    const parsed = parseFeature(templateSource);
    if (parsed.length === 0) {
      scenarioIssues.push(`Scenario ${label} (${scn.template}) contains no Gherkin scenario.`);
      continue;
    }

    for (const gherkin of parsed) {
      checkGherkin(
        `${label} → "${gherkin.title || "(no title)"}"`,
        gherkin,
        errors,
        scenarioIssues
      );
    }

    if (
      scn.scenario &&
      parsed.length === 1 &&
      parsed[0].title &&
      scn.scenario.trim() !== parsed[0].title.trim()
    ) {
      scenarioIssues.push(
        `${label}: pack.yaml scenario "${scn.scenario}" does not match template title "${parsed[0].title}".`
      );
    }
  }
}

function lintInstallable(pack: any, packRoot: string, errors: string[], _warnings: string[]) {
  try {
    validatePackModel(pack, packRoot);
  } catch (err: any) {
    errors.push(
      `Pack cannot be installed: ${err.message} ` +
        "(`expand` enforces this, so lint has to as well)"
    );
  }
}

export interface LintRunOptions {
  strict?: boolean;
}

export function runLint(pack: any, packRoot: string, opts: LintRunOptions = {}) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const scenarioIssues: string[] = [];

  lintInstallable(pack, packRoot, errors, warnings);
  lintTodos(pack, errors, warnings);
  lintIdUniqueness(pack, errors, warnings);
  lintVariables(pack, errors, warnings);
  lintRequirementsCoverage(pack, errors, warnings);
  lintUseCaseActors(pack, errors, warnings);
  lintBoundedContextAggregates(pack, errors, warnings);
  lintEventAggregates(pack, errors, warnings);
  lintScenarioRefs(pack, errors, warnings);
  lintRuleContextRefs(pack, errors, warnings);
  lintScenarioQuality(pack, packRoot, errors, scenarioIssues);

  if (opts.strict) {
    errors.push(...scenarioIssues);
  } else {
    warnings.push(...scenarioIssues);
  }

  return { errors, warnings };
}

export function buildPackGraph(pack: any) {
  const nodes: any[] = [];
  const edges: any[] = [];
  const broken: any[] = [];
  const seen = new Set();

  function addNode(id: string, type: string, label: string) {
    if (seen.has(id)) return;
    seen.add(id);
    nodes.push({ id, type, label });
  }
  function addEdge(from: string, to: string, kind: string) {
    edges.push({ from, to, kind });
  }
  function missingNode(kind: string, ref: string) {
    const id = `MISSING:${kind}:${ref}`;
    addNode(id, "missing", ref);
    return id;
  }

  const requirements = asArray(pack.requirements);
  const useCases = asArray(pack.use_cases);
  const commands = asArray(pack.commands);
  const queries = asArray(pack.queries);
  const aggregates = asArray(pack.aggregates);
  const events = asArray(pack.events);

  const reqById = new Map(requirements.filter((r: any) => r.id).map((r: any) => [r.id, r]));
  const cmdByKey = new Map();
  for (const c of commands) {
    if (c.id) cmdByKey.set(c.id, c);
    if (c.name) cmdByKey.set(c.name, c);
  }
  const queryByKey = new Map();
  for (const q of queries) {
    if (q.id) queryByKey.set(q.id, q);
    if (q.name) queryByKey.set(q.name, q);
  }
  const aggByKey = new Map();
  for (const a of aggregates) {
    if (a.id) aggByKey.set(a.id, a);
    if (a.name) aggByKey.set(a.name, a);
  }
  const evtByKey = new Map();
  for (const e of events) {
    if (e.id) evtByKey.set(e.id, e);
    if (e.name) evtByKey.set(e.name, e);
  }

  const nodeId = {
    req: (r: any) => `REQ:${r.id}`,
    uc: (u: any) => `UC:${u.id}`,
    cmd: (c: any) => `CMD:${c.id || c.name}`,
    query: (q: any) => `QUERY:${q.id || q.name}`,
    agg: (a: any) => `AGG:${a.id || a.name}`,
    evt: (e: any) => `EVT:${e.id || e.name}`,
  };
  const labelOf = (entity: any, fallback: string) => {
    if (entity.id && entity.name) return `${entity.id} ${entity.name}`;
    return entity.id || entity.name || fallback;
  };

  for (const r of requirements) addNode(nodeId.req(r), "requirement", r.id || "(no id)");
  for (const u of useCases) addNode(nodeId.uc(u), "use_case", labelOf(u, "(use case)"));
  for (const c of commands) addNode(nodeId.cmd(c), "command", labelOf(c, "(command)"));
  for (const q of queries) addNode(nodeId.query(q), "query", labelOf(q, "(query)"));
  for (const a of aggregates) addNode(nodeId.agg(a), "aggregate", labelOf(a, "(aggregate)"));
  for (const e of events) addNode(nodeId.evt(e), "event", labelOf(e, "(event)"));

  for (const u of useCases) {
    const from = nodeId.uc(u);
    const label = u.id || u.name || "(use case)";

    const reqRefs = asArray(u.requirements || (u.requirement ? [u.requirement] : []));
    for (const ref of reqRefs) {
      const target = reqById.get(ref);
      if (target) {
        addEdge(nodeId.req(target), from, "implements");
      } else {
        broken.push({ from: label, kind: "requirement", ref });
        addEdge(missingNode("requirement", ref), from, "implements");
      }
    }

    if (u.command) {
      const target = cmdByKey.get(u.command);
      if (target) {
        addEdge(from, nodeId.cmd(target), "dispatches");
      } else {
        broken.push({ from: label, kind: "command", ref: u.command });
        addEdge(from, missingNode("command", u.command), "dispatches");
      }
    }
    if (u.query) {
      const target = queryByKey.get(u.query);
      if (target) {
        addEdge(from, nodeId.query(target), "runs");
      } else {
        broken.push({ from: label, kind: "query", ref: u.query });
        addEdge(from, missingNode("query", u.query), "runs");
      }
    }

    if (u.aggregate) {
      const target = aggByKey.get(u.aggregate);
      if (target) {
        addEdge(from, nodeId.agg(target), "handled by");
      } else {
        broken.push({ from: label, kind: "aggregate", ref: u.aggregate });
        addEdge(from, missingNode("aggregate", u.aggregate), "handled by");
      }
    }

    for (const ref of asArray(u.emits)) {
      const target = evtByKey.get(ref);
      if (target) {
        addEdge(from, nodeId.evt(target), "emits");
      } else {
        broken.push({ from: label, kind: "event", ref });
        addEdge(from, missingNode("event", ref), "emits");
      }
    }
  }

  return { nodes, edges, broken };
}

function sanitizeId(id: string) {
  return id.replace(/[^A-Za-z0-9]/g, "_");
}

export function renderMermaid(graph: any) {
  const lines = ["graph LR"];
  for (const node of graph.nodes) {
    const safe = sanitizeId(node.id);
    const label = node.label.replace(/"/g, "'");
    lines.push(`  ${safe}["${label}"]:::${node.type}`);
  }
  for (const edge of graph.edges) {
    lines.push(`  ${sanitizeId(edge.from)} -->|${edge.kind}| ${sanitizeId(edge.to)}`);
  }
  lines.push("");
  lines.push("  classDef requirement fill:#e7f5ff,stroke:#1c7ed6;");
  lines.push("  classDef use_case fill:#fff9db,stroke:#f08c00;");
  lines.push("  classDef command fill:#f3f0ff,stroke:#7048e8;");
  lines.push("  classDef query fill:#f3f0ff,stroke:#7048e8;");
  lines.push("  classDef aggregate fill:#ebfbee,stroke:#2f9e44;");
  lines.push("  classDef event fill:#fff0f6,stroke:#c2255c;");
  lines.push("  classDef missing fill:#ff6b6b,stroke:#c92a2a,color:#fff;");
  return lines.join("\n");
}

export function renderDot(graph: any) {
  const lines = ["digraph pack {", "  rankdir=LR;", "  node [shape=box, style=rounded];"];
  const fill: Record<string, string> = {
    requirement: "#e7f5ff",
    use_case: "#fff9db",
    command: "#f3f0ff",
    query: "#f3f0ff",
    aggregate: "#ebfbee",
    event: "#fff0f6",
    missing: "#ff6b6b",
  };
  for (const node of graph.nodes) {
    const label = node.label.replace(/"/g, "'");
    lines.push(
      `  "${node.id}" [label="${label}", style="rounded,filled", fillcolor="${fill[node.type] || "#ffffff"}"];`
    );
  }
  for (const edge of graph.edges) {
    lines.push(`  "${edge.from}" -> "${edge.to}" [label="${edge.kind}"];`);
  }
  lines.push("}");
  return lines.join("\n");
}

function emitGraph(pack: any, opts: LintPackOptions) {
  const graph = buildPackGraph(pack);
  const rendered = opts.graphFormat === "dot" ? renderDot(graph) : renderMermaid(graph);
  process.stdout.write(rendered + "\n");

  if (graph.broken.length > 0) {
    logError(`Pack '${opts.packId}' has ${graph.broken.length} dangling reference(s):`);
    for (const b of graph.broken) {
      logError(`  ${b.from} references unknown ${b.kind}: ${b.ref}`);
    }
    process.exit(1);
  }
  process.exit(0);
}

export class LintPackCommand extends BaseCommand {
  public execute(): void {
    const rawArgs = this.args[0] === "pack" ? this.args.slice(1) : this.args;
    const args = rawArgs[0] === "lint" ? rawArgs.slice(1) : rawArgs;
    const opts = parseArgs(args);
    const io = agentIo(opts.json);

    if (!opts.packRoot || !opts.packId) {
      if (!io.json) usage();
      io.usage(NULL_SHAPE, [
        diagError("pack_args_required", "--pack-root and --pack are required.", {
          fix: "specgate pack lint --pack-root <path> --pack <domain/type>",
        }),
      ]);
      return;
    }

    let loadResult: any;
    try {
      loadResult = loadPack(opts.packRoot, opts.packId);
    } catch (err: any) {
      io.fail({ ...NULL_SHAPE, pack: opts.packId }, [
        diagError("pack_load_failed", `Failed to load pack: ${err.message}`, {
          target: opts.packId,
          fix: "Check --pack-root points at the directory that contains the pack, and --pack at its id.",
        }),
      ]);
      return;
    }

    const { pack, packRoot } = loadResult;

    if (opts.graph) {
      if (io.json) {
        const graph = buildPackGraph(pack);
        const rendered = opts.graphFormat === "dot" ? renderDot(graph) : renderMermaid(graph);
        io.emitAndGate({
          pack: opts.packId,
          packRoot,
          format: opts.graphFormat,
          graph: rendered,
          status: graph.broken.map((b: any) =>
            diagError(
              "pack_graph_dangling_reference",
              `${b.from} references unknown ${b.kind}: ${b.ref}`,
              {
                target: b.from,
                fix: `Define ${b.ref}, or remove the reference from ${b.from}.`,
              }
            )
          ),
        });
        return;
      }
      emitGraph(pack, opts);
      return;
    }

    const { errors, warnings } = runLint(pack, packRoot, { strict: opts.strict });

    const status = [
      ...warnings.map((w) => diagWarning("pack_lint_warning", w, { target: opts.packId })),
      ...errors.map((e) => diagError("pack_lint_error", e, { target: opts.packId })),
    ];

    io.emitAndGate({ pack: opts.packId, packRoot, graph: null, status }, () => {
      for (const w of warnings) logWarn(w);
      for (const e of errors) logError(e);

      if (errors.length === 0 && warnings.length === 0) {
        logInfo(`Pack '${opts.packId}' passed all lint checks.`);
      } else if (errors.length === 0) {
        logInfo(`Pack '${opts.packId}' has ${warnings.length} warning(s) but no errors.`);
      } else {
        logError(`Pack '${opts.packId}' failed lint with ${errors.length} error(s).`);
      }
    });

    process.exit(0);
  }
}
