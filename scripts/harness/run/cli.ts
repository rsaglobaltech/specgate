/**
 * `specgate harness run` as typed: its help and its arguments.
 */

export function usage() {
  process.stdout.write(
    "Usage:\n" +
      "  specgate harness run [options]\n\n" +
      "Runs the plan → agent → verify → done loop for every pending requirement.\n\n" +
      "  --agent <cmd>          Agent command; must contain the {prompt_file} placeholder.\n" +
      '                         e.g. --agent "claude -p < {prompt_file}"\n' +
      "  --profile <name>       Run this profile's agent from .harness/profiles.yaml instead\n" +
      "                         of the configured one, for this run only.\n" +
      "  --test-cmd <cmd>       Project test command run as part of the gate (optional).\n" +
      "                         Substitutes {req}, {scenario} and {feature_file}, so the\n" +
      "                         gate can run the scenario under test.\n" +
      "  --max-attempts <n>     Retries per requirement, feeding back the failure (default 3).\n" +
      "  --concurrency <n>      Requirements in flight at once (default 1). Only requirements\n" +
      "                         that do not depend on each other ever run together.\n" +
      "  --req <REQ-NNN>        Limit to specific requirement(s); repeatable.\n" +
      "  --project-dir <path>   Project root (auto-detected from cwd if omitted).\n" +
      "  --base-branch <ref>    Branch/ref each worktree is cut from (default: current HEAD).\n" +
      "  --setup-cmd <cmd>      Run in each new worktree before the agent. Default: the\n" +
      "                         install the lockfile implies (npm ci, pnpm, yarn);\n" +
      "                         `none` runs nothing. The agent gets SPECGATE_REQ and\n" +
      "                         SPECGATE_ATTEMPT in its environment.\n" +
      "  --chain                One requirement at a time, in order, each cut from the\n" +
      "                         previous merge: a green one is merged into the branch\n" +
      "                         you are on (a merge commit, its prompts left on its\n" +
      "                         branch), the gate runs again on the merge, and a red\n" +
      "                         result is undone. Stops at the first failure.\n" +
      "  --timeout <seconds>    Per-agent-invocation timeout (default 1200).\n" +
      "  --keep-worktrees       Do not remove worktrees after each requirement.\n" +
      "  --force                Recreate harness/REQ-NNN branches that already exist.\n" +
      "  --allow-dirty          Run on a working tree with uncommitted or untracked files:\n" +
      "                         every branch is cut from the last commit and those files\n" +
      "                         stay as they are here. The JSON says which (`dirty`).\n" +
      "                         Not with --chain, which merges into this working copy.\n" +
      "  --format <text|json|jsonl>\n" +
      "                         Report format (default text). jsonl streams one JSON\n" +
      "                         event per line on stdout while the run goes, ending\n" +
      "                         with `run-end` (docs/harness-control.md).\n" +
      "  --dry-run              Build prompts and print them; never invoke the agent.\n\n" +
      "CI mode (unattended runners — a nightly job that leaves PRs to review):\n" +
      "  --resume               Continue an interrupted run: reuse the existing\n" +
      "                         harness/REQ-NNN branch and worktree instead of\n" +
      "                         skipping it, and pick up at the attempt it stopped on.\n" +
      "  --budget-seconds <n>   Wall-clock ceiling for the whole run. On reaching it\n" +
      "                         the run stops cleanly and still reports what it did.\n" +
      "  --max-requirements <n> Attempt at most n requirements in this run.\n" +
      "  --verbose              Stream the gate command's output as it runs, on\n" +
      "                         stderr. Without it the output only appears when the\n" +
      "                         gate fails, so a run that takes minutes shows\n" +
      "                         nothing and a hung test looks like a working one.\n" +
      "  --pause-between-attempts\n" +
      "                         After a failed attempt, wait for `specgate harness continue`\n" +
      "                         before the next one.\n" +
      "  --skip-not-ready       Skip requirements an agent could not succeed at — no\n" +
      "                         feature, an unrunnable scenario, unmet dependencies,\n" +
      "                         Deprecated or Needs Clarification. Default: warn and\n" +
      "                         run them anyway.\n" +
      "  --skip-baseline        Run even when the base already fails `validate --strict`.\n" +
      "                         Default: refuse before any agent runs, since every\n" +
      "                         attempt would fail the same gate for a reason outside\n" +
      "                         its requirement.\n" +
      "  --strict-artifacts     Fail an attempt whose diff never touches the paths the\n" +
      "                         matrix declares for the requirement (default: warn).\n" +
      "  --push                 Push each green harness/REQ-NNN branch to the remote.\n" +
      "  --remote <name>        Remote to push to (default origin).\n" +
      "  --pr-cmd <cmd>         Command run after a successful push, with {branch} and\n" +
      '                         {req} placeholders. e.g. --pr-cmd "gh pr create --head {branch} \\\n' +
      "                         --title '{req} via harness' --fill\"\n\n" +
      "`--agent`, `--test-cmd`, `push`, `remote` and `pr_cmd` may also be set in harness.config.yaml.\n"
  );
}

