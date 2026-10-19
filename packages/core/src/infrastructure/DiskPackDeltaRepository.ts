/**
 * The disk half of deriving a change from a pack bump.
 *
 * Loading `pack.yaml`, lifting a scenario's steps out of its Gherkin template,
 * and writing the change folder. What counts as a change at all is domain —
 * see `domain/PackDelta`.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { parseYamlLite } from "../domain/YamlLite";
import { parseGherkin } from "../domain/Gherkin";
import {
  DerivedPackDelta,
  LoadedPack,
  changeIdFor,
  renderProposal,
  renderTasks,
} from "../domain/PackDelta";
import { PackItem } from "../domain/PackSpec";
import { PackEntry } from "../domain/Lockfile";
import { Phrases } from "../domain/Language";

export function loadPackModel(packRoot: string, packId: string): LoadedPack {
  const packFile = path.join(path.resolve(packRoot), packId, "pack.yaml");
  if (!fs.existsSync(packFile)) {
    throw new Error(`Pack file not found: ${packFile}`);
  }
  return {
    model: parseYamlLite(fs.readFileSync(packFile, "utf8")),
    packDir: path.dirname(packFile),
  };
}

/**
 * Pull the real steps for a scenario out of the pack's own `.feature` template.
 *
 * Reading is delegated to `parseGherkin`, the one reader in this repository
 * (F1). This used to carry its own regular expression — one of three that gave
 * three different answers about the same file — and it was the only one of the
 * three that was case-sensitive, so it was already reading these templates the
 * way Cucumber does while the linter approved them.
 *
 * Falls back to null rather than inventing behaviour: a delta that says "TODO"
 * is reviewable; one that says something plausible but made up is not.
 */
export function stepsForScenario(
  packDir: string,
  scenario: PackItem | null | undefined
): string[] | null {
  const templateRel = scenario && scenario.template;
  if (!templateRel) return null;
  const templateFile = path.resolve(packDir, templateRel);
  if (!templateFile.startsWith(path.resolve(packDir))) return null;
  if (!fs.existsSync(templateFile)) return null;

  const wanted = String(scenario.scenario || "").trim();
  const doc = parseGherkin(fs.readFileSync(templateFile, "utf8"));

  // An empty name means "the first scenario in the file", which is what the
  // line-walking version did by starting `inside` true.
  const match = wanted === "" ? doc.scenarios[0] : doc.scenarios.find((s) => s.name === wanted);
  if (!match) return null;

  // `rawKeyword`, not the normalised one: a delta keeps the step as written, so
  // an `And` stays `AND` instead of collapsing into the `THEN` it inherits.
  // Upper-cased because a delta renders steps as `- GIVEN …`, which is the spec
  // format rather than Gherkin — `change archive` turns it back into a feature.
  const steps = match.steps.map((step) => `${step.rawKeyword.toUpperCase()} ${step.text}`);
  return steps.length > 0 ? steps : null;
}

// ── Rendering the delta ───────────────────────────────────────────────────────

/**
 * Materialise the derived delta as a change folder. Returns the list of files
 * written (or that would be written, when `dryRun`). Only a delta with
 * something in it can be written: one whose `markdown` came back null has no
 * spec to put in the folder.
 */
export function materialiseChange(
  projectDir: string,
  entry: PackEntry,
  targetVersion: string,
  derived: DerivedPackDelta & { markdown: string },
  t: Phrases,
  opts?: { changeId?: string; dryRun?: boolean }
): { changeId: string; changeDir: string; files: string[] } {
  const o = opts || {};
  const changeId = o.changeId || changeIdFor(entry.pack_id, entry.version, targetVersion);
  const changeDir = path.join(projectDir, "docs", "specs", "changes", changeId);

  const files = [
    {
      file: path.join(changeDir, "proposal.md"),
      contents: renderProposal(entry, targetVersion, derived.summary, t),
    },
    { file: path.join(changeDir, "tasks.md"), contents: renderTasks(entry, targetVersion) },
    {
      file: path.join(changeDir, "change.yaml"),
      contents:
        `specgate_change_version: 1\n` +
        `schema: spec-driven\n` +
        `created: ${new Date().toISOString().slice(0, 10)}\n` +
        `rigor: lite\n` +
        `skip_specs: false\n` +
        `retire_capabilities: false\n` +
        `origin: pack:${entry.repo}#${entry.pack_id}@${targetVersion}\n`,
    },
    {
      file: path.join(changeDir, "specs", derived.capability, "spec.md"),
      contents: derived.markdown,
    },
  ];

  if (!o.dryRun) {
    for (const f of files) {
      fs.mkdirSync(path.dirname(f.file), { recursive: true });
      fs.writeFileSync(f.file, f.contents, "utf8");
    }
  }

  return {
    changeId,
    changeDir,
    files: files.map((f) => path.relative(projectDir, f.file).split(path.sep).join("/")),
  };
}
