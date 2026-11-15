/**
 * Every setting `specgate config` reads and writes, and the file it is kept in
 * (REQ-505 … REQ-508).
 *
 * specgate-studio's Settings view lists them from `config keys --json` and
 * saves each through `config set`; it never writes a file itself. The keys in
 * `.specgate/config.json` and `test_cmd`, `arch_cmd` and `agent` predate this
 * catalog and keep their own writer in `ConfigSetCommand`; the keys added here
 * are written line by line into their YAML file (`YamlEdit`), and the result
 * is read back with the file's own reader before it replaces the file.
 *
 * Credentials are never stored: an ALM key that ends in `_env` holds the name
 * of the environment variable that holds the token, and no key holds a token.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parseYamlLite } from "../../packages/core/src/domain/YamlLite";
import { readQuality } from "../../packages/core/src/domain/QualityChecks";
import { setYamlListItem, setYamlValue, yamlScalar } from "../../packages/core/src/domain/YamlEdit";

export const CONFIG_JSON_FILE = ".specgate/config.json";
export const HARNESS_FILE = "harness.config.yaml";
export const PROFILES_FILE = ".harness/profiles.yaml";
export const ALM_FILE = "alm.config.yaml";

type Value = string | number | boolean | string[];

/** One key of the catalog; `<name>` stands for a profile's or a check's name. */
export interface KeySpec {
  key: string;
  description: string;
  values: string[] | null;
  pattern: string | null;
  default: Value | null;
  file: string;
  /** How the value is written: a quoted string, a number, a boolean, a list of names. */
  kind: "string" | "number" | "boolean" | "names";
  /** Why the value is refused, as a fix; null when it is accepted. */
  check?: (value: string, projectDir: string) => string | null;
}

const ENV_NAME = "^[A-Z_][A-Z0-9_]*$";
const PROFILE_NAME = "^[A-Za-z0-9][A-Za-z0-9_-]*$";
const CHECK_NAME = "^[a-z0-9][a-z0-9-]*$";

const number =
  (min: number, max = Infinity, integer = false) =>
  (v: string) => {
    const n = Number(v);
    const ok = v.trim() !== "" && Number.isFinite(n) && n >= min && n <= max;
    if (ok && (!integer || Number.isInteger(n))) return null;
    const what = integer ? "a whole number" : "a number";
    return max === Infinity
      ? `Use ${what} of ${min} or more.`
      : `Use ${what} from ${min} to ${max}.`;
  };
const matches = (pattern: string, fix: string) => (v: string) =>
  new RegExp(pattern).test(v) ? null : fix;
const notEmpty = (fix: string) => (v: string) => (v.trim() ? null : fix);
const url = (v: string) =>
  /^https:\/\/\S+$/.test(v) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/\S*)?$/.test(v)
    ? null
    : "Use an https:// URL (plain http only for localhost): the token is sent to it.";
const envName = (v: string) =>
  new RegExp(ENV_NAME).test(v)
    ? null
    : "Tokens are never stored: put the token in an environment variable and give its name, e.g. JIRA_TOKEN.";
const insideProject = (v: string) =>
  v && !/^([a-zA-Z]:)?[\\/]/.test(v) && !/(^|[\\/])\.\.([\\/]|$)/.test(v)
    ? null
    : "Use a path inside the project, relative to it.";

