/**
 * A change never replaces a requirement that moved under it (REQ-168).
 *
 * A MODIFIED or REMOVED delta restates a requirement as its author read it.
 * If another change rewrites that requirement and merges first, archiving this
 * delta replaces the merged text with a rewrite of the old one — no conflict,
 * a green gate, and the other ticket's rule gone. `change_overlap` (REQ-160)
 * sees the two only while both are open, and the capability spec merge driver
 * (REQ-166) only when both rewrites meet in one merge.
 *
 * So the text a change was drafted against is fingerprinted in its
 * `change.yaml` the first time the gate sees it — a file, so it survives a
 * rebase where commit history would not — and compared from then on. Before
 * the branch has brought the base in, git alone shows the move: the
 * requirement differs between the base and where the two last met.
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { error, warning } from "./diagnostics";
import type { Diagnostic } from "./diagnostics";
import { ticketBase } from "./ticket-keys";
import { requirementBlocks } from "../../packages/core/src/domain/CapabilitySpecMerge";

const CHANGES = path.join("docs", "specs", "changes");
const CAPABILITIES = path.join("docs", "specs", "capabilities");
const SECTION = /^## (ADDED|MODIFIED|REMOVED|RENAMED) Requirements/;
const REQUIREMENT = /^###\s+Requirement:\s+(REQ-[\w.]+)/;
const BASED_ON = /^based_on:\s*\[([^\]]*)\]\s*$/m;

function git(dir: string, args: string[]) {
  return spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
}

/** The text that matters: the trace comment flips with every `apply`. */
export function fingerprint(block: string): string {
  const text = block
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((l) => !/^<!--\s*specgate:trace\b/.test(l.trim()))
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}

interface Rewrite {
  id: string;
  capability: string;
}

/** The requirements a change modifies or removes, with their capability. */
function rewrites(projectDir: string, changeId: string): Rewrite[] {
  const specs = path.join(projectDir, CHANGES, changeId, "specs");
  if (!fs.existsSync(specs)) return [];
  const out: Rewrite[] = [];
  for (const capability of fs.readdirSync(specs)) {
    const delta = path.join(specs, capability, "spec.md");
    if (!fs.existsSync(delta)) continue;
    let section = "";
    for (const line of fs.readFileSync(delta, "utf8").split("\n")) {
      const s = SECTION.exec(line);
      if (s) section = s[1];
      const r = REQUIREMENT.exec(line);
      if (r && (section === "MODIFIED" || section === "REMOVED"))
        out.push({ id: r[1], capability });
    }
  }
  return out;
}

function openChanges(projectDir: string): string[] {
  const dir = path.join(projectDir, CHANGES);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "archive" && !e.name.startsWith("."))
    .map((e) => e.name);
}

const capabilityFile = (capability: string) => path.join(CAPABILITIES, capability, "spec.md");

function blockNow(projectDir: string, w: Rewrite): string | undefined {
  try {
    const text = fs.readFileSync(path.join(projectDir, capabilityFile(w.capability)), "utf8");
    return requirementBlocks(text).get(w.id);
  } catch {
    return undefined;
  }
}

function blockAt(projectDir: string, ref: string, prefix: string, w: Rewrite) {
  const file = [prefix, capabilityFile(w.capability)].filter(Boolean).join("/");
  const r = git(projectDir, ["show", `${ref}:${file.split(path.sep).join("/")}`]);
  return r.status === 0 ? requirementBlocks(r.stdout).get(w.id) : undefined;
}

const yamlPath = (projectDir: string, changeId: string) =>
  path.join(projectDir, CHANGES, changeId, "change.yaml");

function recorded(projectDir: string, changeId: string): Map<string, string> {
  let yaml = "";
  try {
    yaml = fs.readFileSync(yamlPath(projectDir, changeId), "utf8");
  } catch {
    return new Map();
  }
  const list = BASED_ON.exec(yaml)?.[1] ?? "";
  return new Map(
    list
      .split(",")
      .map((e) => e.trim().split("@"))
      .filter(([id, sha]) => id && sha)
      .map(([id, sha]) => [id, sha] as [string, string])
  );
}

/**
 * Fingerprint what each open change rewrites and has no record of yet — or,
 * for `rebased`, all of one change's, after its delta was rewritten over the
 * moved text. Returns the ids written.
 */
