import * as fs from "node:fs";
import * as path from "node:path";
import { BaseCommand } from "../../../lib/command";

import { c } from "../../../lib/ui";

export const TEMPLATE = `# project.yaml — spec-driven project config
# Fill these in, then: specgate init --config project.yaml --out .
# Required keys:
PROJECT_NAME: My App
PROJECT_SLUG: my-app # lowercase, dashes only
PROJECT_TYPE: backend # backend | frontend
DOMAIN: general
STACK: Node.js, TypeScript
API_STYLE: REST with DTO boundaries
TESTING: Vitest, Cucumber

# Optional:
# LANG: en
# MODULES: "auth,billing" # comma-separated feature modules
`;

function usage() {
  process.stdout.write(
    `\n  ${c.bold}${c.cyan}⚙️  config init${c.reset}  ${c.dim}— write a commented project.yaml starter${c.reset}\n\n` +
      `  ${c.bold}USAGE${c.reset}\n` +
      `    ${c.cyan}specgate config init${c.reset} [--out <path>] [--force]\n\n` +
      `  ${c.bold}OPTIONS${c.reset}\n` +
      `    ${c.green}--out <path>${c.reset}  ${c.dim}Target file (default: ./project.yaml).${c.reset}\n` +
      `    ${c.green}--force${c.reset}       ${c.dim}Overwrite if the file already exists.${c.reset}\n` +
      `    ${c.green}-h, --help${c.reset}    ${c.dim}Show this help.${c.reset}\n\n`
  );
}

export interface ConfigInitOptions {
  out: string;
  force: boolean;
}

export function parseArgs(argv: string[]) {
  const opts: ConfigInitOptions = { out: "project.yaml", force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out" && argv[i + 1]) opts.out = argv[++i];
    else if (a === "--force") opts.force = true;
    else if (a === "--help" || a === "-h") {
      usage();
      process.exit(0);
    } else if (a.startsWith("-")) {
      process.stderr.write(`Unknown flag: ${a}\n`);
      process.exit(2);
    }
  }
  return opts;
}

export class ConfigInitCommand extends BaseCommand {
  public execute(): void {
    const opts = parseArgs(this.args);
    const dest = path.resolve(opts.out);
    if (fs.existsSync(dest) && !opts.force) {
      process.stderr.write(
        `${c.red}✖${c.reset}  ${opts.out} already exists (use --force to overwrite).\n`
      );
      process.exit(2);
    }
    fs.writeFileSync(dest, TEMPLATE, "utf8");
    process.stdout.write(
      `${c.green}✔${c.reset}  Wrote ${c.bold}${opts.out}${c.reset}\n` +
        `   ${c.dim}▶ next: edit the values, then \`specgate init --config ${opts.out} --out .\`${c.reset}\n`
    );
    process.exit(0);
  }
}
