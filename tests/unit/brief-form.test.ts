/**
 * studio-json-gaps: the brief as a form, each field with its line (REQ-486);
 * the form written back keeping every other byte (REQ-487); and a client's
 * text outside the project proposed as a form, nothing written inside it
 * (REQ-488).
 */
import test = require("node:test");
import assert = require("node:assert/strict");
import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ROOT_DIR, runCli } from "../helpers/cli";
import * as api from "../../scripts/api";
import { briefForm as studioBriefForm, saveBriefForm } from "../../scripts/lib/studio-route";

const FIXTURE = path.join(ROOT_DIR, "e2e", "studio", "fixture");

/** A project made by `specgate init`, with `brief` as docs/brief.md when given. */
function project(brief?: string): string {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "sg-brief-form-"));
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
  if (brief !== undefined) fs.writeFileSync(path.join(dir, "docs", "brief.md"), brief);
  return dir;
}

const cleanup = (dir: string) => fs.rmSync(path.dirname(dir), { recursive: true, force: true });
const briefOf = (dir: string) => fs.readFileSync(path.join(dir, "docs", "brief.md"), "utf8");

function form(dir: string, ...extra: string[]) {
  const r = runCli(["propose", "--from-brief", "--form", ...extra, "--json", "--project-dir", dir]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return JSON.parse(r.stdout);
}

const BRIEF = [
  "---", // 1
  "product: Tienda", // 2
  "surfaces: [api]", // 3
  "actors:", // 4
  "  - { name: Customer, surfaces: [api] }", // 5
  "modules: [orders, payments]", // 6
  "---", // 7
  "", // 8
  "# Brief", // 9
  "", // 10
  "## Module: orders", // 11
  "", // 12
  "Rules", // 13
  "- An order has at least 1 item.", // 14
  "", // 15
  "Examples", // 16
  "- The one where Customer orders 2 books.", // 17
  "", // 18
  "## Notes from the call", // 19
  "The client wants it before the summer.", // 20
  "",
].join("\n");

test("REQ-486 SCN-486a: the form gives each field with its line, payments with no section, and writes nothing", async () => {
  const dir = project(BRIEF);
  try {
    const answer = form(dir);
    const f = answer.form;
    assert.equal(f.brief, "docs/brief.md");
    assert.equal(f.exists, true);
    assert.equal(f.eol, "lf");
    assert.deepEqual(f.frontMatter.product, { value: "Tienda", line: 2 });
    assert.deepEqual(f.frontMatter.surfaces, { value: ["api"], line: 3 });
    assert.deepEqual(f.frontMatter.actors, {
      value: [{ name: "Customer", surfaces: ["api"], line: 5 }],
      line: 4,
    });
    assert.deepEqual(f.frontMatter.modules, { value: ["orders", "payments"], line: 6 });
    const [orders, payments] = f.modules;
    assert.equal(orders.key, "orders");
    assert.equal(orders.section, "module");
    assert.equal(orders.line, 11);
    assert.deepEqual(orders.rules, [{ text: "An order has at least 1 item.", line: 14 }]);
    assert.deepEqual(orders.examples, [
      { text: "The one where Customer orders 2 books.", line: 17 },
    ]);
    assert.deepEqual(payments, {
      key: "payments",
      listed: true,
      name: "payments",
      section: null,
      line: null,
      prose: { text: "", line: null },
      rules: [],
      examples: [],
      questions: [],
    });
    // The brief's findings come with it: payments has no section.
    assert.ok(
      answer.status.some((d: { code: string }) => d.code === "B3_no_section"),
      JSON.stringify(answer.status)
    );
    assert.equal(briefOf(dir), BRIEF, "docs/brief.md is unchanged");
    // The API answers the same.
    assert.deepEqual(await api.briefForm(dir), answer);
  } finally {
    cleanup(dir);
  }
});

test("REQ-486: a project with no brief answers an empty form, exists false", () => {
  const dir = project();
  try {
    fs.rmSync(path.join(dir, "docs", "brief.md"), { force: true });
    const f = form(dir).form;
    assert.equal(f.exists, false);
    assert.deepEqual(f.modules, []);
    assert.equal(f.frontMatter.line, null);
    assert.equal(fs.existsSync(path.join(dir, "docs", "brief.md")), false);
  } finally {
    cleanup(dir);
  }
});

const CRLF_BRIEF = [
  "---",
  'product: "Tienda"',
  "surfaces: [api]",
  "actors:",
  "  # Customers order through the API.",
  "  - { name: Customer, surfaces: [api] }",
  "modules: [orders, payments]",
  "---",
  "",
  "# Brief",
  "",
  "## Context",
  "",
  "",
  "",
  "A small shop.   ",
  "",
  "## Module: orders",
  "",
  "**Rules**",
  "",
  "- An order has at least 1 item.",
  "",
  "**Examples**",
  "",
  "- The one where Customer orders 2 books.",
  "",
  "## Module: payments",
  "",
  "Rules",
  "",
  "- A payment is made in EUR.",
  "",
  "Examples",
  "",
  "- The one where Customer pays 10 EUR.",
  "",
  "",
  "A note the client added at the end.",
  "",
  "",
].join("\r\n");

test("REQ-487 SCN-487a: a rule added to a CRLF brief: CRLF kept, every byte outside orders' section as it was", () => {
  const dir = project(CRLF_BRIEF);
  try {
    const read = form(dir).form;
    assert.equal(read.eol, "crlf");
    // Written back with no change: identical, byte for byte.
    const file = path.join(path.dirname(dir), "form.json");
    fs.writeFileSync(file, JSON.stringify(read));
    const same = form(dir, file).form;
    assert.equal(same.written, false);
    assert.equal(briefOf(dir), CRLF_BRIEF);

    const orders = read.modules.find((m: { key: string }) => m.key === "orders");
    orders.rules.push({ text: "An order is cancelled up to 24 hours after it is placed." });
    fs.writeFileSync(file, JSON.stringify({ form: read }));
    const written = form(dir, file).form;
    assert.equal(written.written, true);
    const out = briefOf(dir);
    assert.match(out, /- An order is cancelled up to 24 hours after it is placed\.\r\n/);
    assert.doesNotMatch(out, /(?<!\r)\n/, "every line still ends in CRLF");
    const start = CRLF_BRIEF.indexOf("## Module: orders");
    const end = CRLF_BRIEF.indexOf("\r\n\r\n## Module: payments");
    assert.ok(out.startsWith(CRLF_BRIEF.slice(0, start)), "everything before orders, as it was");
    assert.ok(out.endsWith(CRLF_BRIEF.slice(end)), "everything after orders, as it was");
    assert.deepEqual(
      written.modules
        .find((m: { key: string }) => m.key === "orders")
        .rules.map((c: { text: string }) => c.text),
      ["An order has at least 1 item.", "An order is cancelled up to 24 hours after it is placed."]
    );
  } finally {
    cleanup(dir);
  }
});

test("REQ-487: the form from standard input and from the API; a module removed loses its section only", async () => {
  const dir = project(CRLF_BRIEF);
  try {
    const read = (await api.briefForm(dir)).form;
    const answer = await api.writeBriefForm(dir, read);
    assert.equal(answer.form.written, false);
    assert.equal(briefOf(dir), CRLF_BRIEF);

    const withoutPayments = {
      ...read,
      modules: read.modules.filter((m) => m.key !== "payments"),
    };
    const r = cp.spawnSync(
      process.execPath,
      [
        path.join(ROOT_DIR, "bin", "specgate.js"),
        "propose",
        "--from-brief",
        "--form",
        "-",
        "--json",
        "--project-dir",
        dir,
      ],
      { input: JSON.stringify(withoutPayments), encoding: "utf8" }
    );
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const out = briefOf(dir);
    assert.match(out, /^modules: \[orders\]\r$/m);
    assert.doesNotMatch(out, /## Module: payments/);
    assert.ok(out.includes("## Context\r\n\r\n\r\n\r\nA small shop.   \r\n"), "Context as it was");
    assert.ok(out.includes("  # Customers order through the API.\r\n"), "the author's note kept");
    assert.ok(out.includes('product: "Tienda"\r\n'), "an unchanged field is not rewritten");
  } finally {
    cleanup(dir);
  }
});

test("REQ-487: what is not a form is refused, and the brief is left alone", async () => {
  const dir = project(BRIEF);
  try {
    const file = path.join(path.dirname(dir), "bad.json");
    fs.writeFileSync(file, JSON.stringify({ modules: "orders" }));
    const r = runCli(["propose", "--from-brief", "--form", file, "--json", "--project-dir", dir]);
    assert.equal(r.status, 1);
    assert.equal(JSON.parse(r.stdout).status[0].code, "brief_form_invalid");
    await assert.rejects(api.writeBriefForm(dir, {} as never), { code: "brief_form_invalid" });
    assert.equal(briefOf(dir), BRIEF);
  } finally {
    cleanup(dir);
  }
});

test("REQ-487: the studio's own save uses the same code — a CRLF brief stays CRLF", () => {
  const dir = project(CRLF_BRIEF);
  try {
    const f = studioBriefForm(dir);
    saveBriefForm(dir, f);
    assert.equal(briefOf(dir), CRLF_BRIEF, "saved unchanged, identical");
    f.modules.find((m) => m.key === "payments")!.questions = ["Can a customer pay in USD?"];
    saveBriefForm(dir, f);
    const out = briefOf(dir);
    assert.match(out, /- Can a customer pay in USD\?\r\n/);
    assert.doesNotMatch(out, /(?<!\r)\n/);
    assert.ok(out.endsWith("A note the client added at the end.\r\n\r\n"), out.slice(-80));
  } finally {
    cleanup(dir);
  }
});

// ── REQ-488 ─────────────────────────────────────────────────────────────────

/** A stand-in agent: proposes a front matter whose actor uses mobile, which surfaces lacks. */
const PROPOSER = `
const fs = require("fs");
const file = process.env.BRIEF_FILE;
const prompt = fs.readFileSync(0, "utf8");
if (!prompt.includes(file)) process.exit(3);
const text = fs.readFileSync(file, "utf8");
const fm = "---\\nproduct: Bookshop\\nsurfaces: [api]\\nactors:\\n  - { name: Reader, surfaces: [api, mobile] }\\nmodules: [orders, payments]\\n---\\n\\n";
fs.writeFileSync(file, fm + text);
`;

/** Every file of the project but .git, with its bytes. */
function snapshot(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === ".git") continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.set(path.relative(dir, p), fs.readFileSync(p, "base64"));
    }
  };
  walk(dir);
  return out;
}

