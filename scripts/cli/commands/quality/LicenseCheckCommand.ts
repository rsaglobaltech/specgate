import * as fs from "node:fs";
import { BaseCommand } from "../../../lib/command";
import { errorMessage } from "../../../lib/diagnostics";

/** One licence entry of a CycloneDX component: a named licence, or an SPDX expression. */
export interface SbomLicenseEntry {
  license?: { id?: string; name?: string };
  expression?: string;
}

/** The fields of a CycloneDX component this check reads. */
export interface SbomComponent {
  name?: string;
  version?: string;
  licenses?: SbomLicenseEntry[];
}

/** A CycloneDX document, as `npm sbom --sbom-format cyclonedx` writes it. */
interface CycloneDxBom {
  components?: SbomComponent[];
}

/** What `summarise` finds: a count per licence, and what the policy refuses. */
export interface LicenseSummary {
  total: number;
  table: Array<{ license: string; count: number; packages: string[] }>;
  violations: Array<{ component: string; license: string }>;
}

export const ALLOWED = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BlueOak-1.0.0",
  "CC-BY-3.0",
  "CC-BY-4.0",
  "CC0-1.0",
  "ISC",
  "MIT",
  "MIT-0",
  "Python-2.0",
  "Unlicense",
  "WTFPL",
]);

export function licenseOf(component: SbomComponent): string {
  const entries = component.licenses || [];
  const parts = entries
    .map((e: SbomLicenseEntry) => (e.license && (e.license.id || e.license.name)) || e.expression)
    .filter(Boolean);
  return parts.length ? parts.join(" OR ") : "UNKNOWN";
}

export function alternatives(expression: string) {
  return expression
    .replace(/[()]/g, " ")
    .split(/\s+OR\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAllowed(expression: string) {
  if (expression === "UNKNOWN") return false;
  if (/\sAND\s/i.test(expression)) {
    return expression
      .replace(/[()]/g, " ")
      .split(/\s+AND\s+/i)
      .map((s) => s.trim())
      .every((term) => alternatives(term).some((lic) => ALLOWED.has(lic)));
  }
  return alternatives(expression).some((lic) => ALLOWED.has(lic));
}

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

export function summarise(components: SbomComponent[]): LicenseSummary {
  const byLicense = new Map<string, string[]>();
  const violations: Array<{ component: string; license: string }> = [];
  for (const c of components) {
    const lic = licenseOf(c);
    if (!byLicense.has(lic)) byLicense.set(lic, []);
    byLicense.get(lic)!.push(`${c.name}@${c.version}`);
    if (!isAllowed(lic)) violations.push({ component: `${c.name}@${c.version}`, license: lic });
  }
  const table = [...byLicense.entries()]
    .map(([license, packages]) => ({ license, count: packages.length, packages }))
    .sort((a, b) => b.count - a.count || a.license.localeCompare(b.license));
  return { total: components.length, table, violations };
}

function renderMarkdown(result: LicenseSummary): string {
  const lines = [
    `Components: **${result.total}**`,
    "",
    "| Licence | Packages |",
    "| --- | --: |",
    ...result.table.map((r) => `| \`${r.license}\` | ${r.count} |`),
  ];
  if (result.violations.length) {
    lines.push(
      "",
      "**Outside the allow-list:**",
      "",
      ...result.violations.map((v) => `- \`${v.component}\` — \`${v.license}\``)
    );
  }
  return lines.join("\n") + "\n";
}

export class LicenseCheckCommand extends BaseCommand {
  public execute(): void {
    const argv = this.args;
    let sbomPath: string | null = null;
    let asJson = false;
    let asMarkdown = false;
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === "--sbom" && argv[i + 1]) sbomPath = argv[++i];
      else if (argv[i] === "--json") asJson = true;
      else if (argv[i] === "--markdown") asMarkdown = true;
      else if (argv[i] === "--help" || argv[i] === "-h") {
        process.stdout.write(
          "Usage:\n" +
            "  npm sbom --sbom-format cyclonedx | node dist/scripts/license_check.js\n" +
            "  node dist/scripts/license_check.js --sbom <file> [--json] [--markdown]\n"
        );
        process.exit(0);
      } else {
        process.stderr.write(`Unknown argument: ${argv[i]}\n`);
        process.exit(2);
      }
    }

    const raw = sbomPath ? fs.readFileSync(sbomPath, "utf8") : readStdin();
    if (!raw.trim()) {
      process.stderr.write(
        "No SBOM on stdin and no --sbom given.\n" +
          "Fix: npm sbom --sbom-format cyclonedx | node dist/scripts/license_check.js\n"
      );
      process.exit(2);
    }

    let bom: CycloneDxBom;
    try {
      // The SBOM's shape is npm's; only `components` is read, and defensively.
      bom = JSON.parse(raw);
    } catch (err) {
      process.stderr.write(`SBOM is not valid JSON: ${errorMessage(err)}\n`);
      process.exit(2);
    }

    const result = summarise(bom.components || []);

    if (asJson) {
      process.stdout.write(
        JSON.stringify({ ...result, allowed: [...ALLOWED].sort() }, null, 2) + "\n"
      );
    } else if (asMarkdown) {
      process.stdout.write(renderMarkdown(result));
    } else {
      process.stdout.write(`Components: ${result.total}\n`);
      for (const row of result.table) {
        process.stdout.write(`${String(row.count).padStart(5)}  ${row.license}\n`);
      }
    }

    if (result.violations.length) {
      process.stderr.write(
        `\n❌ ${result.violations.length} component(s) outside the licence policy:\n`
      );
      for (const v of result.violations) {
        process.stderr.write(`   ${v.component} — ${v.license}\n`);
      }
      process.stderr.write(
        "\n💡 Fix: drop the dependency, or add the licence to ALLOWED in\n" +
          "   scripts/license_check.ts after reviewing what it obliges, and say\n" +
          "   why in docs/supply-chain.md.\n"
      );
      process.exit(1);
    }
    process.exit(0);
  }
}
