/**
 * The quality and security checks a team adds to the gate (ADR-0040).
 *
 * `harness.config.yaml` lists them under `checks:`; this module reads that
 * list, refuses what cannot be run safely, and says which checks a stage runs.
 * Pure: the caller hands the parsed YAML in.
 */

export type Stage = "attempt" | "end" | "ci";
export type Runner = "docker" | "local" | "auto";
export type ReportFormat = "jacoco" | "lcov" | "cobertura" | "pit" | "stryker";

export interface QualityCheck {
  name: string;
  /** The command, with `{req}`, `{base}`, `{changed_files}`… substituted. */
  run: string;
  when: Stage;
  /** false: reported, never fails the gate. */
  gate: boolean;
  runner: Runner;
  /** The image a `docker` runner uses. */
  image: string;
  /** false: `--network none`, for a tool that needs nothing from outside. */
  network: boolean;
  /** true: the command runs through `sh -c` in the container; false: as the image's arguments. */
  shell: boolean;
  /** Named volumes, `name:/path`, for a tool's cache. */
  volumes: string[];
  /** Environment variable names forwarded; values come from the environment only. */
  env: string[];
  timeout: number;
  /** SARIF the tool writes, project-relative. */
  sarif: string;
  /** A coverage or mutation report Specgate measures, `format:path`. */
  report: { format: ReportFormat; path: string } | null;
  /** `diff`: only findings in the files a change touched count; `all`: every new one. */
  scope: "diff" | "all";
  /** For `builtin:review` and `builtin:adversary`: the profile whose agent runs it. */
  profile: string;
}

export interface QualityConfig {
  level: "basic" | "strict" | "custom" | "";
  /** % of the changed executable lines a test runs; null: not measured. */
  diffCoverage: number | null;
  /** % of the mutants on changed lines a test kills; null: not measured. */
  mutationScore: number | null;
  checks: QualityCheck[];
  /** Conventional Commits types the `commits` check accepts beyond the defaults (REQ-234). */
  commitTypes: string[];
}

/** Checks Specgate runs itself, without a tool: `run: builtin:commits` (REQ-234). */
export const BUILTINS = ["builtin:commits", "builtin:sonar", "builtin:review", "builtin:adversary"];

/** Built-ins an agent performs: they run inside the harness only (REQ-227). */
export const AGENT_BUILTINS = ["builtin:review", "builtin:adversary"];

const STAGES: Stage[] = ["attempt", "end", "ci"];
const RUNNERS: Runner[] = ["docker", "local", "auto"];
const FORMATS: ReportFormat[] = ["jacoco", "lcov", "cobertura", "pit", "stryker"];
const CHECK_KEYS = new Set([
  "name",
  "run",
  "when",
  "gate",
  "runner",
  "image",
  "network",
  "shell",
  "volumes",
  "env",
  "timeout",
  "sarif",
  "report",
  "scope",
  "profile",
]);
/** The thresholds a level means when the file does not set one. */
const LEVEL_THRESHOLDS: Record<
  string,
  { diffCoverage: number | null; mutationScore: number | null }
> = {
  basic: { diffCoverage: 70, mutationScore: null },
  strict: { diffCoverage: 85, mutationScore: 70 },
};

const relative = (p: string) =>
  p !== "" && !/^([a-zA-Z]:)?[\\/]/.test(p) && !/(^|[\\/])\.\.([\\/]|$)/.test(p);

function list(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  return (Array.isArray(value) ? value : [value]).map((v) => String(v).trim()).filter(Boolean);
}

function percent(value: unknown, key: string, errors: string[]): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    errors.push(`\`${key}\` must be a percentage from 0 to 100, not "${String(value)}".`);
    return null;
  }
  return n;
}

/**
 * Read `quality`, `diff_coverage`, `mutation_score` and `checks` from the
 * parsed file. Every problem is returned, worded for the person who wrote it.
 */
