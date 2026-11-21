/**
 * What the gate requires, as a policy the repository keeps (issue #494).
 *
 * `.specgate/gate.yaml` says how strict each part of the gate is — `error`
 * fails it, `warning` reports and passes, `off` does not run — starting from a
 * preset. Without the file the gate is `strict`, which is what `--strict`
 * always meant: a project that never wrote a policy keeps its gate.
 *
 *   preset: standard            # minimal | standard | strict
 *   rules:
 *     coverage: warning         # error | warning | off
 *   enforce_from: 2026-12-15    # until then, every error is a warning
 *
 * Read by `validate --strict` (the specification's rules) and by `check` (the
 * ids against the base branch, and the quality checks).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parseYamlLite } from "../../packages/core/src/domain/YamlLite";

export const GATE_POLICY_FILE = ".specgate/gate.yaml";

export const RULES = [
  "tdd",
  "scenarios",
  "requirements",
  "links",
  "coverage",
  "ids",
  "quality",
  "use_cases",
] as const;
export type Rule = (typeof RULES)[number];

export const LEVELS = ["error", "warning", "off"] as const;
export type Level = (typeof LEVELS)[number];

export const PRESETS = ["minimal", "standard", "strict"] as const;
export type Preset = (typeof PRESETS)[number];

/** What each rule checks, in the words a finding or `config keys` uses. */
export const RULE_MEANING: Record<Rule, string> = {
  tdd: "a delivered requirement has a test that names it (--strict-tdd)",
  scenarios: "every scenario can fail: real steps, capitalised keywords (--strict-scenarios)",
  requirements:
    "every requirement states an obligation, not the sentence Specgate wrote (--strict-requirements)",
  links: "every path the matrix declares exists (--strict-links)",
  coverage: "every scenario of a declared feature file is named by a test (--strict-coverage)",
  ids: "no requirement id means something else on the base branch",
  quality: "the quality checks of harness.config.yaml pass",
  use_cases:
    "every requirement names a use case of docs/specs/use-cases.md, and every use case is delivered (--strict-use-cases)",
};

const STRICT: Record<Rule, Level> = {
  tdd: "error",
  scenarios: "error",
  requirements: "error",
  links: "error",
  coverage: "error",
  ids: "error",
  quality: "error",
  // REQ-627: reported, not failed, until a project's catalog is written.
  use_cases: "warning",
};

/** The three starting points; `rules:` overrides any rule of the one chosen. */
export const PRESET_RULES: Record<Preset, Record<Rule, Level>> = {
  // Today's gate: everything fails it.
  strict: STRICT,
  // Coverage is a name match, not a run of the suite: reported, not failed.
  standard: { ...STRICT, coverage: "warning" },
  // A team adopting the gate: what makes a requirement unproven fails it;
  // wording, coverage and the extras are reported.
  minimal: {
    tdd: "error",
    scenarios: "error",
    requirements: "warning",
    links: "error",
    coverage: "off",
    ids: "warning",
    quality: "warning",
    use_cases: "off",
  },
};

