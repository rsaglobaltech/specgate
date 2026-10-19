/**
 * The shared argument parser for the pack commands.
 *
 * `expand`, `lint`, `bundle`, `infer` and `init` take overlapping flags —
 * `--pack-root`, `--pack`, `--project-dir`, `--var` — so they parse them once
 * here rather than five times, slightly differently.
 */

/** Pack rule violations are thrown; the command layer turns them into output. */
function fail(message: string): never {
  throw new Error(message);
}

/** The flags the pack commands share, parsed. */
export interface PackArgs {
  packRoot: string;
  pack: string;
  projectDir: string;
  dryRun: boolean;
  noExamples: boolean;
  /** `--var KEY=VALUE`, repeatable. */
  vars: Record<string, string>;
  packRepo: string;
  packVersion: string;
  cacheDir: string;
}

export function parseArgs(argv: string[]): PackArgs {
  const args: PackArgs = {
    packRoot: "",
    pack: "",
    projectDir: "",
    dryRun: false,
    noExamples: false,
    vars: {},
    packRepo: "",
    packVersion: "",
    cacheDir: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--pack-root") {
      args.packRoot = argv[i + 1] || "";
      i += 1;
      continue;
    }

    if (token === "--pack") {
      args.pack = argv[i + 1] || "";
      i += 1;
      continue;
    }

    if (token === "--project-dir") {
      args.projectDir = argv[i + 1] || "";
      i += 1;
      continue;
    }

    if (token === "--pack-repo") {
      args.packRepo = argv[i + 1] || "";
      i += 1;
      continue;
    }

    if (token === "--pack-version") {
      args.packVersion = argv[i + 1] || "";
      i += 1;
      continue;
    }

    if (token === "--cache-dir") {
      args.cacheDir = argv[i + 1] || "";
      i += 1;
      continue;
    }

    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (token === "--no-examples") {
      args.noExamples = true;
      continue;
    }

    if (token === "--var") {
      const pair = argv[i + 1] || "";
      i += 1;
      const eq = pair.indexOf("=");
      if (eq < 1) {
        fail(`Invalid --var value '${pair}'. Use KEY=VALUE.`);
      }

      const key = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1);
      args.vars[key] = value;
      continue;
    }

    fail(`Unknown argument: ${token}`);
  }

  return args;
}