export function parseArgs(argv: string[]) {
  const args = {
    projectDir: ".",
    agent: "",
    testCmd: "",
    maxAttempts: 0,
    concurrency: 0,
    reqs: [] as string[],
    baseBranch: "",
    // 600 was the original guess. Both real runs disproved it: the first
    // REQ-001 attempt hit 900s while the agent installed dependencies and
    // worked, and 1500 was needed comfortably. A default that times out on
    // ordinary work turns every first attempt into a wasted one.
    timeout: 1200,
    keepWorktrees: false,
    force: false,
    resume: false,
    format: "text",
    dryRun: false,
    verbose: false,
    strictArtifacts: false,
    skipNotReady: false,
    pauseBetweenAttempts: false,
    skipBaseline: false,
    budgetSeconds: 0,
    maxRequirements: 0,
    push: false,
    remote: "",
    prCmd: "",
    setupCmd: "",
    chain: false,
    profile: "",
    allowDirty: false,
    /** The profile `--profile` resolved `agent` from (REQ-509). */
    agentProfile: "",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--project-dir") {
      args.projectDir = argv[++i] || "";
    } else if (token === "--agent") {
      args.agent = argv[++i] || "";
    } else if (token === "--profile") {
      args.profile = argv[++i] || "";
    } else if (token === "--test-cmd") {
      args.testCmd = argv[++i] || "";
    } else if (token === "--max-attempts") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1) {
        throw new Error("--max-attempts must be a positive integer");
      }
      args.maxAttempts = n;
    } else if (token === "--concurrency") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1) {
        throw new Error("--concurrency must be a positive integer");
      }
      args.concurrency = n;
    } else if (token === "--req") {
      const r = argv[++i] || "";
      if (!/^REQ-\d+$/.test(r)) throw new Error(`--req expects REQ-NNN, got: ${r}`);
      args.reqs.push(r);
    } else if (token === "--base-branch") {
      args.baseBranch = argv[++i] || "";
    } else if (token === "--setup-cmd") {
      args.setupCmd = argv[++i] || "";
    } else if (token === "--chain") {
      args.chain = true;
    } else if (token === "--allow-dirty") {
      args.allowDirty = true;
    } else if (token === "--timeout") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1) throw new Error("--timeout must be a positive integer");
      args.timeout = n;
    } else if (token === "--push") {
      args.push = true;
    } else if (token === "--remote") {
      args.remote = argv[++i] || "";
    } else if (token === "--pr-cmd") {
      args.prCmd = argv[++i] || "";
    } else if (token === "--keep-worktrees") {
      args.keepWorktrees = true;
    } else if (token === "--force") {
      args.force = true;
    } else if (token === "--resume") {
      args.resume = true;
    } else if (token === "--format") {
      args.format = argv[++i] || "";
    } else if (token === "--verbose") {
      args.verbose = true;
    } else if (token === "--dry-run") {
      args.dryRun = true;
    } else if (token === "--strict-artifacts") {
      args.strictArtifacts = true;
    } else if (token === "--pause-between-attempts") {
      args.pauseBetweenAttempts = true;
    } else if (token === "--skip-not-ready") {
      args.skipNotReady = true;
    } else if (token === "--skip-baseline") {
      args.skipBaseline = true;
    } else if (token === "--budget-seconds") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1) {
        throw new Error("--budget-seconds must be a positive integer");
      }
      args.budgetSeconds = n;
    } else if (token === "--max-requirements") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1) {
        throw new Error("--max-requirements must be a positive integer");
      }
      args.maxRequirements = n;
    } else if (token === "--help" || token === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  // `--force` throws the branch away; `--resume` continues it. Asking for both
  // is asking for two opposite things, and silently picking one is how work
  // gets deleted after an interruption — the exact loss --resume exists to stop.
  if (args.force && args.resume) {
    throw new Error(
      "--force and --resume are opposites: --force deletes the existing branch, " +
        "--resume continues it. Pick one."
    );
  }
  if (!["text", "json", "jsonl"].includes(args.format)) {
    throw new Error(`Invalid --format: ${args.format}. Expected: text | json | jsonl.`);
  }
  // REQ-490: --chain merges into the working copy, where the uncommitted files are.
  if (args.allowDirty && args.chain) {
    throw new Error(
      "--allow-dirty cannot go with --chain: --chain merges each green requirement into " +
        "this working copy, where the uncommitted files are. Commit or stash them, or run " +
        "without --chain."
    );
  }
  if (args.dryRun && args.format === "jsonl") {
    throw new Error("--dry-run prints the prompts; it has no stream. Drop --format jsonl.");
  }
  return args;
}
