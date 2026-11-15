/**
 * The workspace after the second microservices run of 1.0.0-rc.2
 * (REQ-360..367, REQ-344 modified): the stories of the brief proposed by an
 * agent, each criterion given to its repositories, a story's questions kept
 * apart, the business layer kept free of technique, every author told of the
 * story, and a requirement that waits for what it depends on.
 *
 * Every test builds real repositories in a temp folder, each with its own git
 * identity (CI runners have none), and drives the CLI the way a person would.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(
  __dirname.split(/[\\/]tests(?:[\\/]|$)/)[0].replace(/[\\/]dist$/, "")
);
const CLI = path.join(ROOT_DIR, "bin", "specgate.js");

const made: string[] = [];
test.after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

function tmp(prefix = "specgate-rc3-"): string {
  const d = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  made.push(d);
  return d;
}

function sg(cwd: string, args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", ...env },
  });
}

function git(dir: string, ...args: string[]) {
  return spawnSync("git", args, { cwd: dir, encoding: "utf8" });
}

function gitRepo(dir: string) {
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@t");
  git(dir, "config", "user.name", "t");
}

function commit(dir: string, msg = "work") {
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", msg);
}

const out = (r: { stdout: string; stderr: string }) => r.stdout + r.stderr;
const lf = (t: string) => t.replace(/\r\n/g, "\n");

/** A member repository: a Specgate project with git and its own identity. */
function member(root: string, folder: string): string {
  const tmpOut = path.join(root, `.init-${folder}`);
  const r = sg(root, ["init", "--yes", "--out", tmpOut, "--no-git", "--keep-matrix"]);
  assert.equal(r.status, 0, out(r));
  const dir = path.join(root, folder);
  fs.renameSync(path.join(tmpOut, "my-spec-driven-app"), dir);
  fs.rmSync(tmpOut, { recursive: true, force: true });
  gitRepo(dir);
  commit(dir, "seed");
  return dir;
}

const BRIEF = [
  "# Proyecto: control de flota",
  "",
  "El cliente quiere un Panel del Cliente donde ver su envío en tiempo real.",
  "",
].join("\n");

const STORIES_FM =
  "stories:\n  - { id: follow-shipment, title: El cliente sigue su envío, repos: [fleet, tracking] }\n";

/** Members fleet and tracking (and contracts when asked), and a workspace holding the brief. */
function product(withContracts = false) {
  const root = tmp();
  const fleet = member(root, "fleet");
  const tracking = member(root, "tracking");
  const repos = ["--repo", "fleet=../fleet", "--repo", "tracking=../tracking"];
  if (withContracts) {
    member(root, "contracts");
    repos.push("--repo", "contracts=../contracts:contracts");
  }
  const ws = path.join(root, "ws");
  fs.mkdirSync(ws);
  gitRepo(ws);
  fs.writeFileSync(path.join(ws, "brief.md"), BRIEF, "utf8");
  const r = sg(ws, ["workspace", "init", "--name", "truck-flote", ...repos]);
  assert.equal(r.status, 0, out(r));
  commit(ws, "the brief and the workspace");
  return { root, ws, fleet, tracking };
}

const storyFile = (ws: string) => path.join(ws, "docs", "stories", "follow-shipment", "story.md");

