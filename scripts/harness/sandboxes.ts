#!/usr/bin/env node

/**
 * `specgate harness sandboxes [--prune] [--json]` (sandbox-swarm REQ-701):
 * each sandbox the harness made — its change, module, the hosts it may reach
 * and whether it is still there — and each `sg-…` sandbox nobody recorded.
 * `--prune` removes those whose change is archived or gone, and the strays.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProjectDir } from "../lib/project-root";
import { agentIo, wantsJson, EXIT } from "../lib/agent";
import { error } from "../lib/diagnostics";
import * as ui from "../lib/ui";
import { readSandboxes, removeSandbox, type SandboxRecord } from "../lib/sandbox-registry";
import { sbxList, sbxRemove } from "../lib/sbx";

function usage(): void {
  process.stdout.write(
    "Usage:\n" +
      "  specgate harness sandboxes [--prune] [--json] [--project-dir <path>]\n\n" +
      "Each sandbox the harness made (sandbox: { engine: sbx }): its change and\n" +
      "module, the hosts it may reach — yours and its kit's — and whether it is\n" +
      "still there; and each sandbox named sg-… that nobody recorded.\n\n" +
      "  --prune   Remove the sandboxes of archived or deleted changes, and the\n" +
      "            unrecorded sg-… ones, with the rules the harness added.\n"
  );
}

/** The changes still open: folders of docs/specs/changes but the archive. */
function openChanges(projectDir: string): Set<string> {
  const dir = path.join(projectDir, "docs", "specs", "changes");
  try {
    return new Set(
      fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name !== "archive")
        .map((e) => e.name)
    );
  } catch {
    return new Set();
  }
}

export function main(argv: string[]): void {
  if (argv.includes("--help") || argv.includes("-h")) {
    usage();
    process.exit(EXIT.OK);
  }
  const io = agentIo(wantsJson(argv));
  let projectDir = ".";
  let prune = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--project-dir") projectDir = argv[++i] || ".";
    else if (a === "--prune") prune = true;
    else if (a === "--json") continue;
    else {
      io.usage({ sandboxes: null }, [
        error("sandboxes_usage", `Unknown argument ${a}.`, { fix: "specgate harness sandboxes --help" }),
      ]);
    }
  }
  const dir = resolveProjectDir(projectDir, { requireSentinel: true });
  const records = readSandboxes(dir);
  const alive = sbxList();
  const open = openChanges(dir);
  const recorded = new Set(records.map((r) => r.name));
  const strays = (alive || []).filter((n) => n.startsWith("sg-") && !recorded.has(n));
  const stale = (r: SandboxRecord) => !open.has(r.change);

  const removed: string[] = [];
  if (prune) {
    for (const r of records.filter(stale)) {
      removeSandbox(dir, r);
      removed.push(r.name);
    }
    for (const n of strays) if (sbxRemove(n)) removed.push(n);
  }

  const listed = records.map((r) => ({
    name: r.name,
    change: r.change,
    module: r.module,
    kit: r.kit,
    created: r.created,
    allowed: r.rules.map((x) => x.host),
    kitHosts: r.kitHosts,
    alive: alive === null ? null : alive.includes(r.name),
    changeOpen: open.has(r.change),
    removed: removed.includes(r.name),
  }));
  const data = {
    sandboxes: {
      recorded: listed,
      strays: strays.map((name) => ({ name, removed: removed.includes(name) })),
      removed,
      sbx: alive !== null,
    },
  };
  io.emit(data, () => {
    let text = ui.header("harness sandboxes", `${records.length} recorded · ${strays.length} unrecorded`);
    if (alive === null) text += "  sbx did not answer: whether each sandbox exists is unknown.\n";
    for (const r of listed) {
      const state = r.removed
        ? "removed"
        : r.alive === false
          ? "gone"
          : r.changeOpen
            ? "in use"
            : "change archived — `--prune` removes it";
      text +=
        `  ${r.name}\n` +
        `     ${r.change} · ${r.module} · ${state}\n` +
        `     may reach ${r.allowed.length + r.kitHosts.length} host${r.allowed.length + r.kitHosts.length === 1 ? "" : "s"}: ${r.allowed.length} yours` +
        (r.allowed.length ? ` (${r.allowed.join(", ")})` : "") +
        `, ${r.kitHosts.length} from the kit ${r.kit}\n`;
    }
    for (const s of data.sandboxes.strays) {
      text += `  ${s.name}\n     recorded by no change · ${s.removed ? "removed" : "`--prune` removes it"}\n`;
    }
    process.stdout.write(text);
  });
}

if (require.main === module) main(process.argv.slice(2));
