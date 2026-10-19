import { createPackBundle } from "../../../../packages/core/src/infrastructure/RemotePackResolver";
import { BaseCommand } from "../../../lib/command";
import * as ui from "../../../lib/ui";

function logInfo(msg: string) {
  process.stdout.write(ui.logLine(msg));
}
function logError(msg: string) {
  process.stderr.write(ui.fail(msg));
}

function usage() {
  process.stdout.write(
    "Usage:\n" +
      "  specgate pack bundle --repo <url> --out <file.bundle>\n\n" +
      "Creates a git bundle with every branch and tag of the pack repository.\n" +
      "Copy the file into the air-gapped environment and consume it with:\n" +
      "  specops add --pack-repo /path/to/file.bundle --pack-version <tag> …\n"
  );
}

export class BundlePackCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    let repo: string | null = null;
    let out: string | null = null;
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === "--repo" && argv[i + 1]) repo = argv[++i];
      else if (argv[i] === "--out" && argv[i + 1]) out = argv[++i];
      else if (argv[i] === "--help" || argv[i] === "-h") {
        usage();
        process.exit(0);
      } else {
        logError(`Unknown argument: ${argv[i]}`);
        usage();
        process.exit(2);
      }
    }
    if (!repo || !out) {
      logError("--repo and --out are required.");
      usage();
      process.exit(2);
    }

    try {
      const result = createPackBundle({ repo, out });
      logInfo(`write ${result.out}`);
      logInfo(`refs included: ${result.refs.join(", ") || "(none)"}`);
      logInfo("✅ Bundle created. Air-gapped usage:");
      logInfo(`  specgate specops add --pack-repo ${result.out} --pack-version <tag> …`);
      process.exit(0);
    } catch (err) {
      const e = err as Error | null | undefined;
      logError(e && e.message ? e.message : String(err));
      process.exit(1);
    }
  }
}