/** follow-shipment named in the brief and its story written by hand. */
function drafted(
  ws: string,
  criteria = ["AC-1: El cliente ve el camión que lleva su envío."],
  map = ""
) {
  assert.equal(sg(ws, ["workspace", "draft"]).status, 0);
  const file = path.join(ws, "docs", "brief.md");
  fs.writeFileSync(
    file,
    fs.readFileSync(file, "utf8").replace(/^stories:.*$/m, STORIES_FM.trimEnd()),
    "utf8"
  );
  const r = sg(ws, ["workspace", "draft", "follow-shipment"]);
  assert.equal(r.status, 0, out(r));
  const s = fs.readFileSync(storyFile(ws), "utf8");
  let text = s
    .replace(/## Intent\n\n<!--[^]*?-->\n/, "## Intent\n\nEl cliente ve dónde está su envío.\n")
    .replace(
      /## Acceptance criteria\n\n<!--[^]*?-->\n(- AC-1:\n)?/,
      "## Acceptance criteria\n\n" + criteria.map((c) => `- ${c}`).join("\n") + "\n"
    );
  if (map) text = text.replace(/## Repositories\n[^]*$/, `## Repositories\n\n${map}\n`);
  fs.writeFileSync(storyFile(ws), text, "utf8");
  commit(ws, "the story drafted");
}

/** A delta adding requirements to a member's sub-change. */
function delta(dir: string, reqs: Array<{ id: string; extra?: string }>) {
  const cap = path.join(dir, "docs", "specs", "changes", "follow-shipment", "specs", "shipments");
  fs.mkdirSync(cap, { recursive: true });
  const blocks = reqs.flatMap(({ id, extra = "" }) => {
    const n = id.slice(4);
    return [
      `### Requirement: ${id} — The client follows their shipment ${n}`,
      "",
      `The system SHALL show the client the truck's last position ${n}.`,
      "",
      `#### Scenario: SCN-${n} — The client opens the tracking ${n}`,
      "",
      "- GIVEN shipment ENV-1 is on truck TRK-1",
      "- WHEN the client opens its tracking",
      "- THEN they see TRK-1's last position",
      "",
      `<!-- specgate:trace actor=Client kind=functional feature=features/shipments/${id}.feature${extra} -->`,
      "",
    ];
  });
  fs.writeFileSync(
    path.join(cap, "spec.md"),
    ["# Delta — shipments", "", "## ADDED Requirements", "", ...blocks].join("\n")
  );
}

const discover = (dir: string) =>
  fs.readFileSync(
    path.join(dir, "docs", "specs", "changes", "follow-shipment", "discover.md"),
    "utf8"
  );

/** A small agent script, written outside every repository. */
function agent(root: string, name: string, lines: string[]): string {
  const dir = path.join(root, "agents");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, lines.join("\n") + "\n", "utf8");
  return `node "${file}" {prompt_file}`;
}

// ── REQ-360 ──────────────────────────────────────────────────────────────────

test("REQ-360 SCN-360a: the agent names follow-shipment", () => {
  const { root, ws } = product();
  assert.equal(sg(ws, ["workspace", "draft"]).status, 0);
  commit(ws, "the brief below its front matter");
  const file = path.join(ws, "docs", "brief.md");
  const body = lf(fs.readFileSync(file, "utf8")).replace(/^---\n[^]*?\n---\n/, "");

  const cmd = agent(root, "stories.js", [
    "const fs = require('fs');",
    "const prompt = fs.readFileSync(process.argv[2], 'utf8');",
    "if (!prompt.includes('Panel del Cliente')) process.exit(3);",
    "const f = 'docs/brief.md';",
    "let t = fs.readFileSync(f, 'utf8');",
    "t = t.replace(/^stories: \\[\\]$/m, 'stories:\\n  # check: fleet or tracking first?\\n  - { id: follow-shipment, title: El cliente sigue su envío, repos: [fleet, tracking] }');",
    "fs.writeFileSync(f, t + '\\nthe agent rewrote the brief\\n');",
  ]);
  const r = sg(ws, ["workspace", "draft", "--agent", cmd, "--json"]);
  assert.equal(r.status, 0, out(r));
  const stories = JSON.parse(r.stdout).workspace.stories;
  assert.equal(stories[0].id, "follow-shipment", r.stdout);
  assert.deepEqual(stories[0].repos, ["fleet", "tracking"]);
  const after = lf(fs.readFileSync(file, "utf8"));
  assert.match(after, /# check: fleet or tracking first\?/);
  assert.equal(after.replace(/^---\n[^]*?\n---\n/, ""), body, "the client's text is put back");

  commit(ws, "stories named");
  const again = sg(ws, ["workspace", "draft", "--agent", cmd]);
  assert.notEqual(again.status, 0, "--agent with stories named and no id is refused");
  assert.match(out(again), /workspace draft follow-shipment --agent/);
});

// ── REQ-361 ──────────────────────────────────────────────────────────────────

test("REQ-361 SCN-361a: fleet answers AC-1, tracking AC-2", () => {
  const { ws, fleet, tracking } = product();
  drafted(
    ws,
    ["AC-1: El cliente ve sus envíos.", "AC-2: El cliente ve la posición del camión."],
    "- `fleet`: AC-1\n- `tracking`: AC-2"
  );
  const r = sg(ws, ["workspace", "propose", "follow-shipment"]);
  assert.equal(r.status, 0, out(r));
  const f = discover(fleet);
  assert.match(f, /## This repository's part/);
  assert.match(f, /answers AC-1/);
  assert.match(f, /`tracking`: AC-2/);
  const t = discover(tracking);
  assert.match(t, /answers AC-2/);
  assert.match(t, /`fleet`: AC-1/);

  // The drafting agent is asked for the map: a stand-in keeps its prompt.
  const kept = path.join(path.dirname(ws), "prompt.txt");
  const cmd = agent(path.dirname(ws), "keep.js", [
    "const fs = require('fs');",
    `fs.copyFileSync(process.argv[2], ${JSON.stringify(kept)});`,
  ]);
  const again = sg(ws, ["workspace", "draft", "follow-shipment", "--agent", cmd]);
  assert.equal(again.status, 0, out(again));
  assert.match(fs.readFileSync(kept, "utf8"), /the criteria it answers/i);
});

// ── REQ-362 ──────────────────────────────────────────────────────────────────

test("REQ-362 SCN-362a: AC-3 is nobody's, AC-1 is twice", () => {
  const { ws, fleet, tracking } = product();
  drafted(
    ws,
    [
      "AC-1: El cliente ve sus envíos.",
      "AC-2: El cliente ve la posición.",
      "AC-3: El cliente ve la hora.",
    ],
    "- `fleet`: AC-1\n- `tracking`: AC-1, AC-2"
  );
  assert.equal(sg(ws, ["workspace", "propose", "follow-shipment"]).status, 0);
  for (const d of [fleet, tracking, ws]) commit(d, "proposed");
  const r = sg(ws, ["workspace", "check", "--json"]);
  const doc = JSON.parse(r.stdout);
  const warnings = doc.workspace.warnings || [];
  const codes = warnings.map((w: { code: string }) => w.code);
  assert.ok(codes.includes("workspace_criterion_unanswered"), r.stdout);
  assert.ok(codes.includes("workspace_criterion_shared"), r.stdout);
  const un = warnings.find((w: { code: string }) => w.code === "workspace_criterion_unanswered");
  assert.match(un.message, /AC-3/);
  const sh = warnings.find((w: { code: string }) => w.code === "workspace_criterion_shared");
  assert.match(sh.message, /AC-1/);
  assert.match(sh.message, /fleet/);
  assert.match(sh.message, /tracking/);
});

// ── REQ-363 ──────────────────────────────────────────────────────────────────

test("REQ-363 SCN-363a: Q1 is open", () => {
  const { ws, fleet } = product();
  drafted(ws);
  const q = path.join(ws, "docs", "stories", "follow-shipment", "questions.md");
  assert.ok(fs.existsSync(q), "the story's questions file is scaffolded");
  fs.writeFileSync(
    q,
    [
      "# Questions — follow-shipment",
      "",
      "| # | Question | Blocks | Answer |",
      "|---|---|---|---|",
      "| Q1 | ¿Cada cuánto ve el cliente una posición nueva? | AC-1 | |",
      "",
    ].join("\n"),
    "utf8"
  );
  commit(ws, "a question");
  const first = sg(ws, ["workspace", "propose", "follow-shipment"]);
  assert.notEqual(first.status, 0, out(first));
  assert.match(out(first), /workspace_story_questions_open/);
  assert.match(out(first), /Q1/);
  assert.ok(!fs.existsSync(path.join(fleet, "docs", "specs", "changes", "follow-shipment")));

  fs.writeFileSync(
    q,
    fs.readFileSync(q, "utf8").replace("| AC-1 | |", "| AC-1 | Cada 10 segundos. |"),
    "utf8"
  );
  commit(ws, "answered");
  const second = sg(ws, ["workspace", "propose", "follow-shipment"]);
  assert.equal(second.status, 0, out(second));
  assert.ok(fs.existsSync(path.join(fleet, "docs", "specs", "changes", "follow-shipment")));
});

test("REQ-363 SCN-363a: --allow-open-questions proposes anyway", () => {
  const { ws, fleet } = product();
  drafted(ws);
  const q = path.join(ws, "docs", "stories", "follow-shipment", "questions.md");
  fs.writeFileSync(
    q,
    "| # | Question | Blocks | Answer |\n|---|---|---|---|\n| Q1 | ¿Cuánto? | AC-1 | |\n",
    "utf8"
  );
  commit(ws, "a question");
  const r = sg(ws, ["workspace", "propose", "follow-shipment", "--allow-open-questions"]);
  assert.equal(r.status, 0, out(r));
  assert.ok(fs.existsSync(path.join(fleet, "docs", "specs", "changes", "follow-shipment")));
});

// ── REQ-364 ──────────────────────────────────────────────────────────────────

test("REQ-364 SCN-364a: the agent fills Intent and criteria", () => {
  const { root, ws } = product();
  assert.equal(sg(ws, ["workspace", "draft"]).status, 0);
  const file = path.join(ws, "docs", "brief.md");
  fs.writeFileSync(
    file,
    fs.readFileSync(file, "utf8").replace(/^stories:.*$/m, STORIES_FM.trimEnd()),
    "utf8"
  );
  commit(ws, "stories named");
  const cmd = agent(root, "fill.js", [
    "const fs = require('fs');",
    "const f = 'docs/stories/follow-shipment/story.md';",
    "let t = fs.readFileSync(f, 'utf8');",
    "t = t.replace(/(## Intent\\n\\n<!--[^]*?-->\\n)/, '$1\\nEl cliente ve su envío.\\n');",
    "t = t.replace(/- AC-1:\\n/, '- AC-1: El cliente ve el camión.\\n');",
    "fs.writeFileSync(f, t);",
  ]);
  const r = sg(ws, ["workspace", "draft", "follow-shipment", "--agent", cmd]);
  assert.equal(r.status, 0, out(r));
  const story = lf(fs.readFileSync(storyFile(ws), "utf8"));
  assert.match(story, /El cliente ve su envío/);
  assert.match(story, /AC-1: El cliente ve el camión/);
  const head = story.split("## Repositories")[0];
  assert.doesNotMatch(head, /<!--/, story);
});

// ── REQ-365 / REQ-344 ────────────────────────────────────────────────────────

test("REQ-365 SCN-365a: follow-shipment proposed with a contracts repository", () => {
  const { ws, fleet } = product(true);
  drafted(ws);
  assert.equal(sg(ws, ["workspace", "propose", "follow-shipment"]).status, 0);
  commit(fleet, "proposed");
  const r = sg(fleet, ["change", "validate", "follow-shipment", "--json"]);
  assert.doesNotMatch(r.stdout, /layer_discover_technical/, r.stdout);
  assert.doesNotMatch(discover(fleet), /api=|depends=/);
  const design = fs.readFileSync(
    path.join(fleet, "docs", "specs", "changes", "follow-shipment", "design.md"),
    "utf8"
  );
  assert.match(design, /depends=tracking:REQ-NNN/);
  assert.match(design, /api=/);
  assert.match(discover(fleet), /`tracking`/, "the Discover still names the other repositories");
});

// ── REQ-366 ──────────────────────────────────────────────────────────────────

test("REQ-366 SCN-366a: tracking's delta is written after fleet's", () => {
  const { ws, fleet, tracking } = product();
  drafted(ws);
  assert.equal(sg(ws, ["workspace", "propose", "follow-shipment"]).status, 0);
  delta(fleet, [{ id: "REQ-003" }]);
  for (const d of [fleet, tracking, ws]) commit(d, "follow-shipment");
  assert.ok(
    fs.existsSync(path.join(tracking, "docs", "specs", "changes", "follow-shipment", "story.json")),
    "the sub-change knows its workspace"
  );
  const r = sg(tracking, [
    "change",
    "author",
    "follow-shipment",
    "--artifact",
    "specs",
    "--agent",
    "node -e 0 {prompt_file}",
    "--dry-run",
  ]);
  assert.equal(r.status, 0, out(r));
  assert.match(r.stdout, /fleet:REQ-003/);
  assert.match(r.stdout, /depends=/);
});

// ── REQ-367 ──────────────────────────────────────────────────────────────────

test("REQ-367 SCN-367a: tracking's REQ-005 waits on fleet's REQ-003, which fails", () => {
  const { root, ws, fleet, tracking } = product();
  drafted(ws);
  assert.equal(sg(ws, ["workspace", "propose", "follow-shipment"]).status, 0);
  delta(fleet, [{ id: "REQ-003" }]);
  delta(tracking, [{ id: "REQ-005", extra: " depends=fleet:REQ-003" }, { id: "REQ-006" }]);
  for (const d of [fleet, tracking]) {
    commit(d, "follow-shipment");
    const a = sg(d, ["change", "approve", "follow-shipment"]);
    assert.equal(a.status, 0, out(a));
    commit(d, "approved");
  }
  commit(ws, "proposed");
  // An agent that writes nothing: no requirement is delivered.
  const noop = agent(root, "noop.js", ["process.exit(0);"]);
  const r = sg(ws, [
    "workspace",
    "harness",
    "run",
    "--story",
    "follow-shipment",
    "--",
    "--agent",
    noop,
    "--max-attempts",
    "1",
    "--setup-cmd",
    "none",
  ]);
  assert.equal(r.status, 1, out(r));
  assert.match(
    out(r),
    /REQ-005[^\n]*waiting[^\n]*fleet:REQ-003|waiting[^\n]*REQ-005[^\n]*fleet:REQ-003/
  );
  const log = fs.readFileSync(
    path.join(ws, ".specgate", "workspace-runs", "follow-shipment", "tracking.log"),
    "utf8"
  );
  assert.match(log, /REQ-006/);
  assert.doesNotMatch(log, /REQ-005/, "the waiting requirement is not started");
});
