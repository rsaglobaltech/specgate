import { quoteArg } from "../../../lib/escape";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

/**
 * forja, the project generator Specgate calls (ADR-0033).
 *
 * Specgate is the one command a user learns; forja stays its own package, so
 * Specgate keeps zero runtime dependencies: it is fetched with `npx` only when
 * someone asks for a generated project. The major version is pinned here and
 * moved in Specgate's own releases.
 */
export const FORJA_PACKAGE = "@rsaglobaltech/forja";
export const FORJA_VERSION = "1";

/** Whether a `forja` command is on the PATH: installed globally or linked. */
export function forjaOnPath(): boolean {
  const finder = process.platform === "win32" ? "where" : "which";
  const found = spawnSync(finder, ["forja"], { stdio: "ignore" });
  return !found.error && found.status === 0;
}

/**
 * The command line that runs forja (REQ-236): `SPECGATE_FORJA_CMD` — a forja
 * of your own, or a fake one in tests — then a `forja` on the PATH, then npx
 * at the pinned major.
 */
export function forjaCommand(
  env: NodeJS.ProcessEnv = process.env,
  onPath: boolean = forjaOnPath()
): string {
  const override = (env.SPECGATE_FORJA_CMD || "").trim();
  if (override) return override;
  return onPath ? "forja" : `npx --yes ${FORJA_PACKAGE}@${FORJA_VERSION}`;
}

/**
 * Before npx runs: whether npm has the package at all. npm's own 404 says
 * nothing about installing forja or about SPECGATE_FORJA_CMD; null when it
 * can be fetched, else what npm said.
 */
export function forjaUnavailable(command: string): string | null {
  if (!command.startsWith("npx ")) return null;
  const view = spawnSync("npm", ["view", `${FORJA_PACKAGE}@${FORJA_VERSION}`, "version"], {
    shell: true,
    encoding: "utf8",
    timeout: 30000,
  });
  if (!view.error && view.status === 0 && (view.stdout || "").trim()) return null;
  return (`${view.stderr || ""}${view.stdout || ""}`.trim().split("\n")[0] || "no answer").trim();
}

/** Quotes one argument for the shell the command runs in. */
const quote = (arg: string): string => quoteArg(arg);

/** This Specgate's version, from its own package.json; "" when it cannot be read. */
export function ownVersion(): string {
  let dir = __dirname;
  for (;;) {
    const file = path.join(dir, "package.json");
    if (fs.existsSync(file)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
        if (pkg.name === "@rsaglobaltech/specgate") return String(pkg.version || "");
      } catch {
        /* not ours: keep going up */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return "";
    dir = parent;
  }
}

/** This Specgate's own command, bin/specgate.js; "" when it cannot be found (REQ-651). */
export function ownCli(): string {
  let dir = __dirname;
  for (;;) {
    const pkg = path.join(dir, "package.json");
    if (fs.existsSync(pkg)) {
      try {
        if (JSON.parse(fs.readFileSync(pkg, "utf8")).name === "@rsaglobaltech/specgate")
          return path.join(dir, "bin", "specgate.js");
      } catch {
        /* not ours: keep going up */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return "";
    dir = parent;
  }
}

/** forja's environment: ours, plus the Specgate it should depend on (REQ-236). */
function forjaEnv(): NodeJS.ProcessEnv {
  const version = ownVersion();
  return version ? { ...process.env, SPECGATE_VERSION: version } : process.env;
}

/** Runs forja with its own terminal: it has prompts and a spinner of its own. */
export function runForja(args: string[], cwd: string): number {
  const line = [forjaCommand(), ...args.map(quote)].join(" ");
  const run = spawnSync(line, { cwd, shell: true, stdio: "inherit", env: forjaEnv() });
  if (run.error) return 127;
  return run.status ?? 1;
}

/** The same, capturing what forja printed: for `--json`, where stdout is one document. */
export function runForjaCaptured(args: string[], cwd: string): { status: number; output: string } {
  const line = [forjaCommand(), ...args.map(quote)].join(" ");
  const run = spawnSync(line, {
    cwd,
    shell: true,
    env: forjaEnv(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    status: run.error ? 127 : (run.status ?? 1),
    output: `${run.stdout || ""}${run.stderr || ""}`.trim(),
  };
}

/** The nearest directory, from `from` up, holding a forja.config.json. */
export function findForjaProject(from: string): string | null {
  let dir = path.resolve(from);
  for (;;) {
    if (fs.existsSync(path.join(dir, "forja.config.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * The gate's commands of a project forja generated (REQ-651): its tests, and
 * its architecture check — what forja's own "next steps" told the person to
 * set by hand. Node: the package manager forja used, on the scripts it wrote;
 * Java: the wrapper it wrote (ArchUnit runs with the tests). Null for none.
 */
export function forjaGateCommands(dir: string): { test: string | null; arch: string | null } {
  const read = (f: string) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    } catch {
      return null;
    }
  };
  const config = read("forja.config.json") || {};
  if (config.backend === "spring" || config.backend === "quarkus") {
    const test = fs.existsSync(path.join(dir, "mvnw"))
      ? "./mvnw -q test"
      : fs.existsSync(path.join(dir, "gradlew"))
        ? "./gradlew test"
        : null;
    return { test, arch: null };
  }
  const scripts = (read("package.json") || {}).scripts || {};
  const pm = ["npm", "pnpm", "bun"].includes(config.pm) ? config.pm : "npm";
  const runs = (name: string) => (pm === "bun" ? `bun run ${name}` : `${pm} run ${name}`);
  return {
    test: scripts.test ? (pm === "bun" ? "bun run test" : `${pm} test`) : null,
    arch: scripts.arch ? runs("arch") : null,
  };
}

/**
 * After forja (REQ-651): the project adopts Specgate, its gate gets the test
 * and architecture commands, and both are committed — so the first
 * requirement is built and proved, never left unverified. Each step said.
 */
export function wireForjaProject(
  dir: string,
  cli: string,
  log: (msg: string) => void = () => undefined
): {
  adopted: boolean;
  test: string | null;
  arch: string | null;
  bdd: boolean;
  committed: boolean;
} {
  const specgate = (...args: string[]) =>
    spawnSync(process.execPath, [cli, ...args], { cwd: dir, encoding: "utf8" });
  let adopted = false;
  if (!fs.existsSync(path.join(dir, "spec.md"))) {
    const r = specgate("adopt", "--no-capabilities", "--yes");
    adopted = r.status === 0;
    log(adopted ? "Specgate adopted in the generated project." : "specgate adopt did not finish.");
  }
  const { test, arch } = forjaGateCommands(dir);
  if (test) {
    specgate("config", "set", "test_cmd", test);
    log(`The gate runs the tests: ${test}`);
  }
  if (arch) {
    specgate("config", "set", "arch_cmd", arch);
    log(`The gate checks the architecture: ${arch}`);
  }
  // bdd-gate REQ-663: the scenarios run before any code — forja's test:bdd, required by the gate.
  const bdd = specgate("migrate", "bdd").status === 0;
  if (bdd) log("The gate runs the scenarios before any code: bdd required.");
  let committed = false;
  const git = (...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  if (git("rev-parse", "--git-dir").status === 0 && git("status", "--porcelain").stdout.trim()) {
    git("add", "-A");
    committed =
      git(
        "commit",
        "-q",
        "-m",
        "chore: adopt Specgate, with the gate's test, architecture and scenario commands"
      ).status === 0;
    if (committed) log("Committed: the project is ready to draft and build.");
  }
  return { adopted, test, arch, bdd, committed };
}
