"use strict";

/**
 * The getting-started journeys under `docs/start/`.
 *
 * ## What is being protected
 *
 * These pages are the first thing a newcomer types along with. Every output
 * they show is recorded from the CLI by `npm run docs:journey`, and
 * `npm run docs:journey:check` re-runs the whole journey and diffs — but that
 * takes a build and a minute, so it runs at release. What runs on every commit
 * is this file: the drift that hurts a newcomer most is a command or a flag
 * the page tells them to type that the CLI no longer accepts, and a block the
 * recorder no longer fills.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../../..");
const DOCS = path.join(ROOT, "docs");
const CLI = path.join(ROOT, "bin", "specgate.js");

const { JOURNEYS, blockName, displayCommand } = require("../../scripts/docs/journey-storyboard");
const { readBlock } = require("../../scripts/docs/blocks");
const { SURFACE } = require("../../scripts/lib/surface");
const { NAV } = require("../../scripts/docs/nav");

const START = path.join(DOCS, "start");
const PAGES: string[] = fs
  .readdirSync(START)
  .filter((f: string) => f.endsWith(".md"))
  .sort()
  .map((f: string) => `start/${f.slice(0, -3)}`);
const read = (slug: string) => fs.readFileSync(path.join(DOCS, `${slug}.md`), "utf8");
const STEPS = JOURNEYS.flatMap((j: any) => j.steps);

test("each journey has five phases, one page each, in order", () => {
  for (const journey of JOURNEYS) {
    const pages = PAGES.filter((p) => p.startsWith(`start/${journey.id}-`));
    assert.equal(
      pages.length,
      5,
      `${journey.id}: expected five phase pages, found ${pages.length}`
    );
    pages.forEach((p, i) => {
      assert.ok(p.startsWith(`start/${journey.id}-${i + 1}-`), `${p} is out of sequence`);
      const next = pages[i + 1];
      if (next) {
        assert.ok(
          read(p).includes(`](${next.slice("start/".length)}.md)`),
          `${p} does not link to the next phase, ${next}`
        );
      }
    });
  }
});

test("every step's output block is on its page and filled in", () => {
  for (const step of STEPS) {
    assert.ok(PAGES.includes(step.page), `${step.id}: ${step.page}.md is not a journey page`);
    const block = readBlock(read(step.page), blockName(step));
    assert.ok(
      block,
      `${step.page}.md has no ${blockName(step)} block — run \`npm run docs:journey\``
    );
    assert.ok(
      block.startsWith(`\`\`\`text\n$ ${displayCommand(step)}\n`),
      `${step.id}: the block is not a transcript of \`${displayCommand(step)}\``
    );
    assert.ok(block.endsWith("```"), `${step.id}: the block's fence is not closed`);
  }
});

test("no page carries an output block the recorder no longer writes", () => {
  const known = new Set(STEPS.map((s: any) => blockName(s)));
  for (const page of PAGES) {
    for (const m of read(page).matchAll(/<!-- csda:(out-[a-z0-9-]+):begin/g)) {
      assert.ok(known.has(m[1]), `${page}.md: ${m[1]} is not a step of any journey`);
    }
  }
});

test("every recorded step runs a command this CLI has", () => {
  const labels = new Set<string>();
  for (const command of SURFACE) {
    labels.add(command.name);
    for (const sub of command.subcommands || []) labels.add(`${command.name} ${sub.name}`);
  }
  for (const step of STEPS) {
    if (!step.surface) continue;
    assert.ok(
      labels.has(step.surface),
      `${step.id}: \`specgate ${step.surface}\` is not a command`
    );
    assert.ok(
      displayCommand(step).startsWith(`specgate ${step.surface}`),
      `${step.id}: the declared surface and the command disagree`
    );
  }
});

/**
 * Every `specgate …` a reader is told to type, with its flags.
 *
 * Read from fenced bash blocks and inline code; the recorded blocks are
 * covered above. Each flag must appear in that command's own `--help`, which
 * is exactly what a reader would check when it did not work.
 */
function invocations(): Array<{ page: string; argv: string[] }> {
  const out: Array<{ page: string; argv: string[] }> = [];
  for (const page of [...PAGES, "getting-started"]) {
    const text = read(page);
    const snippets = [
      ...[...text.matchAll(/```bash\n([\s\S]*?)```/g)].flatMap((m) => m[1].split("\n")),
      ...[...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]),
    ];
    for (const line of snippets) {
      const m = /(?:^|\s)(?:npx @rsaglobaltech\/specgate@latest|specgate)\s+([^#|&]*)/.exec(line);
      if (!m) continue;
      // Quoted arguments are one token: a flag inside a quoted test command is not ours.
      const argv = m[1].match(/"[^"]*"|'[^']*'|\S+/g) || [];
      if (argv.length > 0) out.push({ page, argv });
    }
  }
  return out;
}

test("every command and flag the journey tells you to type exists", () => {
  const subs = new Map<string, string[]>();
  for (const c of SURFACE)
    subs.set(
      c.name,
      (c.subcommands || []).map((s: any) => s.name)
    );
  const helps = new Map<string, string>();
  const help = (argv: string[]) => {
    const key = argv.join(" ");
    if (!helps.has(key)) {
      const r = spawnSync(process.execPath, [CLI, ...argv, "--help"], { encoding: "utf8" });
      helps.set(key, `${r.stdout}${r.stderr}`);
    }
    return helps.get(key) as string;
  };

  const problems: string[] = [];
  const found = invocations();
  for (const { page, argv } of found) {
    const [name, maybeSub] = argv;
    if (name.startsWith("-")) continue; // `specgate --help`
    if (!subs.has(name)) {
      problems.push(`${page}: \`specgate ${name}\` is not a command`);
      continue;
    }
    const known = subs.get(name) as string[];
    const command = known.length > 0 && known.includes(maybeSub) ? [name, maybeSub] : [name];
    if (known.length > 0 && command.length === 1 && name !== "ci" && name !== "agents") {
      problems.push(`${page}: \`specgate ${argv.join(" ")}\` names no sub-command of ${name}`);
      continue;
    }
    const text = help(command);
    for (const flag of argv.filter((a) => /^--[a-z]/.test(a)).map((a) => a.split("=")[0])) {
      if (!text.includes(flag))
        problems.push(`${page}: \`specgate ${command.join(" ")}\` has no ${flag}`);
    }
  }
  assert.ok(
    found.length >= 30,
    `only ${found.length} invocations found — the scanner lost its way`
  );
  assert.deepEqual(problems, [], problems.join("\n"));
});

test("the sidebar's Start section walks both journeys in order", () => {
  const start = NAV.find((s: any) => s.title === "Start");
  assert.ok(start, "no Start section");
  const slugs = start.entries.map((e: any) => e.slug);
  assert.equal(slugs[0], "getting-started");
  assert.deepEqual(
    slugs.filter((s: string) => s.startsWith("start/")),
    JOURNEYS.flatMap((j: any) => PAGES.filter((p) => p.startsWith(`start/${j.id}-`))),
    "every journey page, in phase order, belongs in the Start section"
  );
});
