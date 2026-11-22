#!/usr/bin/env node
import { resolveProjectDir } from "./lib/project-root";
import { agentIo, wantsJson } from "./lib/agent";
import { error } from "./lib/diagnostics";
import { briefModel } from "./lib/brief-model";

/** `specgate brief model [--json]` (brief-domain-views REQ-658): the domain model, to draw. */
export function briefModelCommand(argv: string[]): void {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(
      "Usage:\n  specgate brief model [--project-dir <path>] [--json]\n\n" +
        "The project's domain model: its bounded contexts, integrations, flows and stories —\n" +
        "from the DDD workshop's models in docs/brief/models, else from the specification.\n"
    );
    process.exit(0);
  }
  const io = agentIo(wantsJson(argv));
  const shape = { model: null };
  const at = argv.indexOf("--project-dir");
  let dir: string;
  try {
    dir = resolveProjectDir(at >= 0 ? argv[at + 1] || "." : ".");
  } catch (err) {
    io.usage(shape, [
      error("project_not_found", (err as Error).message, { fix: "Pass --project-dir." }),
    ]);
    return;
  }
  const model = briefModel(dir);
  io.emit({ model }, () =>
    process.stdout.write(
      `From the ${model.source === "workshop" ? "DDD workshop" : "specification"}: ` +
        model.modules
          .map((m) => `${m.name} (${m.flows.length} flows, ${m.stories.length} stories)`)
          .join(", ") +
        "\n"
    )
  );
}

if (require.main === module) briefModelCommand(process.argv.slice(2));
