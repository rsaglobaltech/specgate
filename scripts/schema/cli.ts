#!/usr/bin/env node
/**
 * `specgate schema init | fork | validate | which` — inspect and override the
 * artefact graph a change follows.
 *
 * Most teams never touch this. It exists because "which artefacts does a
 * change produce?" is a house style, not a law, and hardcoding one answer is
 * how a tool acquires a reputation for ceremony.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { resolveProjectDir } from "../lib/project-root";
import { error, warning, diagnostic, errorMessage } from "../lib/diagnostics";
import { agentIo, wantsJson, EXIT, AgentIo } from "../lib/agent";
import {
  BUILT_IN,
  SCHEMA_DIR,
  SCHEMA_FILE,
  toYaml,
  validateSchema,
  resolveSchema,
  listSchemas,
} from "./registry";
import type { ArtifactSchema } from "./registry";

function usage() {
  process.stdout.write(
    "Usage:\n" +
      "  specgate schema which [<name>]        where a schema comes from, and its graph\n" +
      "  specgate schema init <name>           write a new schema from the default\n" +
      "  specgate schema fork <from> <to>      copy a built-in into the project to edit\n" +
      "  specgate schema validate [<name>]     check a schema's graph is sound\n\n" +
      `Built-in: ${Object.keys(BUILT_IN).join(", ")}\n` +
      `Project schemas live in ${SCHEMA_DIR}/<name>/${SCHEMA_FILE}.\n`
  );
}

export function schemaPath(projectDir: string, name: string): string {
  return path.join(projectDir, SCHEMA_DIR, name, SCHEMA_FILE);
}

export function writeSchema(projectDir: string, name: string, schema: ArtifactSchema): string {
  const file = schemaPath(projectDir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, toYaml({ ...schema, name }), "utf8");
  return path.join(SCHEMA_DIR, name, SCHEMA_FILE);
}

export function main(argv: string[]): void {
  const io: AgentIo = agentIo(wantsJson(argv));
  const NULL_SHAPE = { schema: null };
  const args = argv.filter((a) => a !== "--json");

  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    usage();
    process.exit(args.length === 0 ? EXIT.USAGE : EXIT.OK);
  }

  let projectDirArg = ".";
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--project-dir" && args[i + 1]) projectDirArg = args[++i];
    else if (!args[i].startsWith("-")) positional.push(args[i]);
  }

  let projectDir;
  try {
    projectDir = resolveProjectDir(projectDirArg);
  } catch (err) {
    io.usage(NULL_SHAPE, [
      error("project_not_found", errorMessage(err), {
        fix: "Run from inside a spec-driven project, or pass --project-dir.",
      }),
    ]);
  }

  const [action, ...rest] = positional;

  if (action === "which") {
    const name = rest[0] || "spec-driven";
    const found = resolveSchema(projectDir, name);
    if (!found) {
      io.fail(NULL_SHAPE, [
        error("schema_not_found", `No schema named "${name}".`, {
          target: name,
          fix: `Available: ${listSchemas(projectDir).join(", ")}.`,
        }),
      ]);
    }
    return io.emit(
      {
        schema: { ...found.schema, source: found.source, path: found.path },
        available: listSchemas(projectDir),
      },
      () => {
        process.stdout.write(`\n  ${found.schema.name}  (${found.source})\n`);
        if (found.path) process.stdout.write(`  ${found.path}\n`);
        process.stdout.write(`\n  ${found.schema.description || ""}\n\n`);
        for (const a of found.schema.artifacts) {
          const deps = a.requires.length ? `  ← ${a.requires.join(", ")}` : "";
          process.stdout.write(`    ${a.id.padEnd(10)} ${a.generates}${deps}\n`);
        }
        process.stdout.write(`\n  Available: ${listSchemas(projectDir).join(", ")}\n\n`);
      }
    );
  }

  if (action === "init" || action === "fork") {
    // `init` starts from the default; `fork` names the schema to copy.
    const from = action === "fork" ? rest[0] : "spec-driven";
    const to = action === "fork" ? rest[1] : rest[0];

    if (!to) {
      io.usage(NULL_SHAPE, [
        error("schema_name_required", "Name the schema to create.", {
          fix:
            action === "fork"
              ? "specgate schema fork spec-driven my-flow"
              : "specgate schema init my-flow",
        }),
      ]);
    }

    const source = resolveSchema(projectDir, from);
    if (!source) {
      io.fail(NULL_SHAPE, [
        error("schema_not_found", `No schema named "${from}" to copy.`, {
          target: from,
          fix: `Available: ${listSchemas(projectDir).join(", ")}.`,
        }),
      ]);
    }

    const dest = schemaPath(projectDir, to);
    if (fs.existsSync(dest)) {
      io.fail(NULL_SHAPE, [
        error("schema_exists", `${path.join(SCHEMA_DIR, to, SCHEMA_FILE)} already exists.`, {
          target: to,
          fix: "Edit it, or choose another name.",
        }),
      ]);
    }

    const written = writeSchema(projectDir, to, source.schema);
    return io.emit({ schema: { name: to, path: written, from } }, () =>
      process.stdout.write(
        `\n  ✔  ${to} written to ${written}\n     copied from ${from} (${source.source})\n\n` +
          `  Use it: specgate propose <id> --schema ${to}\n\n`
      )
    );
  }

  if (action === "validate") {
    const name = rest[0] || "spec-driven";
    const found = resolveSchema(projectDir, name);
    if (!found) {
      io.fail(NULL_SHAPE, [
        error("schema_not_found", `No schema named "${name}".`, {
          target: name,
          fix: `Available: ${listSchemas(projectDir).join(", ")}.`,
        }),
      ]);
    }

    const problems = validateSchema(found.schema);
    const diagnostics = problems.map((p) =>
      diagnostic("error", p.code, p.message, {
        ...(p.target ? { target: p.target } : {}),
        fix: FIXES[p.code] || "Correct the schema file and re-run.",
      })
    );

    if (found.source === "built-in") {
      diagnostics.push(
        warning("schema_is_built_in", `"${name}" is built in — there is nothing to edit yet.`, {
          fix: `specgate schema fork ${name} my-${name}`,
        })
      );
    }

    return io.emitAndGate(
      {
        schema: { name: found.schema.name, source: found.source, path: found.path },
        status: diagnostics,
      },
      () => {
        if (problems.length === 0) {
          process.stdout.write(`\n  ✔  ${name} is a sound graph (${found.source})\n\n`);
          return;
        }
        process.stdout.write(`\n  ✖  ${name} has ${problems.length} problem(s)\n\n`);
        for (const p of problems) process.stdout.write(`    ${p.message}\n`);
        process.stdout.write("\n");
      }
    );
  }

  io.usage(NULL_SHAPE, [
    error("schema_action_unknown", `Unknown action: ${action}.`, {
      target: action,
      fix: "Use one of: which, init, fork, validate.",
    }),
  ]);
}

export const FIXES: Record<string, string> = {
  schema_no_name: "Add a top-level `name:` line.",
  schema_no_artifacts: "Declare at least one entry under `artifacts:`.",
  artifact_no_id: "Every artifact needs an `id`.",
  artifact_duplicate_id: "Rename one of the two — ids identify an artifact.",
  artifact_no_output: "Add a `generates:` path or glob.",
  artifact_unknown_dependency:
    "Declare the artifact it requires, or drop the dependency. A dependency on something that does not exist marks every dependent artifact blocked forever.",
  artifact_cycle: "Break the cycle — the graph has to be acyclic to be orderable.",
};

if (require.main === module) main(process.argv.slice(2));
