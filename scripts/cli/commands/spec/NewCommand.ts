import * as fs from "node:fs";
import * as path from "node:path";
import { resolveProjectDir } from "../../../lib/project-root";
import { error } from "../../../lib/diagnostics";
import { agentIo, wantsJson } from "../../../lib/agent";
import { BaseCommand } from "../../../lib/command";
import { refreshDerivedMatrix } from "./MatrixCommand";
import { DiskTraceabilityRepository } from "../../../../packages/core/src/infrastructure/DiskTraceabilityRepository";
import { AddRequirementUseCase } from "../../../../packages/core/src/application/AddRequirementUseCase";
import { appendRequirementSection } from "../../../../packages/core/src/domain/SpecSections";
import {
  featureWithScenario,
  scenarioBlock,
  slugFor,
} from "../../../../packages/core/src/domain/NewRequirement";

const COLOR_ENABLED =
  process.stdout.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== "dumb";
const c = {
  reset: COLOR_ENABLED ? "\x1b[0m" : "",
  bold: COLOR_ENABLED ? "\x1b[1m" : "",
  dim: COLOR_ENABLED ? "\x1b[2m" : "",
  green: COLOR_ENABLED ? "\x1b[32m" : "",
};

const NULL_SHAPE = { requirement: null };

function usage(): void {
  process.stdout.write(
    `
  ✨ ${c.bold}specgate new${c.reset} "<what the requirement does>" [--feature <path>] [--json]

  One requirement, written in the three places it lives:
    spec.md                       a draft ## REQ-NNN section to rewrite
    features/<slug>.feature       a tagged scenario of <placeholders> to fill in
    docs/specs/traceability.md    its row, linked to that scenario

  --feature <path>   put the scenario in this file (appended if it exists)

  It starts as Draft, which owes nothing: the gate passes. Once it is
  delivered, \`specgate check\` refuses any <placeholder> left in the scenario.

`
  );
}

/**
 * `specgate new` — one requirement in one step.
 *
 * Before it, a requirement took `req add`, an edit to spec.md, a hand-written
 * `.feature` with the right tags, and `req link --feature`. Four steps, three
 * files, and a tag syntax nobody remembers: the team said the tool was hard
 * to absorb, and this was the first thing they did with it.
 */
export class NewCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    if (argv.includes("--help") || argv.includes("-h")) {
      usage();
      process.exit(0);
    }
    const io = agentIo(wantsJson(argv));

    let projectDirArg = ".";
    let featureArg: string | undefined;
    const words: string[] = [];
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === "--project-dir") projectDirArg = argv[++i] || ".";
      else if (a === "--feature") featureArg = argv[++i];
      else if (a === "--json") continue;
      else if (a.startsWith("-")) {
        io.usage(NULL_SHAPE, [
          error("unknown_flag", `Unknown flag for new: ${a}`, { fix: "specgate new --help" }),
        ]);
      } else words.push(a);
    }
    const title = words.join(" ").trim();
    if (!title) {
      io.usage(NULL_SHAPE, [
        error("title_required", "A title is required.", {
          fix: 'specgate new "Totals are rounded half-up"',
        }),
      ]);
    }

    let projectDir: string;
    try {
      projectDir = resolveProjectDir(projectDirArg);
    } catch {
      projectDir = path.resolve(projectDirArg);
    }
    if (!fs.existsSync(path.join(projectDir, "docs", "specs", "traceability.md"))) {
      io.usage(NULL_SHAPE, [
        error("traceability_not_found", "No docs/specs/traceability.md here.", {
          file: "docs/specs/traceability.md",
          fix: "Run `specgate adopt` on an existing repository, or `specgate init` for a new one.",
        }),
      ]);
    }

    const featureRel = (featureArg || `features/${slugFor(title)}.feature`)
      .split(path.sep)
      .join("/");
    if (!featureRel.endsWith(".feature")) {
      io.usage(NULL_SHAPE, [
        error("not_a_feature_file", `--feature must name a .feature file: ${featureRel}`, {
          fix: `specgate new "${title}" --feature features/${slugFor(title)}.feature`,
        }),
      ]);
    }

    const result = new AddRequirementUseCase(new DiskTraceabilityRepository()).execute(projectDir, {
      useCase: title,
      featureFile: featureRel,
    });
    const reqId = result.reqId;
    const scenarioId = result.scenarioId;

    const featureAbs = path.join(projectDir, featureRel);
    const existing = fs.existsSync(featureAbs) ? fs.readFileSync(featureAbs, "utf8") : null;
    fs.mkdirSync(path.dirname(featureAbs), { recursive: true });
    fs.writeFileSync(
      featureAbs,
      featureWithScenario(existing, title, scenarioBlock(reqId, scenarioId, title)),
      "utf8"
    );

    const specPath = path.join(projectDir, "spec.md");
    let wroteSection = false;
    if (fs.existsSync(specPath)) {
      const written = appendRequirementSection(fs.readFileSync(specPath, "utf8"), reqId, title);
      if (written.added) {
        fs.writeFileSync(specPath, written.content, "utf8");
        wroteSection = true;
      }
    }
    refreshDerivedMatrix(projectDir);

    io.emit(
      {
        requirement: {
          id: reqId,
          scenarioId,
          title,
          status: "Draft",
          featureFile: featureRel,
          featureCreated: existing === null,
          specSection: wroteSection,
        },
      },
      () =>
        process.stdout.write(
          `${c.green}✔${c.reset}  ${c.bold}${reqId}${c.reset} ${title} ${c.dim}(Draft)${c.reset}\n` +
            (wroteSection
              ? `   ${c.dim}spec.md                      ## ${reqId} — rewrite the obligation${c.reset}\n`
              : "") +
            `   ${c.dim}${featureRel.padEnd(28)} @${scenarioId} — fill in the <placeholders>${c.reset}\n` +
            `   ${c.dim}docs/specs/traceability.md   row linked to the scenario${c.reset}\n\n` +
            `   ${c.dim}Next: write the test, then ${c.reset}specgate req link ${reqId} --test <path> --code <path>\n`
        )
    );
  }
}
