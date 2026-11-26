import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { parseYamlLite } from "../../packages/core/src/domain/YamlLite";
import {
  LAYERS,
  LEGACY_DISCOVER,
  isUntouchedLayer,
  type LayerId,
} from "../../packages/core/src/domain/ChangeLayers";
import {
  approvalsRequired,
  changeApproved,
  contentHash,
  holdsRole,
  layerApprovals,
  readApprovalSettings,
  type ApprovalRecord,
  type ApprovalSettings,
  type Identity,
  type LayerApproval,
} from "../../packages/core/src/domain/Approvals";
import { sealDiff, sealsOf, type Seals } from "../../packages/core/src/domain/DeltaSeal";
import { error, warning, type Diagnostic } from "./diagnostics";
import { designFiles, outsideDesign } from "../../packages/core/src/domain/DesignScope";
import { levelOf, readGatePolicy } from "./gate-policy";
import { needsTest } from "../plugin/project-state";

/**
 * The project side of roles and approvals (REQ-310..315, ADR-0045): the
 * settings in `harness.config.yaml`, the git identity of whoever approves, and
 * `approvals.json` in the change folder — which moves to the archive with it.
 */

export const APPROVALS_FILE = "approvals.json";

const changeDir = (projectDir: string, id: string) =>
  path.join(projectDir, "docs", "specs", "changes", id);

