import { BaseCommand } from "../../../lib/command";
import { agentIo, wantsJson, AgentIo } from "../../../lib/agent";
import { error } from "../../../lib/diagnostics";
import { c } from "../../../lib/ui";
import { findForjaProject, runForja, runForjaCaptured } from "./Forja";

const NULL_SHAPE = { add: null };
const KINDS = ["usecase", "entity", "port"];

function usage(): void {
  process.stdout.write(
    `
  🧩 ${c.bold}specgate add${c.reset} <usecase|entity|port> <module/Name> [options]

  Adds code where the architecture expects it, with its test and its wiring.
  It runs \`forja add\` in a project forja generated (it has a forja.config.json):

    specgate add usecase orders/PlaceOrder     the use case, its test, its requirement
    specgate add entity orders/Order           a domain entity and its test
    specgate add port orders/OrderRepository   an outbound port and an in-memory adapter

  Every option goes to forja: --req REQ-007, --no-spec, --title, --no-adapter,
  --dry-run. In a project forja did not generate, write the requirement with
  \`specgate new\` and the code by hand.

`
  );
}

/**
 * `specgate add` — the generator, behind the one command a user learns
 * (ADR-0033). No generator logic lives here: the arguments go to `forja add`
 * as they are, and its exit code is this command's.
 */
export class AddCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args[0] === "add" ? this.args.slice(1) : this.args;
    if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(argv.length === 0 ? 2 : 0);
    }
    const json = wantsJson(argv);
    const io: AgentIo = agentIo(json);

    if (!KINDS.includes(argv[0])) {
      io.usage(NULL_SHAPE, [
        error("add_kind_unknown", `Nothing to add called "${argv[0]}".`, {
          fix: "specgate add usecase|entity|port <module/Name>",
        }),
      ]);
    }

    const root = findForjaProject(process.cwd());
    if (!root) {
      io.fail(NULL_SHAPE, [
        error("add_needs_forja", "specgate add works in a project forja generated.", {
          fix:
            "No forja.config.json here or above. Write the requirement with " +
            '`specgate new "<title>"` and the code by hand, or start a project with ' +
            "`specgate init --forja`.",
        }),
      ]);
    }

    const forjaArgs = ["add", ...argv.filter((a) => a !== "--json")];
    if (!json) process.exit(runForja(forjaArgs, process.cwd()));

    // forja speaks to a terminal; over JSON its output travels in the document.
    const run = runForjaCaptured(forjaArgs, process.cwd());
    if (run.status !== 0) {
      io.fail(NULL_SHAPE, [
        error("add_forja_failed", `forja add exited with ${run.status}.`, {
          fix: run.output.split("\n").slice(-3).join(" ") || "Run it without --json to see why.",
        }),
      ]);
    }
    io.emit({ add: { root, args: forjaArgs, output: run.output }, status: [] }, () => undefined);
  }
}