/** The keys kept in `.specgate/config.json` and the three gate commands, as before. */
const BASE: KeySpec[] = [
  {
    key: "profile",
    description: "Which commands `specgate --help` lists by default.",
    values: ["core", "full"],
    pattern: null,
    default: "core",
    file: CONFIG_JSON_FILE,
    kind: "string",
  },
  {
    key: "language",
    description: "Language for generated prose. Technical terms stay in English.",
    values: null,
    pattern: null,
    default: null,
    file: CONFIG_JSON_FILE,
    kind: "string",
  },
  {
    key: "pet",
    description: "Whether Gato, the cat that keeps the gate, shows up at the end of `status`.",
    values: ["on", "off"],
    pattern: null,
    default: "on",
    file: CONFIG_JSON_FILE,
    kind: "string",
  },
  {
    key: "agent_guard",
    description:
      "Whether the agent plugins refuse an edit to source code until a test names the requirement.",
    values: ["on", "off"],
    pattern: null,
    default: "on",
    file: CONFIG_JSON_FILE,
    kind: "string",
  },
  {
    key: "test_cmd",
    description: "The command `check` and `done` run as your tests.",
    values: null,
    pattern: null,
    default: null,
    file: HARNESS_FILE,
    kind: "string",
  },
  {
    key: "arch_cmd",
    description:
      "Your architecture check (ArchUnit, dependency-cruiser…), run by the gate before the tests.",
    values: null,
    pattern: null,
    default: null,
    file: HARNESS_FILE,
    kind: "string",
  },
  {
    key: "agent",
    description:
      "The agent `harness run` and the studio's Build hand each requirement to, with {prompt_file}.",
    values: null,
    pattern: "\\{prompt_file\\}",
    default: null,
    file: HARNESS_FILE,
    kind: "string",
  },
];