export interface GatePolicy {
  /** `file` when `.specgate/gate.yaml` exists, else the default. */
  readonly source: "file" | "default";
  readonly preset: Preset;
  /** Each rule's level as written, before `enforce_from`. */
  readonly rules: Readonly<Record<Rule, Level>>;
  /** `YYYY-MM-DD`: before it, every `error` is reported as a `warning`. */
  readonly enforceFrom?: string;
  /** What is wrong with the file, each with its fix; empty when it reads. */
  readonly problems: ReadonlyArray<{ readonly message: string; readonly fix: string }>;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `.specgate/gate.yaml`, read; the strict default when it is not there. */
export function readGatePolicy(projectDir: string): GatePolicy {
  const file = path.join(projectDir, GATE_POLICY_FILE);
  if (!fs.existsSync(file)) {
    return { source: "default", preset: "strict", rules: { ...STRICT }, problems: [] };
  }
  return parseGatePolicy(fs.readFileSync(file, "utf8"));
}

/** The policy a file's text says, and what in it cannot be read. */
export function parseGatePolicy(text: string): GatePolicy {
  const problems: Array<{ message: string; fix: string }> = [];
  let doc: Record<string, unknown> = {};
  try {
    const parsed = parseYamlLite(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) doc = parsed;
    else
      problems.push({
        message: "it is not a mapping",
        fix: "Write `preset: standard` on its first line.",
      });
  } catch (e) {
    problems.push({ message: `it is not YAML: ${(e as Error).message}`, fix: "Fix the YAML." });
  }

  for (const key of Object.keys(doc)) {
    if (!["preset", "rules", "enforce_from"].includes(key)) {
      problems.push({
        message: `\`${key}\` is not a key of the gate policy`,
        fix: "The keys are preset, rules and enforce_from.",
      });
    }
  }

  let preset: Preset = "strict";
  if (doc.preset !== undefined) {
    const p = String(doc.preset);
    if ((PRESETS as readonly string[]).includes(p)) preset = p as Preset;
    else {
      problems.push({
        message: `preset \`${p}\` is not one of ${PRESETS.join(", ")}`,
        fix: "Use preset: minimal, standard or strict.",
      });
    }
  }

  const rules: Record<Rule, Level> = { ...PRESET_RULES[preset] };
  if (doc.rules !== undefined) {
    if (!doc.rules || typeof doc.rules !== "object" || Array.isArray(doc.rules)) {
      problems.push({
        message: "`rules:` is not a mapping",
        fix: "Write one rule per line under it, e.g. `  coverage: warning`.",
      });
    } else {
      for (const [name, value] of Object.entries(doc.rules as Record<string, unknown>)) {
        if (!(RULES as readonly string[]).includes(name)) {
          problems.push({
            message: `\`${name}\` is not a rule of the gate`,
            fix: `The rules are ${RULES.join(", ")}.`,
          });
          continue;
        }
        const level = String(value);
        if (!(LEVELS as readonly string[]).includes(level)) {
          problems.push({
            message: `rule ${name} is \`${level}\`, not error, warning or off`,
            fix: `Write \`${name}: error\`, \`${name}: warning\` or \`${name}: off\`.`,
          });
          continue;
        }
        rules[name as Rule] = level as Level;
      }
    }
  }

  let enforceFrom: string | undefined;
  if (doc.enforce_from !== undefined) {
    const d = String(doc.enforce_from);
    if (DATE.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`))) enforceFrom = d;
    else {
      problems.push({
        message: `enforce_from \`${d}\` is not a date`,
        fix: "Write it as YYYY-MM-DD, e.g. enforce_from: 2026-12-15.",
      });
    }
  }

  return { source: "file", preset, rules, enforceFrom, problems };
}

/** Today, as `YYYY-MM-DD`; `SPECGATE_TODAY` stands in for the clock in tests. */
export function today(): string {
  const fixed = process.env.SPECGATE_TODAY;
  return fixed && DATE.test(fixed) ? fixed : new Date().toISOString().slice(0, 10);
}

/** Whether the policy's errors are still reported as warnings today. */
export function notEnforcedYet(policy: GatePolicy, on = today()): boolean {
  return !!policy.enforceFrom && on < policy.enforceFrom;
}

/** A rule's level today: `enforce_from` turns an `error` into a `warning` until its date. */
export function levelOf(policy: GatePolicy, rule: Rule, on = today()): Level {
  const level = policy.rules[rule];
  return level === "error" && notEnforcedYet(policy, on) ? "warning" : level;
}

/** One line for `check` and `ci status`: where the policy comes from and what it relaxes. */
export function describePolicy(policy: GatePolicy, on = today()): string {
  const relaxed = RULES.filter((r) => levelOf(policy, r, on) !== "error").map(
    (r) => `${r} ${levelOf(policy, r, on)}`
  );
  const where =
    policy.source === "file" ? `${GATE_POLICY_FILE} (${policy.preset})` : "strict — no gate.yaml";
  const until = notEnforcedYet(policy, on)
    ? `, errors reported as warnings until ${policy.enforceFrom}`
    : "";
  return `${where}${relaxed.length && !notEnforcedYet(policy, on) ? `: ${relaxed.join(", ")}` : ""}${until}`;
}

/** The file `specgate init` writes: the standard preset, every rule shown. */
export function gatePolicyTemplate(): string {
  const width = Math.max(...RULES.map((r) => `${r}: ${PRESET_RULES.standard[r]}`.length));
  const lines = [
    "# What the gate requires — `specgate check` and `validate --strict` read it.",
    "# preset: minimal | standard | strict. Each rule: error (fails the gate),",
    "# warning (reported, passes) or off (not run). Docs: docs/gate (the gate guide).",
    "preset: standard",
    "rules:",
    ...RULES.map(
      (r) => `  ${`${r}: ${PRESET_RULES.standard[r]}`.padEnd(width)}  # ${RULE_MEANING[r]}`
    ),
    "# enforce_from: 2026-12-31   # until then, every error is reported as a warning",
    "",
  ];
  return lines.join("\n");
}
