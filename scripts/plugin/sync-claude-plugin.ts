#!/usr/bin/env node
/**
 * `npm run plugin:sync` — write the Claude Code plugin the generator renders
 * into `packages/claude-plugin`, the folder the marketplace entry points at
 * (REQ-550). Its manifests carry `package.json`'s version, so a release bump
 * is one command; `tests/unit/agent-skills.test.ts` fails, naming the file,
 * while the committed copy differs.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { TOOLS } from "../agents/init";

const ROOT = path.resolve(__dirname, "..", "..", "..").replace(/[\\/]dist$/, "");

export const PLUGIN_DIR = path.join(ROOT, "packages", "claude-plugin");

/** The files the plugin should hold, relative to its folder. */
export function pluginFiles(): Array<{ path: string; contents: string }> {
  return TOOLS["claude-plugin"].files();
}

if (require.main === module) {
  let changed = 0;
  for (const f of pluginFiles()) {
    const target = path.join(PLUGIN_DIR, f.path);
    const now = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
    if (now === f.contents) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, f.contents, "utf8");
    process.stdout.write(`  wrote packages/claude-plugin/${f.path.split(path.sep).join("/")}\n`);
    changed += 1;
  }
  process.stdout.write(changed ? `${changed} file(s) updated.\n` : "The plugin is current.\n");
}