/** The keys this catalog writes itself, into their YAML file. */
const YAML: KeySpec[] = [
  {
    key: "agent_profile",
    description: "The profile of .harness/profiles.yaml whose agent `harness run` uses by default.",
    values: null,
    pattern: PROFILE_NAME,
    default: null,
    file: HARNESS_FILE,
    kind: "string",
    check: (v, dir) =>
      Object.keys(profilesOf(dir)).includes(v)
        ? null
        : `Name a profile .harness/profiles.yaml declares, or add it first: specgate config set profiles.${v}.agent "<command with {prompt_file}>"`,
  },
  {
    key: "quality",
    description:
      "The quality level: basic and strict set the thresholds, custom leaves them to you.",
    values: ["basic", "strict", "custom"],
    pattern: null,
    default: null,
    file: HARNESS_FILE,
    kind: "string",
  },
  {
    key: "diff_coverage",
    description: "The % of the changed executable lines a test must run.",
    values: null,
    pattern: null,
    default: null,
    file: HARNESS_FILE,
    kind: "number",
    check: number(0, 100),
  },
  {
    key: "mutation_score",
    description: "The % of the mutants on changed lines a test must kill.",
    values: null,
    pattern: null,
    default: null,
    file: HARNESS_FILE,
    kind: "number",
    check: number(0, 100),
  },
  // ── The fast gate (REQ-511, REQ-513, REQ-518) ─────────────────────────────────
  {
    key: "test_cmd_affected",
    description:
      "What `check --affected` and `apply` run instead of test_cmd, with {files} where the selected test files go.",
    values: null,
    pattern: "\\{(files|req)\\}",
    default: null,
    file: HARNESS_FILE,
    kind: "string",
    check: (v) =>
      /\{(files|req)\}/.test(v)
        ? null
        : 'Put {files} where your runner takes test files, e.g. "npx vitest run {files}" — without it, the whole suite runs anyway.',
  },
  {
    key: "full_on",
    description:
      "Globs of files whose change makes `check --affected` run the whole suite, comma-separated.",
    values: null,
    pattern: null,
    default: null,
    file: HARNESS_FILE,
    kind: "names",
    check: (v) =>
      v.split(",").some((g) => g.trim())
        ? null
        : 'Give at least one glob, e.g. "src/generated/**,db/schema.sql".',
  },
  {
    key: "gate_parallel",
    description:
      "Whether `check` runs the architecture check and the tests side by side; false runs them one after the other.",
    values: ["true", "false"],
    pattern: null,
    default: true,
    file: HARNESS_FILE,
    kind: "boolean",
  },
  // ── Quality checks: one `- name:` item of `checks:` (ADR-0040) ──────────────
  ...(
    [
      [
        "run",
        "The check's command, or a built-in such as builtin:commits. Setting it adds the check.",
        null,
        null,
        "string",
        notEmpty('Give the command, e.g. "npm run lint".'),
      ],
      ["when", "The stage it runs in.", ["attempt", "end", "ci"], "attempt", "string"],
      [
        "gate",
        "Whether a failure fails the gate; false only reports it.",
        ["true", "false"],
        true,
        "boolean",
      ],
      ["runner", "How it runs.", ["docker", "local", "auto"], "auto", "string"],
      [
        "image",
        "The image a docker runner uses.",
        null,
        null,
        "string",
        notEmpty("Give the image, e.g. semgrep/semgrep:1.90.0."),
      ],
      [
        "timeout",
        "Its time limit, in whole seconds.",
        null,
        900,
        "number",
        number(1, Infinity, true),
      ],
      [
        "sarif",
        "The SARIF report it writes, inside the project.",
        null,
        null,
        "string",
        insideProject,
      ],
      [
        "report",
        "A coverage or mutation report Specgate measures, format:path.",
        null,
        null,
        "string",
        matches(
          "^(jacoco|lcov|cobertura|pit|stryker):[^\\s]+$",
          "Use format:path, the format one of jacoco, lcov, cobertura, pit, stryker."
        ),
      ],
      [
        "scope",
        "Which findings count: those in the changed files, or every new one.",
        ["diff", "all"],
        "diff",
        "string",
      ],
      [
        "env",
        "The environment variable names it gets, comma-separated; values come from the environment.",
        null,
        null,
        "names",
        (v: string) =>
          v.split(",").every((n) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n.trim()))
            ? null
            : "List variable names only, comma-separated, e.g. SONAR_TOKEN,CI — never a value.",
      ],
      [
        "profile",
        "For builtin:review and builtin:adversary: the profile whose agent runs it.",
        null,
        null,
        "string",
        matches(PROFILE_NAME, "Name a profile of .harness/profiles.yaml."),
      ],
      [
        "needs",
        "An earlier check whose output this one reads.",
        null,
        null,
        "string",
        matches(CHECK_NAME, "Name an earlier check."),
      ],
      ["network", "false runs a docker check with no network.", ["true", "false"], true, "boolean"],
      [
        "shell",
        "false passes the command as the image's arguments instead of sh -c.",
        ["true", "false"],
        true,
        "boolean",
      ],
      [
        "docker",
        "true gives the container the host's Docker, for tests that start containers.",
        ["true", "false"],
        false,
        "boolean",
      ],
    ] as Array<[string, string, string[] | null, Value | null, KeySpec["kind"], KeySpec["check"]?]>
  ).map(([field, description, values, def, kind, check]): KeySpec => ({
    key: `checks.<name>.${field}`,
    description,
    values,
    pattern: null,
    default: def,
    file: HARNESS_FILE,
    kind,
    check,
  })),
  // ── Agent profiles: `profiles.<name>` of .harness/profiles.yaml ─────────────
  {
    key: "profiles.<name>.agent",
    description: "The profile's agent command, with {prompt_file} where the prompt goes.",
    values: null,
    pattern: "\\{prompt_file\\}",
    default: null,
    file: PROFILES_FILE,
    kind: "string",
    check: (v) =>
      v.includes("{prompt_file}")
        ? null
        : 'The agent command needs {prompt_file}: the prompt goes there, e.g. "claude -p < {prompt_file}".',
  },
  {
    key: "profiles.<name>.advisory",
    description: "true for a reviewer or adversary: its writes are discarded.",
    values: ["true", "false"],
    pattern: null,
    default: false,
    file: PROFILES_FILE,
    kind: "boolean",
  },
  ...(
    [
      [
        "cost_per_run_hint",
        "What one run of the profile is estimated to cost; `harness report` labels it estimated.",
      ],
      [
        "price_per_input_token",
        "The price of one input token; with the output price, `harness report` measures the cost from the tokens.",
      ],
      ["price_per_output_token", "The price of one output token."],
      [
        "price_per_cache_read_token",
        "The price of one cache-read token; the input price when not set.",
      ],
      [
        "price_per_cache_write_token",
        "The price of one cache-write token; the input price when not set.",
      ],
    ] as Array<[string, string]>
  ).map(([field, description]): KeySpec => ({
    key: `profiles.<name>.${field}`,
    description,
    values: null,
    pattern: null,
    default: null,
    file: PROFILES_FILE,
    kind: "number",
    check: number(0),
  })),
  // ── ALM: alm.config.yaml, never a credential ───────────────────────────────
  {
    key: "alm.provider",
    description: "The ALM: jira, azure, github, or npm:<package> for a community provider.",
    values: null,
    pattern: "^(jira|azure|github|npm:\\S+)$",
    default: null,
    file: ALM_FILE,
    kind: "string",
    check: matches("^(jira|azure|github|npm:\\S+)$", "Use jira, azure, github or npm:<package>."),
  },
  {
    key: "alm.base_url",
    description:
      "The site (Jira), the organisation (Azure), or GitHub Enterprise Server's API URL.",
    values: null,
    pattern: "^https://",
    default: null,
    file: ALM_FILE,
    kind: "string",
    check: url,
  },
  ...(
    [
      ["project_key", "The project key (Jira) or name (Azure)."],
      ["cloud_id", "Jira: auto, or the site id, to go through Atlassian's gateway."],
      ["issue_type", "The type `alm sync` creates (default Task)."],
      ["done_state", "Azure: the state `alm sync` closes to (default Done)."],
      [
        "acceptance_field",
        "Jira: the field that holds acceptance criteria, e.g. customfield_10050.",
      ],
    ] as Array<[string, string]>
  ).map(([field, description]): KeySpec => ({
    key: `alm.${field}`,
    description,
    values: null,
    pattern: null,
    default: null,
    file: ALM_FILE,
    kind: "string",
    check: notEmpty(`Give a value for ${field}.`),
  })),
  {
    key: "alm.repo",
    description: "GitHub: owner/name.",
    values: null,
    pattern: "^[\\w.-]+/[\\w.-]+$",
    default: null,
    file: ALM_FILE,
    kind: "string",
    check: matches("^[\\w.-]+/[\\w.-]+$", "Use owner/name."),
  },
  {
    key: "alm.token_env",
    description: "The name of the environment variable that holds the API token — never the token.",
    values: null,
    pattern: ENV_NAME,
    default: null,
    file: ALM_FILE,
    kind: "string",
    check: envName,
  },
  {
    key: "alm.user_env",
    description:
      "Jira: the name of the variable that holds the account's email (default JIRA_USER).",
    values: null,
    pattern: ENV_NAME,
    default: "JIRA_USER",
    file: ALM_FILE,
    kind: "string",
    check: envName,
  },
  {
    key: "alm.pr.repo",
    description: "`specgate alm pr`: the repository, owner/name.",
    values: null,
    pattern: "^[\\w.-]+/[\\w.-]+$",
    default: null,
    file: ALM_FILE,
    kind: "string",
    check: matches("^[\\w.-]+/[\\w.-]+$", "Use owner/name."),
  },
  {
    key: "alm.pr.base",
    description: "`specgate alm pr`: the branch pull requests target.",
    values: null,
    pattern: null,
    default: "develop",
    file: ALM_FILE,
    kind: "string",
    check: matches("^[^\\s~^:?*\\[\\\\]+$", "Give a branch name."),
  },
  {
    key: "alm.pr.token_env",
    description: "`specgate alm pr`: the name of the variable that holds the GitHub token.",
    values: null,
    pattern: ENV_NAME,
    default: "GITHUB_TOKEN",
    file: ALM_FILE,
    kind: "string",
    check: envName,
  },
  {
    key: "alm.pr.base_url",
    description: "`specgate alm pr`: the API URL; only for GitHub Enterprise Server.",
    values: null,
    pattern: "^https://",
    default: "https://api.github.com",
    file: ALM_FILE,
    kind: "string",
    check: url,
  },
];

