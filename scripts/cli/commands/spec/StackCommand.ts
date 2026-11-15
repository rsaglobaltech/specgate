import * as fs from "node:fs";
import * as path from "node:path";
import { error } from "../../../lib/diagnostics";
import { agentIo, wantsJson } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";
import * as ui from "../../../lib/ui";
import { resolveProjectDir } from "../../../lib/project-root";
import { detectCommands, detectLayers } from "../../../lib/stack-detect";
import {
  STACK_FILE,
  mergeCommands,
  renderStack,
  stackCommands,
} from "../../../../packages/core/src/domain/StackFile";

const NULL_SHAPE = { stack: null };

function usage(): void {
  process.stdout.write(
    "Usage:\n  specgate stack [--project-dir <path>] [--json]\n\n" +
      "Writes docs/specs/stack.md: the layers detected — migration, persistence, service,\n" +
      "api, ui, end-to-end — each with its technology and the evidence it was read from,\n" +
      "and the build, test, affected-test and end-to-end commands. A command you correct\n" +
      "in the file is kept on the next run. The harness and `specgate check` use the\n" +
      "file's test command when harness.config.yaml sets none.\n\n" +
      "Exit 0 done · 2 usage error.\n"
  );
}

/** `specgate stack` (REQ-548). */
export class StackCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args[0] === "stack" ? this.args.slice(1) : this.args;
    if (argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(0);
    }
    const io = agentIo(wantsJson(argv));
    let dirArg = ".";
    for (let i = 0; i < argv.length; i += 1) {
      const a = argv[i];
      if (a === "--project-dir") dirArg = argv[++i] || ".";
      else if (a === "--json") continue;
      else {
        io.usage(NULL_SHAPE, [
          error("unknown_argument", `Unknown argument for stack: ${a}`, {
            fix: "specgate stack --help",
          }),
        ]);
      }
    }
    let projectDir: string;
    try {
      projectDir = resolveProjectDir(dirArg);
    } catch {
      projectDir = path.resolve(dirArg);
    }
    const file = path.join(projectDir, STACK_FILE);
    const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    const layers = detectLayers(projectDir);
    const commands = mergeCommands(detectCommands(projectDir), before);
    const next = renderStack(layers, commands);
    const changed = next !== before;
    if (changed) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, next, "utf8");
    }
    io.emit({ stack: { path: STACK_FILE, changed, layers, commands: stackCommands(next) } }, () => {
      process.stdout.write(ui.header("stack", path.basename(projectDir)));
      for (const l of layers) {
        process.stdout.write(
          `  ${l.layer.padEnd(12)} ${l.technology.padEnd(22)} ${ui.muted(l.evidence)}\n`
        );
      }
      if (layers.length === 0) process.stdout.write(ui.info("No layer detected."));
      process.stdout.write(
        "\n" +
          (changed
            ? ui.fileLine(before === null ? "added" : "changed", STACK_FILE)
            : `  ${ui.muted(`${STACK_FILE} is current — nothing changed`)}\n`) +
          "\n"
      );
    });
  }
}