export function readQuality(parsed: Record<string, unknown>): {
  config: QualityConfig;
  errors: string[];
} {
  const errors: string[] = [];
  const levelRaw = parsed.quality === undefined ? "" : String(parsed.quality).trim();
  const level = (
    ["basic", "strict", "custom", ""].includes(levelRaw) ? levelRaw : ""
  ) as QualityConfig["level"];
  if (levelRaw && !level) {
    errors.push(`\`quality: ${levelRaw}\` is not a level. Use basic, strict or custom.`);
  }
  const defaults = LEVEL_THRESHOLDS[level] || { diffCoverage: null, mutationScore: null };
  const diffCoverage = percent(parsed.diff_coverage, "diff_coverage", errors);
  const mutationScore = percent(parsed.mutation_score, "mutation_score", errors);

  const checks: QualityCheck[] = [];
  const raw = parsed.checks;
  if (raw !== undefined && !Array.isArray(raw)) {
    errors.push("`checks:` must be a list, each item starting with `- name:`.");
  }
  const seen = new Set<string>();
  for (const [i, item] of (Array.isArray(raw) ? raw : []).entries()) {
    const where = `checks[${i + 1}]`;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`${where} is not a mapping with name: and run:.`);
      continue;
    }
    const c = item as Record<string, unknown>;
    const unknown = Object.keys(c).filter((k) => !CHECK_KEYS.has(k));
    if (unknown.length) {
      errors.push(
        `${where}: unknown key(s) ${unknown.join(", ")}. Known: ${[...CHECK_KEYS].join(", ")}.`
      );
    }
    const name = String(c.name ?? "").trim();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
      errors.push(`${where}: \`name\` must be lowercase words with dashes, e.g. spotbugs.`);
    } else if (seen.has(name)) {
      errors.push(`${where}: the name ${name} is used twice.`);
    }
    seen.add(name);
    const run = String(c.run ?? "").trim();
    if (!run) errors.push(`${where} (${name}): \`run\` is the command; it is missing.`);
    const builtin = run.startsWith("builtin:");
    if (builtin && !BUILTINS.includes(run)) {
      errors.push(
        `${where} (${name}): ${run} is not a built-in check. Known: ${BUILTINS.join(", ")}.`
      );
    }
    const when = String(c.when ?? "attempt") as Stage;
    if (!STAGES.includes(when)) {
      errors.push(`${where} (${name}): \`when: ${String(c.when)}\` — use attempt, end or ci.`);
    }
    const runner = String(c.runner ?? "auto") as Runner;
    if (!RUNNERS.includes(runner)) {
      errors.push(
        `${where} (${name}): \`runner: ${String(c.runner)}\` — use docker, local or auto.`
      );
    }
    const image = String(c.image ?? "").trim();
    if (runner === "docker" && !image && !builtin) {
      errors.push(`${where} (${name}): \`runner: docker\` needs \`image:\`.`);
    }
    const env = list(c.env);
    for (const e of env) {
      if (e.includes("=")) {
        errors.push(
          `${where} (${name}): \`env\` lists names only — "${e.split("=")[0]}=…" would put a secret in the repository.`
        );
      } else if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(e)) {
        errors.push(`${where} (${name}): "${e}" is not an environment variable name.`);
      }
    }
    const volumes = list(c.volumes);
    for (const v of volumes) {
      if (!/^[a-z0-9][a-z0-9_.-]*:\/[^\s]*$/.test(v)) {
        errors.push(
          `${where} (${name}): volume "${v}" must be a named volume, name:/path — never a host folder.`
        );
      }
    }
    const sarif = String(c.sarif ?? "").trim();
    if (sarif && !relative(sarif)) {
      errors.push(`${where} (${name}): \`sarif\` must be a path inside the project.`);
    }
    let report: QualityCheck["report"] = null;
    if (c.report !== undefined) {
      const m = /^([a-z]+):(.+)$/.exec(String(c.report).trim());
      if (!m || !FORMATS.includes(m[1] as ReportFormat) || !relative(m[2].trim())) {
        errors.push(
          `${where} (${name}): \`report\` is format:path, the format one of ${FORMATS.join(", ")}, the path inside the project.`
        );
      } else report = { format: m[1] as ReportFormat, path: m[2].trim() };
    }
    const timeout = c.timeout === undefined ? 900 : Number(c.timeout);
    if (!Number.isInteger(timeout) || timeout < 1) {
      errors.push(`${where} (${name}): \`timeout\` is whole seconds.`);
    }
    const scope = String(c.scope ?? "diff");
    if (scope !== "diff" && scope !== "all") {
      errors.push(`${where} (${name}): \`scope\` is diff or all.`);
    }
    checks.push({
      name,
      run,
      when,
      gate: c.gate === undefined ? true : c.gate === true || c.gate === "true",
      runner,
      image,
      network: c.network === undefined ? true : c.network === true || c.network === "true",
      shell: c.shell === undefined ? true : c.shell === true || c.shell === "true",
      volumes,
      env,
      timeout: Number.isInteger(timeout) && timeout > 0 ? timeout : 900,
      sarif,
      report,
      scope: scope === "all" ? "all" : "diff",
      profile: String(c.profile ?? "").trim(),
    });
  }
  return {
    config: {
      level,
      diffCoverage: diffCoverage ?? defaults.diffCoverage,
      mutationScore: mutationScore ?? defaults.mutationScore,
      checks,
      commitTypes: list(parsed.commit_types),
    },
    errors,
  };
}

/**
 * The checks a stage runs. `check` and `done` run attempt and end; `--ci`
 * adds ci. The order is the file's: cheap first is the convention.
 */
export function checksFor(config: QualityConfig, stages: Stage[]): QualityCheck[] {
  return config.checks.filter((c) => stages.includes(c.when));
}

export interface CheckContext {
  req: string;
  base: string;
  changedFiles: string[];
  reportDir: string;
}

/** Java classes of changed `src/main/java` files, for PIT's targetClasses. */
export function changedClasses(files: string[]): string[] {
  return files
    .map((f) => /(?:^|\/)src\/main\/java\/(.+)\.java$/.exec(f.replace(/\\/g, "/")))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => m[1].replace(/\//g, "."));
}

/** Changed TypeScript/JavaScript sources, tests left out, for Stryker's --mutate. */
export function changedSources(files: string[]): string[] {
  return files.filter(
    (f) =>
      /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f) &&
      !/(\.|\/)(test|spec)\.|(^|\/)(tests?|__tests__|e2e)\//.test(f)
  );
}

/** The command with its placeholders filled. */
export function expandRun(run: string, ctx: CheckContext): string {
  const values: Record<string, string> = {
    "{req}": ctx.req,
    "{base}": ctx.base,
    "{changed_files}": ctx.changedFiles.join(" "),
    "{changed_classes}": changedClasses(ctx.changedFiles).join(","),
    "{changed_src}": changedSources(ctx.changedFiles).join(","),
    "{report_dir}": ctx.reportDir,
  };
  let out = run;
  for (const [k, v] of Object.entries(values)) out = out.split(k).join(v);
  return out;
}
