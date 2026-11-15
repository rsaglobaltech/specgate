/**
 * specgate-api: status, questions and matrix in-process from
 * `@rsaglobaltech/specgate/api`, answering what `--json` prints, reading only
 * (REQ-466 … REQ-469).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ROOT_DIR, runCli } from "../helpers/cli";
import * as api from "../../scripts/api";

const FIXTURE = path.join(ROOT_DIR, "e2e", "studio", "fixture");

/** `specgate init` from the studio's fixture, with the draft `draft-orders` (Q2 blocks REQ-003). */
function shop(): string {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "sg-api-"));
  const init = runCli([
    "init",
    "--config",
    path.join(FIXTURE, "project.yaml"),
    "--out",
    parent,
    "--no-git",
    "--no-agents",
    "--no-ci",
  ]);
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const dir = path.join(parent, "my-spec-driven-app");
  fs.cpSync(
    path.join(FIXTURE, "draft-orders"),
    path.join(dir, "docs", "specs", "changes", "draft-orders"),
    { recursive: true }
  );
  return dir;
}

/** What `specgate <args> --json` prints for the project, parsed. */
function json(dir: string, ...args: string[]): unknown {
  const r = runCli([...args, "--json", "--project-dir", dir]);
  return JSON.parse(r.stdout);
}

/** Every file of the project with its bytes, to tell that nothing was written. */
function snapshot(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.set(path.relative(dir, p), fs.readFileSync(p, "base64"));
    }
  };
  walk(dir);
  return out;
}

/**
 * Runs `read` with every way of starting a process made to throw, but one:
 * `git ls-files`, which only reads which files the project tracks.
 */
async function withoutProcesses<T>(read: () => Promise<T>): Promise<T> {
  // The module itself: `import * as` gives a copy whose properties only read.
  const mod = require("node:child_process") as Record<string, unknown>;
  const names = ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"];
  const saved = names.map((n) => mod[n]);
  names.forEach((n, i) => {
    mod[n] = (command: string, args: readonly string[] = [], ...rest: unknown[]) => {
      if (n === "spawnSync" && command === "git" && args[0] === "ls-files") {
        return (saved[i] as (...a: unknown[]) => unknown)(command, args, ...rest);
      }
      throw new Error(`the API started a process: ${n} ${command} ${args.join(" ")}`);
    };
  });
  try {
    return await read();
  } finally {
    names.forEach((n, i) => (mod[n] = saved[i]));
  }
}

const cleanup = (dir: string) => fs.rmSync(path.dirname(dir), { recursive: true, force: true });

test("REQ-466 SCN-466a: questions in-process equal `specgate questions --json`; Q2 names draft-orders and blocks REQ-003", async () => {
  const dir = shop();
  try {
    const inProcess = await api.questions(dir);
    assert.deepEqual(inProcess, json(dir, "questions"));
    const q2 = inProcess.questions.open.find((q) => q.id === "Q2");
    assert.ok(q2, JSON.stringify(inProcess));
    assert.equal(q2.change, "draft-orders");
    assert.deepEqual(q2.blocks, ["REQ-003"]);
  } finally {
    cleanup(dir);
  }
});

test("REQ-466: status equals `specgate status --json`, and matrix equals `specgate matrix --json --dry-run`", async () => {
  const dir = shop();
  try {
    assert.deepEqual(await api.status(dir), json(dir, "status"));
    assert.deepEqual(await api.matrix(dir), json(dir, "matrix", "--dry-run"));
  } finally {
    cleanup(dir);
  }
});

test("REQ-467 SCN-467a: matrix on a derived matrix behind its specs counts the derived rows; nothing written, no process but git ls-files", async () => {
  const dir = shop();
  try {
    const trace = path.join(dir, "docs", "specs", "traceability.md");
    if (!fs.readFileSync(trace, "utf8").includes("specgate:derived")) {
      const m = runCli(["matrix", "--migrate", "--project-dir", dir]);
      assert.equal(m.status, 0, m.stdout + m.stderr);
    }
    const before = (await api.matrix(dir)).matrix.rows as number;
    fs.appendFileSync(
      path.join(dir, "spec.md"),
      "\n### Requirement: REQ-900 — Cancel an order\n\nThe system SHALL let a customer cancel an order.\n\n" +
        "<!-- specgate:trace status=Draft actor=Customer kind=functional -->\n"
    );
    const files = snapshot(dir);
    const answer = await withoutProcesses(() => api.matrix(dir));
    assert.equal(answer.matrix.derived, true);
    assert.equal(answer.matrix.written, false);
    assert.equal(answer.matrix.rows, before + 1);
    await withoutProcesses(() => api.status(dir));
    await withoutProcesses(() => api.questions(dir));
    assert.deepEqual(snapshot(dir), files, "no file of the project changed");
  } finally {
    cleanup(dir);
  }
});

test("REQ-468 SCN-468a: a strict TypeScript program imports the API from the package; package.json and deep paths still resolve", () => {
  const app = fs.mkdtempSync(path.join(os.tmpdir(), "sg-api-ts-"));
  try {
    const scope = path.join(app, "node_modules", "@rsaglobaltech");
    fs.mkdirSync(scope, { recursive: true });
    fs.symlinkSync(ROOT_DIR, path.join(scope, "specgate"), "junction");
    fs.writeFileSync(
      path.join(app, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          module: "node16",
          moduleResolution: "node16",
          target: "ES2022",
          noEmit: true,
          types: [],
        },
        files: ["app.ts"],
      })
    );
    fs.writeFileSync(
      path.join(app, "app.ts"),
      'import { questions, API_VERSION, type QuestionsAnswer } from "@rsaglobaltech/specgate/api";\n' +
        "const v: string = API_VERSION;\n" +
        "async function blocks(dir: string): Promise<string[]> {\n" +
        "  const a: QuestionsAnswer = await questions(dir);\n" +
        "  return a.questions.open.flatMap((q) => q.blocks).concat(v);\n" +
        "}\n" +
        "export { blocks };\n"
    );
    const tsc = cp.spawnSync(
      process.execPath,
      [path.join(ROOT_DIR, "node_modules", "typescript", "bin", "tsc"), "-p", app],
      { encoding: "utf8" }
    );
    assert.equal(tsc.status, 0, tsc.stdout + tsc.stderr);
    const node = cp.spawnSync(
      process.execPath,
      [
        "-e",
        "const r = (p) => require.resolve(p);\n" +
          'r("@rsaglobaltech/specgate/package.json");\n' +
          'r("@rsaglobaltech/specgate/dist/scripts/lib/ui.js");\n' +
          'r("@rsaglobaltech/specgate/bin/specgate.js");\n' +
          'process.stdout.write(require("@rsaglobaltech/specgate/api").API_VERSION);',
      ],
      { cwd: app, encoding: "utf8" }
    );
    assert.equal(node.status, 0, node.stderr);
    assert.equal(node.stdout, "1.0.0");
  } finally {
    fs.rmSync(app, { recursive: true, force: true });
  }
});

test("REQ-469 SCN-469a: status on an empty folder rejects with not_a_project, the folder, and the fix specgate init", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sg-api-empty-"));
  try {
    await assert.rejects(api.status(dir), (e: unknown) => {
      const err = e as { code?: string; message?: string; fix?: string };
      assert.equal(err.code, "not_a_project");
      assert.ok(err.message?.includes(path.basename(dir)), err.message ?? "");
      assert.equal(err.fix, "specgate init");
      return true;
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
