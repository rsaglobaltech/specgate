/**
 * What every E2E journey shares: installing the package, driving the installed
 * binary, fixtures and assertions. Plain Node, no dependencies.
 */

import { spawn, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const isWin = process.platform === "win32";

export function run(cmd, cmdArgs, opts = {}) {
  return spawnSync(cmd, cmdArgs, {
    encoding: "utf8",
    shell: isWin,
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  });
}

// ── Installing the package ───────────────────────────────────────────────────

/** `npm pack` this checkout, or use the tarball given. */
export function pack(sandbox, given) {
  if (given) return path.resolve(given);
  const out = path.join(sandbox, "pack");
  fs.mkdirSync(out, { recursive: true });
  const r = run("npm", ["pack", "--silent", "--pack-destination", out], { cwd: ROOT });
  if (r.status !== 0) throw new Error(`npm pack failed:\n${r.stdout}${r.stderr}`);
  return path.join(
    out,
    fs.readdirSync(out).find((f) => f.endsWith(".tgz"))
  );
}

/** Install the tarball into an empty directory; return the installed bin. */
export function install(sandbox, tarball) {
  const dir = path.join(sandbox, "cli");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"e2e-host","private":true}');
  const r = run("npm", ["install", "--silent", "--no-audit", "--no-fund", tarball], { cwd: dir });
  if (r.status !== 0) throw new Error(`npm install failed:\n${r.stdout}${r.stderr}`);
  const bin = path.join(dir, "node_modules", "@rsaglobaltech", "specgate", "bin", "specgate.js");
  if (!fs.existsSync(bin)) throw new Error("installed package has no bin/specgate.js");
  return bin;
}

/**
 * Start a stand-in server from e2e/fakes/<name>.mjs in its own process — the
 * journeys drive the CLI synchronously, so an in-process server could never
 * answer. Resolves once it prints `PORT <n>`.
 */
export function startFake(name) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, "e2e", "fakes", `${name}.mjs`)], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    let buf = "";
    child.stdout.on("data", (d) => {
      buf += d;
      const m = /PORT (\d+)/.exec(buf);
      if (!m) return;
      const url = `http://127.0.0.1:${m[1]}`;
      resolve({
        url,
        json: async (p, init) => {
          const r = await fetch(`${url}${p}`, init);
          return r.status === 204 ? null : r.json();
        },
        stop: () => child.kill("SIGTERM"),
      });
    });
    child.on("error", reject);
    setTimeout(() => reject(new Error(`fake ${name} did not start`)), 10000);
  });
}

export function versionOf(bin) {
  return JSON.parse(fs.readFileSync(path.join(path.dirname(bin), "..", "package.json"), "utf8"))
    .version;
}

// ── The context a journey receives ───────────────────────────────────────────

export class Skip extends Error {
  constructor(reason) {
    super(reason);
    this.skip = reason;
  }
}

export class Failure extends Error {}

/**
 * Everything a journey needs, bound to the installed binary.
 * `t.sg(cwd, ...args)` runs it the way a user would type it.
 */
export function context({ bin, sandbox, tarball, flags }) {
  const sg = (cwd, ...cliArgs) =>
    spawnSync(process.execPath, [bin, ...cliArgs], {
      cwd,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, NO_COLOR: "1" },
    });

  /**
   * The installed CLI with extra environment, e.g. a throwaway HOME; `__stdin`
   * in it is fed to the process instead.
   */
  const sgEnv = (cwd, { __stdin, ...env }, ...cliArgs) =>
    spawnSync(process.execPath, [bin, ...cliArgs], {
      cwd,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, NO_COLOR: "1", ...env },
      input: __stdin,
    });

  const expect = (cond, message, r) => {
    if (cond) return;
    const detail = r ? `\n--- exit ${r.status}\n${r.stdout}\n${r.stderr}` : "";
    throw new Failure(`${message}${detail}`);
  };
  const out = (r) => `${r.stdout}${r.stderr}`;

  const write = (dir, rel, content) => {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), "utf8");
  const exists = (dir, rel) => fs.existsSync(path.join(dir, rel));

  const git = (dir, ...gitArgs) => spawnSync("git", gitArgs, { cwd: dir, encoding: "utf8" });

  const t = {
    bin,
    sandbox,
    tarball,
    flags,
    sg,
    sgEnv,
    run,
    expect,
    out,
    ok: (r, what) => expect(r.status === 0, `${what} should exit 0`, r),
    fails: (r, what) => expect(r.status === 1, `${what} should exit 1`, r),
    usage: (r, what) => expect(r.status === 2, `${what} should exit 2`, r),
    json: (r) => {
      const s = r.stdout;
      return JSON.parse(s.slice(s.indexOf("{")));
    },
    write,
    read,
    exists,
    git,
    skip: (reason) => {
      throw new Skip(reason);
    },
    needsNetwork: () => {
      if (flags.skipNetwork) throw new Skip("--skip-network");
    },
    matrixRow: (dir, id) =>
      read(dir, "docs/specs/traceability.md")
        .split("\n")
        .find((l) => l.startsWith(`| ${id} |`)) || "",

    /** A small Node codebase: what `init` adopts. */
    nodeRepo: (dir) => {
      write(
        dir,
        "package.json",
        '{"name":"shop","version":"1.0.0","scripts":{"test":"node --test"}}'
      );
      write(
        dir,
        "src/orders/index.js",
        "module.exports = { total: (x) => Math.round(x * 100) / 100 };\n"
      );
      return dir;
    },

    /**
     * Rewrite the obligation `new` and `req add` write into one a person would
     * write: the gate refuses to deliver the template (#67).
     */
    realObligations: (dir) => {
      const files = ["spec.md"];
      const caps = path.join(dir, "docs/specs/capabilities");
      if (fs.existsSync(caps)) {
        for (const c of fs.readdirSync(caps)) files.push(`docs/specs/capabilities/${c}/spec.md`);
      }
      for (const rel of files) {
        if (!exists(dir, rel)) continue;
        const before = read(dir, rel);
        const after = before
          .replace(
            /^The system MUST satisfy: (.*)\.$/gm,
            "The system MUST make sure that $1, as observed by its users."
          )
          .replace(/^> Written by Specgate\. Replace this sentence.*$/gm, "");
        if (after !== before) write(dir, rel, after);
      }
    },

    /** Rewrite the <placeholder> steps `new` writes into a real scenario, and its obligation. */
    fillScenario: (dir, rel, steps) => {
      t.realObligations(dir);
      write(
        dir,
        rel,
        read(dir, rel)
          .replace("<the state before the action>", steps[0])
          .replace("<the action under test>", steps[1])
          .replace("<the observable outcome>", steps[2])
      );
    },

    /** `new`, the scenario filled in, and a test that names it: ready for `done`. */
    deliverable: (dir, title) => {
      const req = t.json(sg(dir, "new", title, "--json")).requirement;
      t.fillScenario(dir, req.featureFile, [
        `the system is ready for ${title.toLowerCase()}`,
        "the behaviour is exercised",
        "the outcome is observed",
      ]);
      write(dir, `test/${req.id.toLowerCase()}.test.js`, `// ${req.id} ${req.scenarioId}\n`);
      return req;
    },

    gitInit: (dir) => {
      git(dir, "init", "-q", "-b", "main");
      git(dir, "config", "user.email", "e2e@example.com");
      git(dir, "config", "user.name", "E2E");
      git(dir, "config", "commit.gpgsign", "false");
      git(dir, "add", "-A");
      git(dir, "commit", "-qm", "seed");
    },
  };
  return t;
}