test("REQ-488 SCN-488a: a client's text outside the project: the proposed form, its problem, nothing written inside", () => {
  const dir = project(BRIEF);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "sg-client-text-"));
  try {
    const git = (...args: string[]) =>
      cp.spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], {
        cwd: dir,
        encoding: "utf8",
      });
    git("init", "-q");
    git("add", "-A");
    git("commit", "-q", "-m", "start");
    const clientText = path.join(outside, "client.md");
    fs.writeFileSync(
      clientText,
      "Readers order books on the phone and pay by card.\nAn order has at least one book.\n"
    );
    const stub = path.join(outside, "agent.js");
    fs.writeFileSync(stub, PROPOSER);
    const files = snapshot(dir);
    const status = git("status", "--porcelain", "--untracked-files=all").stdout;

    const r = runCli(
      [
        "propose",
        "--from-brief",
        "--brief",
        clientText,
        "--agent",
        `"${process.execPath}" "${stub}"`,
        "--json",
        "--project-dir",
        dir,
      ],
      { env: { ...process.env, BRIEF_FILE: clientText } }
    );
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const answer = JSON.parse(r.stdout);
    assert.equal(answer.form.exists, true);
    assert.equal(answer.form.frontMatter.product.value, "Bookshop");
    assert.deepEqual(answer.form.frontMatter.modules.value, ["orders", "payments"]);
    assert.deepEqual(
      answer.form.modules.map((m: { key: string }) => m.key),
      ["orders", "payments"]
    );
    assert.ok(
      answer.status.some((d: { code: string }) => d.code === "brief_surface_not_in_product"),
      JSON.stringify(answer.status)
    );
    assert.equal(fs.existsSync(path.join(dir, "docs", "specs", "BRIEF-SETUP.md")), false);
    assert.deepEqual(snapshot(dir), files, "no file of the project written, created or removed");
    assert.equal(git("status", "--porcelain", "--untracked-files=all").stdout, status);
  } finally {
    cleanup(dir);
    fs.rmSync(outside, { recursive: true, force: true });
  }
});
