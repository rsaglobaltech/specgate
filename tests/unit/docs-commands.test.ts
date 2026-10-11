"use strict";

/**
 * Every `specgate …` the guides tell a reader to type, against the CLI.
 *
 * ## What is being protected
 *
 * The journeys under `docs/start/` have their own recorder and their own
 * check (`docs-journey.test.ts`). The rest of the guides had none, and an
 * audit at 0.18.0 found the Advanced section quietly teaching flags and
 * sub-commands the CLI had dropped or never had — `change archive --yes`,
 * `specops add --no-examples`, a `--project-dir` that `check` refuses. This
 * reads every fenced bash block and every inline code span in the published
 * guides, and fails when a command, a sub-command or a flag is not in that
 * command's own `--help` — which is exactly what a reader checks when it
 * does not work.
 *
 * Left out on purpose: `docs/projects/` (what the pilots actually ran, at the
 * version they ran), `docs/specs/` (design records), and the changelog.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../../..");
const DOCS = path.join(ROOT, "docs");
const CLI = path.join(ROOT, "bin", "specgate.js");

const { SURFACE } = require("../../scripts/lib/surface");

const SKIP_DIRS = new Set(["projects", "specs", "diagrams", "assets"]);

/**
 * Flags a command accepts that its `--help` does not list. Each is a gap in
 * the help text, logged in mejoras/specgate-defectos.md, not a licence to
 * document more of them.
 */
const UNLISTED = new Set(["validate --json", "init --pack"]);

function guides(dir: string = DOCS, rel = ""): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!rel && SKIP_DIRS.has(entry.name)) continue;
      out.push(...guides(path.join(dir, entry.name), relPath));
    } else if (entry.name.endsWith(".md")) {
      out.push(relPath);
    }
  }
  return out.sort();
}

/** `specgate <argv…>` per line of a bash block or inline code span. */
function invocations(): Array<{ page: string; argv: string[] }> {
  const out: Array<{ page: string; argv: string[] }> = [];
  for (const page of guides()) {
    const text = fs.readFileSync(path.join(DOCS, page), "utf8");
    const snippets = [
      ...[...text.matchAll(/```(?:bash|sh|shell)\n([\s\S]*?)```/g)].flatMap((m) =>
        // A trailing backslash continues the command on the next line.
        m[1].replace(/\\\n\s*/g, " ").split("\n")
      ),
      ...[...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]),
    ];
    for (const raw of snippets) {
      // A shell comment is prose: "# you install it; specgate never does".
      const line = raw.replace(/(^|\s)#.*$/, "");
      const m =
        /(?:^|\s)(?:npx (?:--yes )?@rsaglobaltech\/specgate@[\w.]+|specgate)\s+([^|&]*)/.exec(line);
      if (!m) continue;
      // Quoted arguments are one token: a flag inside a quoted test command is not ours.
      const argv = m[1].match(/"[^"]*"|'[^']*'|\S+/g) || [];
      if (argv.length > 0) out.push({ page, argv });
    }
  }
  return out;
}

test("every command and flag the guides tell you to type exists", () => {
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

  const problems = new Set<string>();
  const found = invocations();
  for (const { page, argv } of found) {
    const [name, maybeSub] = argv;
    if (name.startsWith("-")) continue; // `specgate --help`
    // Prose like "`specgate` is a CLI" or a placeholder like `specgate <command>`.
    if (!/^[a-z][a-z-]*$/.test(name)) continue;
    if (!subs.has(name)) {
      problems.add(`${page}: \`specgate ${name}\` is not a command`);
      continue;
    }
    const known = subs.get(name) as string[];
    const command = known.length > 0 && known.includes(maybeSub) ? [name, maybeSub] : [name];
    const text = help(command);
    const flags = argv
      .filter((a) => /^--[a-z]/.test(a))
      .map((a) => a.split("=")[0].replace(/["')]+$/, ""));
    for (const flag of flags) {
      if (flag === "--help" || UNLISTED.has(`${command.join(" ")} ${flag}`)) continue;
      if (!text.includes(flag))
        problems.add(`${page}: \`specgate ${command.join(" ")}\` has no ${flag}`);
    }
  }
  assert.ok(
    found.length >= 200,
    `only ${found.length} invocations found — the scanner lost its way`
  );
  assert.deepEqual([...problems], [], [...problems].join("\n"));
});