export function recordBases(
  projectDir: string,
  only?: { changeId: string; rebased: boolean }
): string[] {
  const written: string[] = [];
  for (const changeId of only ? [only.changeId] : openChanges(projectDir)) {
    const file = yamlPath(projectDir, changeId);
    if (!fs.existsSync(file)) continue;
    const have = only?.rebased ? new Map<string, string>() : recorded(projectDir, changeId);
    const next = new Map(have);
    for (const w of rewrites(projectDir, changeId)) {
      if (next.has(w.id)) continue;
      const block = blockNow(projectDir, w);
      if (block === undefined) continue;
      next.set(w.id, fingerprint(block));
      written.push(w.id);
    }
    const before = recorded(projectDir, changeId);
    const same = next.size === before.size && [...next].every(([k, v]) => before.get(k) === v);
    if (same) continue;
    const line = `based_on: [${[...next].map(([id, sha]) => `${id}@${sha}`).join(", ")}]`;
    const yaml = fs.readFileSync(file, "utf8");
    fs.writeFileSync(
      file,
      BASED_ON.test(yaml) ? yaml.replace(BASED_ON, line) : `${yaml.replace(/\n*$/, "\n")}${line}\n`,
      "utf8"
    );
  }
  return written;
}

const rewriteFix = (changeId: string, w: Rewrite) =>
  `Rewrite ${w.id} in ${path.join(CHANGES, changeId, "specs", w.capability, "spec.md")} over ` +
  `${capabilityFile(w.capability)} as it reads now, keeping what the other change added; then ` +
  `run \`specgate change validate ${changeId} --rebased\`.`;

/** The requirements one change rewrites that moved since it recorded them. */
function movedSinceRecorded(projectDir: string, changeId: string) {
  const have = recorded(projectDir, changeId);
  return rewrites(projectDir, changeId).filter((w) => {
    const sha = have.get(w.id);
    const block = blockNow(projectDir, w);
    return sha !== undefined && block !== undefined && fingerprint(block) !== sha;
  });
}

/** Archive's refusal: an error per requirement that moved under the change. */
export function archiveBaseMoved(projectDir: string, changeId: string): Diagnostic[] {
  return movedSinceRecorded(projectDir, changeId).map((w) =>
    error(
      "change_base_moved",
      `${w.id} changed after ${changeId} was drafted against it: archiving would replace it as it reads now.`,
      { target: w.id, fix: rewriteFix(changeId, w) }
    )
  );
}

/**
 * `change_base_moved` warnings for `check`: moved since recorded, or — before
 * the branch caught up — different on the base from where the two last met.
 */
export function changeBaseFindings(projectDir: string, given?: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  let base: string | null = null;
  try {
    base = ticketBase(projectDir, given);
  } catch {
    base = null;
  }
  const met = base ? git(projectDir, ["merge-base", "HEAD", base]) : null;
  const prefix = git(projectDir, ["rev-parse", "--show-prefix"]).stdout.trim().replace(/\/$/, "");

  for (const changeId of openChanges(projectDir)) {
    const moved = new Set(movedSinceRecorded(projectDir, changeId).map((w) => w.id));
    for (const w of rewrites(projectDir, changeId)) {
      if (moved.has(w.id)) {
        out.push(
          warning(
            "change_base_moved",
            `${w.id} changed after ${changeId} was drafted against it: archiving would replace it as it reads now.`,
            { target: w.id, fix: rewriteFix(changeId, w) }
          )
        );
        continue;
      }
      if (!base || !met || met.status !== 0) continue;
      const then = blockAt(projectDir, met.stdout.trim(), prefix, w);
      const there = blockAt(projectDir, base, prefix, w);
      if (then === undefined || there === undefined || fingerprint(then) === fingerprint(there)) {
        continue;
      }
      out.push(
        warning(
          "change_base_moved",
          `${w.id}, which ${changeId} rewrites, has changed on ${base} since this branch started.`,
          {
            target: w.id,
            fix:
              `Merge ${base} into this branch, rewrite ${w.id} in the delta over the requirement ` +
              `as merged, then run \`specgate change validate ${changeId} --rebased\`.`,
          }
        )
      );
    }
  }
  return out;
}