function read(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/** `roles:` and `approvals:` of `harness.config.yaml`; the defaults without one. */
export function approvalSettings(projectDir: string): ApprovalSettings {
  const text = read(path.join(projectDir, "harness.config.yaml"));
  const parsed = text ? parseYamlLite(text) : {};
  return readApprovalSettings(
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  );
}

/** Who runs the command, as git knows them in this project. */
export function gitIdentity(projectDir: string): Identity {
  const get = (key: string) =>
    (spawnSync("git", ["config", key], { cwd: projectDir, encoding: "utf8" }).stdout || "").trim();
  return { name: get("user.name"), email: get("user.email") };
}

/** `rigor:` in change.yaml: `full`, or `lite` (the default). */
export function changeRigor(projectDir: string, id: string): string {
  const yaml = read(path.join(changeDir(projectDir, id), "change.yaml")) || "";
  return (/^rigor:\s*(\S+)/m.exec(yaml) || [])[1] || "lite";
}

/** The change's schema: `layered` from 1.0 on, `spec-driven` for a 0.27 change. */
export function changeSchema(projectDir: string, id: string): string {
  const yaml = read(path.join(changeDir(projectDir, id), "change.yaml")) || "";
  return (/^schema:\s*(\S+)/m.exec(yaml) || [])[1] || "spec-driven";
}

/** Each layer and its text, or null when it is missing or still as scaffolded. */
function layerTexts(projectDir: string, id: string) {
  const dir = changeDir(projectDir, id);
  return LAYERS.map((l) => {
    const file =
      l.id === "discover" && !fs.existsSync(path.join(dir, l.file)) ? LEGACY_DISCOVER : l.file;
    const text = read(path.join(dir, file));
    const written = text !== null && !isUntouchedLayer(l.id, text, id);
    return { id: l.id, owner: l.owner as string, file, text: written ? text : null };
  });
}

/** The record of `approvals.json` that holds the requirements' seals (REQ-739). */
export const SEALS_LAYER = "requirements";

export interface SealRecord {
  layer: typeof SEALS_LAYER;
  seals: Seals;
  by: Identity;
  at: string;
}

function allRecords(projectDir: string, id: string): Array<ApprovalRecord | SealRecord> {
  const text = read(path.join(changeDir(projectDir, id), APPROVALS_FILE));
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** The layers' approvals: the seals' record is not one of them. */
export function readRecords(projectDir: string, id: string): ApprovalRecord[] {
  return allRecords(projectDir, id).filter(
    (r): r is ApprovalRecord => (r.layer as string) !== SEALS_LAYER
  );
}

/** The seals the last approval recorded, or null when none ever did (REQ-741). */
export function readSeals(projectDir: string, id: string): SealRecord | null {
  const found = allRecords(projectDir, id).filter(
    (r): r is SealRecord => (r.layer as string) === SEALS_LAYER
  );
  const last = found[found.length - 1];
  return last && last.seals && typeof last.seals === "object" ? last : null;
}

/** Every delta of the change: `specs/<capability>/spec.md`. */
function deltaTexts(projectDir: string, id: string): string[] {
  const dir = path.join(changeDir(projectDir, id), "specs");
  let names: string[] = [];
  try {
    names = fs.readdirSync(dir).sort();
  } catch {
    return [];
  }
  return names
    .map((n) => read(path.join(dir, n, "spec.md")))
    .filter((t): t is string => t !== null);
}

/** The seals of the change's requirements as its deltas are now. */
export function currentSeals(projectDir: string, id: string): Seals {
  return sealsOf(deltaTexts(projectDir, id));
}

function writeRecords(
  projectDir: string,
  id: string,
  records: ApprovalRecord[],
  seals: SealRecord | null
): void {
  fs.writeFileSync(
    path.join(changeDir(projectDir, id), APPROVALS_FILE),
    `${JSON.stringify(seals ? [...records, seals] : records, null, 2)}\n`,
    "utf8"
  );
}

export interface SealFinding {
  requirement: string;
  what: "changed" | "added" | "gone";
}

/**
 * What an approved change's requirements are against their seals (REQ-740):
 * `unsealed` when its approval recorded none (REQ-741), else each requirement
 * that changed, was added after the approval, or is gone.
 */
export function sealFindings(
  projectDir: string,
  id: string
): { unsealed: boolean; findings: SealFinding[] } {
  const record = readSeals(projectDir, id);
  if (!record) return { unsealed: true, findings: [] };
  const d = sealDiff(record.seals, currentSeals(projectDir, id));
  return {
    unsealed: false,
    findings: [
      ...d.changed.map((requirement) => ({ requirement, what: "changed" as const })),
      ...d.added.map((requirement) => ({ requirement, what: "added" as const })),
      ...d.gone.map((requirement) => ({ requirement, what: "gone" as const })),
    ],
  };
}

export interface ChangeApprovals {
  change: string;
  schema: string;
  /** Whether the harness waits for these approvals (REQ-315). */
  required: boolean;
  layers: LayerApproval[];
  approved: boolean;
  /** When the last approval that counts was given, or "". */
  approvedAt: string;
  /** Whether the change has any record at all. */
  recorded: boolean;
}

export function changeApprovals(projectDir: string, id: string): ChangeApprovals {
  const settings = approvalSettings(projectDir);
  const records = readRecords(projectDir, id);
  const layers = layerApprovals(layerTexts(projectDir, id), records, settings);
  const schema = changeSchema(projectDir, id);
  // A change with none of its layers written — a delta and nothing else — is
  // approved as 0.27 approved it: by the `approved:` line `change approve` writes.
  const line = approvedLine(projectDir, id);
  const anyWritten = layers.some((l) => l.present);
  // REQ-599: at full rigor the design is owed — not written is not approved.
  const designOwed =
    schema === "layered" &&
    changeRigor(projectDir, id) === "full" &&
    !layers.some((l) => l.layer === "design" && l.present);
  const approved = designOwed ? false : anyWritten ? changeApproved(layers) : Boolean(line);
  const dates = layers.flatMap((l) => l.approvals.map((a) => a.at)).sort();
  return {
    change: id,
    schema,
    required: approvalsRequired(schema, settings),
    layers,
    approved,
    approvedAt: !approved ? "" : anyWritten ? dates[dates.length - 1] || "" : line,
    recorded: records.length > 0,
  };
}

/** The date on the `approved:` line of `change.yaml`, or "". */
function approvedLine(projectDir: string, id: string): string {
  const yaml = read(path.join(changeDir(projectDir, id), "change.yaml")) || "";
  return (/^approved:\s*(\S+)/m.exec(yaml) || [])[1] || "";
}

export type LayerApproveOutcome =
  | { ok: true; change: string; approved: string; layers: LayerId[]; pending: LayerId[] }
  | { ok: false; code: string; message: string; fix?: string };

/** Keep `approved:` in `change.yaml` in step with the approvals: written once all are in. */
function syncApprovedLine(projectDir: string, id: string, date: string): void {
  const file = path.join(changeDir(projectDir, id), "change.yaml");
  const yaml = read(file) || "";
  const without = yaml.replace(/^approved:.*\n?/m, "");
  const next = date ? `${without.replace(/\n*$/, "\n")}approved: ${date}\n` : without;
  if (next !== yaml) fs.writeFileSync(file, next, "utf8");
}

/**
 * Record the person's approval of the given layers — or, with `null`, of every
 * written layer they own (REQ-311). Refuses a layer that is not written or
 * whose owning role the person does not hold, naming the role and its people.
 */
export function approveLayers(
  projectDir: string,
  id: string,
  layers: LayerId[] | null,
  today: string,
  who: Identity = gitIdentity(projectDir)
): LayerApproveOutcome {
  if (!fs.existsSync(changeDir(projectDir, id))) {
    return { ok: false, code: "change_not_found", message: `No open change ${id}.` };
  }
  const settings = approvalSettings(projectDir);
  const texts = layerTexts(projectDir, id);
  const present = texts.filter((t) => t.text !== null);
  const person = who.email || who.name || "this git identity";
  const ownerOf = (owner: string) => {
    const people = settings.roles[owner] || [];
    return `the ${owner} role${people.length ? ` (${people.join(", ")})` : ""}`;
  };
  let targets: typeof texts;
  if (layers) {
    targets = [];
    for (const l of layers) {
      const t = texts.find((x) => x.id === l);
      if (!t) {
        return {
          ok: false,
          code: "approve_unknown_layer",
          message: `${l} is not a layer: discover, design or tasks.`,
        };
      }
      if (t.text === null) {
        return {
          ok: false,
          code: "approve_layer_missing",
          message: `${id} has no ${t.file} written yet: there is nothing of the ${l} to approve.`,
          fix: `Write ${t.file}, then approve it.`,
        };
      }
      if (!holdsRole(settings, t.owner, who)) {
        return {
          ok: false,
          code: "approve_not_owner",
          message: `${person} cannot approve the ${l} of ${id}: it belongs to ${ownerOf(t.owner)}.`,
          fix: `Have someone in the ${t.owner} role run specgate change approve ${id} --layer ${l}, or name ${person} under roles.${t.owner} in harness.config.yaml.`,
        };
      }
      targets.push(t);
    }
  } else {
    targets = present.filter((t) => holdsRole(settings, t.owner, who));
    if (present.length > 0 && targets.length === 0) {
      return {
        ok: false,
        code: "approve_not_owner",
        message: `${person} holds none of the roles that own the layers of ${id}: ${present
          .map((t) => `${t.id} → ${t.owner}`)
          .join(", ")}.`,
        fix: "Name them under roles: in harness.config.yaml, or have the owners approve.",
      };
    }
  }

  const records = readRecords(projectDir, id);
  for (const t of targets) {
    const hash = contentHash(t.text as string);
    const key = (who.email || who.name).toLowerCase();
    const already = records.some(
      (r) => r.layer === t.id && r.hash === hash && (r.by.email || r.by.name).toLowerCase() === key
    );
    if (!already) records.push({ layer: t.id, by: who, role: t.owner, hash, at: today });
  }
  // REQ-739: approving the change seals its requirements, at lite rigor with
  // nothing written in its layers too. Approving one layer seals them only
  // when nothing did yet: a layer's owner does not re-seal what another rewrote.
  const sealed = readSeals(projectDir, id);
  const seals: SealRecord | null =
    !layers || !sealed
      ? { layer: SEALS_LAYER, seals: currentSeals(projectDir, id), by: who, at: today }
      : sealed;
  if (targets.length > 0 || seals !== sealed) writeRecords(projectDir, id, records, seals);
  const after = changeApprovals(projectDir, id);
  // A 0.27 change with none of the layers written is approved as 0.27 did it.
  const date = present.length === 0 ? today : after.approvedAt;
  syncApprovedLine(projectDir, id, date);
  return {
    ok: true,
    change: id,
    approved: date,
    layers: targets.map((t) => t.id),
    pending: after.layers.filter((l) => l.present && !l.approved).map((l) => l.layer),
  };
}

/** Why the harness must not build the change yet, or null when it may (REQ-315). */
export function missingApprovals(
  projectDir: string,
  id: string
): { message: string; fix: string } | null {
  const state = changeApprovals(projectDir, id);
  if (!state.required || state.approved) return null;
  // REQ-599: a full-rigor change whose design nobody wrote yet.
  const design = state.layers.find((l) => l.layer === "design");
  if (design && !design.present && changeRigor(projectDir, id) === "full") {
    return {
      message: `${id} is not approved: its design is not written (rigor: full).`,
      fix: `Write docs/specs/changes/${id}/design.md, then specgate change approve ${id} --layer design, by the ${design.owner} role — or rigor: lite in its change.yaml.`,
    };
  }
  const waiting = state.layers.filter((l) => l.present && !l.approved);
  const what = waiting.length
    ? waiting
        .map(
          (l) =>
            `${l.layer} (${l.approvals.length} of ${l.quorum} approval(s), by the ${l.owner} role)`
        )
        .join(", ")
    : "nobody approved it";
  const layer = waiting[0];
  return {
    message: `${id} is not approved: ${what}.`,
    fix: layer
      ? `specgate change approve ${id} --layer ${layer.layer}, by the ${layer.owner} role — or approvals: { required: never } in harness.config.yaml for the 0.27 behaviour.`
      : `specgate change approve ${id} — or approvals: { required: never } in harness.config.yaml for the 0.27 behaviour.`,
  };
}

const SEAL_SAID = {
  changed: "changed since the approval: its statement or its scenarios are not what was approved",
  added: "was added after the approval",
  gone: "was approved and is gone from the delta",
};

/**
 * What the gate says of one open change's approval (REQ-740, REQ-741): an
 * error for each requirement that is not what was approved, or the warning
 * that its approval sealed nothing. The fix is in the message too: `check`
 * and `apply` print one fix line per refusal, their own.
 */
export function sealDiagnostics(
  projectDir: string,
  id: string
): { errors: Diagnostic[]; warnings: Diagnostic[] } {
  const fix = `specgate change approve ${id}`;
  const target = `docs/specs/changes/${id}`;
  const state = sealFindings(projectDir, id);
  if (state.unsealed) {
    const approved = isApproved(projectDir, id);
    return {
      errors: [],
      warnings: approved
        ? [
            warning(
              "approval_not_sealed",
              `${id} was approved before approvals sealed the requirements: one of them can change and the gate will not see it. Seal it: ${fix}.`,
              { target, fix }
            ),
          ]
        : [],
    };
  }
  return {
    errors: state.findings.map((f) =>
      error(
        "approved_requirement_changed",
        `${f.requirement} of ${id} ${SEAL_SAID[f.what]}. If that is what is wanted, approve it again: ${fix}.`,
        { target, fix }
      )
    ),
    warnings: [],
  };
}

/** Whether the change is approved as the gate reads it; by its `approved:` line where its approvals cannot be read. */
function isApproved(projectDir: string, id: string): boolean {
  // A project whose roles or approvals cannot be read (0.35 wrote them
  // otherwise) says so where they are asked for; here it is read by its line.
  try {
    const approvals = changeApprovals(projectDir, id);
    if (approvals.schema === "layered" || approvals.recorded) return approvals.approved;
  } catch {
    /* the `approved:` line stands */
  }
  return Boolean(approvedLine(projectDir, id));
}

/** The source files new in the working tree — untracked or added —, from the project root; none where git cannot say. */
function newSourceFiles(projectDir: string): string[] {
  const r = spawnSync("git", ["status", "--porcelain", "--untracked-files=all", "-z"], {
    cwd: projectDir,
    encoding: "utf8",
    timeout: 10_000,
  });
  if (r.status !== 0) return [];
  return (r.stdout || "")
    .split("\0")
    .filter((e) => /^(\?\?|A[ M])/.test(e))
    .map((e) => e.slice(3))
    .filter(needsTest);
}

/**
 * REQ-744: the new source files no approved design names, for the changes
 * given — as errors or warnings by the gate's rule `scope`, nothing where it
 * is off or where no approved design names a file.
 */
export function scopeDiagnostics(
  projectDir: string,
  ids: string[]
): { errors: Diagnostic[]; warnings: Diagnostic[] } {
  const none = { errors: [], warnings: [] };
  let level = "error";
  try {
    level = levelOf(readGatePolicy(projectDir), "scope");
  } catch {
    return none;
  }
  if (level === "off") return none;
  const designs = ids
    .filter((id) => isApproved(projectDir, id))
    .map((id) => ({
      id,
      files: designFiles(layerTexts(projectDir, id).find((l) => l.id === "design")?.text ?? ""),
    }))
    .filter((d) => d.files.length > 0);
  if (designs.length === 0) return none;
  const outside = outsideDesign(
    newSourceFiles(projectDir),
    designs.flatMap((d) => d.files)
  );
  const change = designs[0]!.id;
  const found = outside.map((file) => {
    const message = `${file} is new, and the design of ${designs.map((d) => d.id).join(", ")} does not name it. Name it in docs/specs/changes/${change}/design.md and have the design approved again, or open a change for it: specgate propose <change-id>.`;
    const extra = {
      target: file,
      fix: `Name ${file} in docs/specs/changes/${change}/design.md, then specgate change approve ${change} — or specgate propose <change-id>.`,
    };
    return level === "error"
      ? error("file_outside_design", message, extra)
      : warning("file_outside_design", message, extra);
  });
  return level === "error" ? { errors: found, warnings: [] } : { errors: [], warnings: found };
}
