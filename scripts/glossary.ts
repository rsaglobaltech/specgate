#!/usr/bin/env node

/**
 * \`specgate glossary [--write]\` (REQ-595) — the names the project already uses
 * (its actors, its domain model's entities) that docs/specs/glossary.md does
 * not define yet. With --write, each becomes a row of the table, its
 * Definition and Avoid left for a person to fill.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProjectDir } from "./lib/project-root";
import { agentIo, wantsJson, EXIT } from "./lib/agent";
import { error } from "./lib/diagnostics";
import { glossaryCandidates } from "./lib/domain-docs";
import {
  GLOSSARY_FILE,
  glossaryTemplate,
  parseGlossary,
  suggestTerms,
  withTerms,
} from "../packages/core/src/domain/Glossary";
import * as ui from "./lib/ui";

function usage(): void {
  process.stdout.write(
    "Usage:\n" +
      "  specgate glossary [--write] [--project-dir <path>] [--json]\n\n" +
      "Lists the names the project already uses — its actors, the entities of its\n" +
      "domain model — that docs/specs/glossary.md does not define yet. With --write,\n" +
      "each becomes a row of the table, its Definition and Avoid left to fill.\n"
  );
}

export function main(argv: string[]): void {
  if (argv.includes("--help") || argv.includes("-h")) {
    usage();
    process.exit(EXIT.OK);
  }
  const io = agentIo(wantsJson(argv));
  const shape = { glossary: null };
  let projectDir = ".";
  let write = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--project-dir" && argv[i + 1]) projectDir = argv[++i];
    else if (a === "--write") write = true;
    else if (a === "--json") continue;
    else if (a === "--format") i += 1;
    else {
      io.usage(shape, [
        error("usage", `Unknown argument: ${a}`, { fix: "specgate glossary --help" }),
      ]);
    }
  }
  let dir = "";
  try {
    dir = resolveProjectDir(projectDir, { requireSentinel: true });
  } catch (err) {
    io.fail(shape, [
      error("no_project", err instanceof Error ? err.message : String(err), {
        fix: "Run from inside a spec-driven project, or pass --project-dir.",
      }),
    ]);
  }
  const file = path.join(dir, GLOSSARY_FILE);
  const md = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : glossaryTemplate();
  const terms = parseGlossary(md);
  const suggested = suggestTerms(terms, glossaryCandidates(dir));
  if (write && suggested.length > 0) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      withTerms(
        md,
        suggested.map((s) => s.term)
      ),
      "utf8"
    );
  }
  io.emit(
    {
      glossary: {
        file: GLOSSARY_FILE,
        terms: terms.map((t) => t.term),
        suggested,
        written: write && suggested.length > 0,
      },
    },
    () => {
      process.stdout.write(ui.header("glossary", `${terms.length} term(s) defined`));
      if (suggested.length === 0) {
        process.stdout.write(ui.ok("Every actor and entity the project names has its term."));
        return;
      }
      for (const s of suggested) {
        process.stdout.write(`    ${s.term}  ${ui.muted(`(${s.from})`)}\n`);
      }
      process.stdout.write(
        "\n" +
          (write
            ? ui.ok(
                `Added ${suggested.length} row(s) to ${GLOSSARY_FILE}: write each Definition, and the words to Avoid.`
              )
            : ui.info(
                `Not in ${GLOSSARY_FILE} yet. \`specgate glossary --write\` adds them as rows to fill.`
              ))
      );
    }
  );
  process.exit(EXIT.OK);
}

if (require.main === module) main(process.argv.slice(2));