export const CATALOG: readonly KeySpec[] = [...BASE, ...YAML];

/** A key with its template and, for `profiles.<name>.…` and `checks.<name>.…`, the name. */
export interface ResolvedKey {
  spec: KeySpec;
  name: string | null;
  /** Whether the catalog writes it (not `.specgate/config.json` or the gate commands). */
  yaml: boolean;
}

export function resolveKey(key: string): ResolvedKey | null {
  const exact = CATALOG.find((k) => k.key === key);
  if (exact) return { spec: exact, name: null, yaml: YAML.includes(exact) };
  const m = /^(profiles|checks)\.([^.]+)\.([a-z_]+)$/.exec(key || "");
  if (!m) return null;
  const spec = YAML.find((k) => k.key === `${m[1]}.<name>.${m[3]}`);
  return spec ? { spec, name: m[2], yaml: true } : null;
}

/** The fix for a key the catalog does not have: the keys it has, or why a credential is never one. */
export function unknownKeyFix(key: string): string {
  if (
    /^alm\./.test(key) &&
    /(token|password|secret|pass|pat|key)$/i.test(key) &&
    !/_env$/.test(key)
  ) {
    return "Credentials are never stored: put the token in an environment variable and name it, e.g. `specgate config set alm.token_env JIRA_TOKEN`.";
  }
  return "`specgate config keys` lists every setting.";
}

