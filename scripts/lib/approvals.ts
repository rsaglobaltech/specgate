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

/**
 * The project side of roles and approvals (REQ-310..315, ADR-0043): the
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

export function readRecords(projectDir: string, id: string): ApprovalRecord[] {
  const text = read(path.join(changeDir(projectDir, id), APPROVALS_FILE));
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
  const approved = anyWritten ? changeApproved(layers) : Boolean(line);
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
  if (targets.length > 0) {
    fs.writeFileSync(
      path.join(changeDir(projectDir, id), APPROVALS_FILE),
      `${JSON.stringify(records, null, 2)}\n`,
      "utf8"
    );
  }
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
