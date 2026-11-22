#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { resolveProjectDir } from "./lib/project-root";
import { agentIo, wantsJson } from "./lib/agent";
import { error } from "./lib/diagnostics";
import { briefModel } from "./lib/brief-model";
import { exportBoards, type BoardTemplates } from "../packages/core/src/domain/DddToolboxExport";

export const EXPORT_DIR = path.join("docs", "brief", "ddd-toolbox");

/** The record templates DDD Toolbox saved itself: its file format, data only. */
function templates(): BoardTemplates {
  const roots = [path.join(__dirname, ".."), path.join(__dirname, "..", "..")];
  for (const r of roots) {
    const f = path.join(r, "templates", "ddd-toolbox", "records.json");
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8")) as BoardTemplates;
  }
  throw new Error("templates/ddd-toolbox/records.json is missing from this specgate");
}

/** `specgate brief export [--out <dir>] [--json]` (brief-domain-views REQ-659). */
export function briefExportCommand(argv: string[]): void {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(
      "Usage:\n  specgate brief export [--out <dir>] [--project-dir <path>] [--json]\n\n" +
        "The domain model as boards DDD Toolbox opens (File › Open): a Bounded Context Canvas\n" +
        "per context, an Event Storming board of every flow, a Domain Storytelling board per\n" +
        `story. Written to ${EXPORT_DIR.split(path.sep).join("/")} unless --out names a folder.\n`
    );
    process.exit(0);
  }
  const io = agentIo(wantsJson(argv));
  const shape = { export: null };
  const opt = (name: string) => {
    const at = argv.indexOf(name);
    return at >= 0 ? argv[at + 1] : undefined;
  };
  let dir: string;
  try {
    dir = resolveProjectDir(opt("--project-dir") || ".");
  } catch (err) {
    io.usage(shape, [
      error("project_not_found", (err as Error).message, { fix: "Pass --project-dir." }),
    ]);
    return;
  }
  const model = briefModel(dir);
  if (model.modules.length === 0) {
    io.fail(shape, [
      error(
        "brief_export_empty",
        "No context to export: no workshop model and no requirement yet.",
        {
          fix: "Import a workshop (specgate brief import) or draft a module first.",
        }
      ),
    ]);
    return;
  }
  const out = path.resolve(dir, opt("--out") || EXPORT_DIR);
  fs.mkdirSync(out, { recursive: true });
  const written: string[] = [];
  for (const b of exportBoards(model, templates())) {
    const file = path.join(out, b.file);
    fs.writeFileSync(file, JSON.stringify(b.board), "utf8");
    written.push(path.relative(dir, file).split(path.sep).join("/"));
  }
  io.emit({ export: { source: model.source, written } }, () =>
    process.stdout.write(
      `${written.length} boards for DDD Toolbox (File › Open):\n` +
        written.map((w) => `  ${w}\n`).join("")
    )
  );
}

if (require.main === module) briefExportCommand(process.argv.slice(2));