function readYaml(projectDir: string, rel: string): Record<string, unknown> {
  try {
    const doc = parseYamlLite(fs.readFileSync(path.join(projectDir, ...rel.split("/")), "utf8"));
    return doc && typeof doc === "object" && !Array.isArray(doc)
      ? (doc as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function profilesOf(projectDir: string): Record<string, Record<string, unknown>> {
  const p = readYaml(projectDir, PROFILES_FILE).profiles;
  return p && typeof p === "object" && !Array.isArray(p)
    ? (p as Record<string, Record<string, unknown>>)
    : {};
}

function checksOf(projectDir: string): Array<Record<string, unknown>> {
  const c = readYaml(projectDir, HARNESS_FILE).checks;
  return Array.isArray(c)
    ? (c.filter((x) => x && typeof x === "object") as Array<Record<string, unknown>>)
    : [];
}

/** The value a catalog key has in the project now, or null. */
export function currentValue(projectDir: string, key: string): Value | null {
  const r = resolveKey(key);
  if (!r || !r.yaml) return null;
  const field = key.split(".").pop() as string;
  let v: unknown;
  if (r.spec.file === PROFILES_FILE) v = (profilesOf(projectDir)[r.name as string] || {})[field];
  else if (key.startsWith("checks.")) {
    v = (checksOf(projectDir).find((c) => String(c.name) === r.name) || {})[field];
  } else if (key.startsWith("alm.pr.")) {
    const pr = readYaml(projectDir, ALM_FILE).pr;
    v = pr && typeof pr === "object" ? (pr as Record<string, unknown>)[field] : undefined;
  } else if (key.startsWith("alm.")) v = readYaml(projectDir, ALM_FILE)[field];
  else v = readYaml(projectDir, HARNESS_FILE)[key];
  if (v === undefined || v === null || typeof v === "object") {
    return Array.isArray(v) ? v.map(String) : null;
  }
  return v as Value;
}

/** Every concrete key the project has a value for, among those the catalog writes. */
export function presentKeys(projectDir: string): string[] {
  const keys: string[] = [];
  for (const spec of YAML) {
    if (!spec.key.includes("<name>")) {
      if (currentValue(projectDir, spec.key) !== null) keys.push(spec.key);
    }
  }
  for (const name of Object.keys(profilesOf(projectDir))) {
    for (const spec of YAML.filter((k) => k.key.startsWith("profiles.<name>."))) {
      const key = spec.key.replace("<name>", name);
      if (currentValue(projectDir, key) !== null) keys.push(key);
    }
  }
  for (const c of checksOf(projectDir)) {
    for (const spec of YAML.filter((k) => k.key.startsWith("checks.<name>."))) {
      const key = spec.key.replace("<name>", String(c.name));
      if (currentValue(projectDir, key) !== null) keys.push(key);
    }
  }
  return keys;
}

/** The names the project has for `<name>` in this template's keys. */
function namesFor(projectDir: string, template: string): string[] {
  if (template.startsWith("profiles.<name>.")) return Object.keys(profilesOf(projectDir));
  if (template.startsWith("checks.<name>.")) return checksOf(projectDir).map((c) => String(c.name));
  return [];
}

export interface CatalogEntry {
  key: string;
  description: string;
  values: string[] | null;
  pattern: string | null;
  default: Value | null;
  current: Value | null;
  file: string;
}

/**
 * `config keys --json` (REQ-506): every key, a key with a name once as a
 * template and once per name the project has. `baseValue` answers for the keys
 * this module does not write.
 */
export function catalog(
  projectDir: string,
  baseValue: (key: string) => Value | null
): CatalogEntry[] {
  const entry = (spec: KeySpec, key: string, current: Value | null): CatalogEntry => ({
    key,
    description: spec.description,
    values: spec.values,
    pattern: spec.pattern,
    default: spec.default,
    current,
    file: spec.file,
  });
  const out: CatalogEntry[] = [];
  for (const spec of CATALOG) {
    if (!spec.key.includes("<name>")) {
      const yaml = YAML.includes(spec);
      out.push(
        entry(spec, spec.key, yaml ? currentValue(projectDir, spec.key) : baseValue(spec.key))
      );
      continue;
    }
    out.push(entry(spec, spec.key, null));
    for (const name of namesFor(projectDir, spec.key)) {
      const key = spec.key.replace("<name>", name);
      out.push(entry(spec, key, currentValue(projectDir, key)));
    }
  }
  return out;
}

/** A refusal: the message, and the fix. */
export interface Refusal {
  message: string;
  fix: string;
}

/**
 * Write a catalog key into its YAML file, or say why not; the file is left as
 * it was when the value, or the file it would make, is refused.
 */
export function setYamlKey(
  projectDir: string,
  key: string,
  raw: string
): { ok: true; file: string; value: Value } | ({ ok: false } & Refusal) {
  const r = resolveKey(key) as ResolvedKey;
  const { spec, name } = r;
  const refuse = (fix: string, message = `${raw} is not a valid ${key}.`) => ({
    ok: false as const,
    message,
    fix,
  });
  if (name !== null) {
    const pattern = key.startsWith("checks.") ? CHECK_NAME : PROFILE_NAME;
    if (!new RegExp(pattern).test(name)) {
      return refuse(
        key.startsWith("checks.")
          ? "A check's name is lowercase words with dashes, e.g. checks.semgrep.run."
          : "A profile's name is letters, digits, - and _, e.g. profiles.fast.agent.",
        `${name} is not a valid name for ${spec.key}.`
      );
    }
  }
  if (spec.values && !spec.values.includes(raw))
    return refuse(`Use one of: ${spec.values.join(", ")}.`);
  const why = spec.check ? spec.check(raw, projectDir) : null;
  if (why) return refuse(why);

  const value: Value =
    spec.kind === "number"
      ? Number(raw)
      : spec.kind === "boolean"
        ? raw === "true"
        : spec.kind === "names"
          ? raw
              .split(",")
              .map((n) => n.trim())
              .filter(Boolean)
          : raw;
  const file = path.join(projectDir, ...spec.file.split("/"));
  const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  const scalar = yamlScalar(value);
  const field = key.split(".").pop() as string;
  let after: string;
  if (spec.file === PROFILES_FILE) {
    after = setYamlValue(before ?? "", ["profiles", name as string, field], scalar);
  } else if (key.startsWith("checks.")) {
    const exists = checksOf(projectDir).some((c) => String(c.name) === name);
    if (!exists && field !== "run") {
      return refuse(
        `Add the check first: specgate config set checks.${name}.run "<command>"`,
        `There is no check ${name} in ${HARNESS_FILE}.`
      );
    }
    after = setYamlListItem(
      before ?? "harness_version: 1\n",
      "checks",
      name as string,
      field,
      scalar
    );
  } else if (key.startsWith("alm.pr.")) {
    after = setYamlValue(before ?? "alm_version: 1\n", ["pr", field], scalar);
  } else if (key.startsWith("alm.")) {
    after = setYamlValue(before ?? "alm_version: 1\n", [field], scalar);
  } else {
    after = setYamlValue(before ?? "harness_version: 1\n", [key], scalar);
  }

  // Read back as the file's reader reads it: what it would refuse is not written.
  let parsed: Record<string, unknown>;
  try {
    parsed = (parseYamlLite(after) || {}) as Record<string, unknown>;
  } catch (err) {
    return refuse(
      `${spec.file} would not parse: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (spec.file === HARNESS_FILE) {
    const quality = readQuality(parsed);
    if (quality.errors.length > 0) return refuse(quality.errors[0]);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, after, "utf8");
  return { ok: true, file: spec.file, value };
}
