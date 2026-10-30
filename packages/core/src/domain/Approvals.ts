/**
 * Roles and approvals per layer (REQ-310..315, ADR-0043).
 *
 * Pure: who holds a role, what an approval of a layer is worth against the
 * layer's current text, and whether a change is approved. Reading the config,
 * the git identity and `approvals.json` is the caller's.
 */

import { createHash } from "node:crypto";
import { LAYERS, type LayerId } from "./ChangeLayers";

export type { LayerId } from "./ChangeLayers";

/** A role's name (product, architect, developer, security, …) → who holds it. */
export type Roles = Record<string, string[]>;

/** Which changes need their approvals before the harness builds them. */
export type ApprovalRequirement = "layered" | "always" | "never";

export interface ApprovalSettings {
  roles: Roles;
  required: ApprovalRequirement;
  /** How many distinct people each layer needs; 1 when unset. */
  quorum: Partial<Record<LayerId, number>>;
}

export interface Identity {
  name: string;
  email: string;
}

/** One line of `approvals.json`: who approved which version of a layer, and when. */
export interface ApprovalRecord {
  layer: LayerId;
  by: Identity;
  role: string;
  hash: string;
  at: string;
}

const REQUIRED: ApprovalRequirement[] = ["layered", "always", "never"];

const asList = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map((x) => String(x).trim()).filter(Boolean)
    : v === undefined || v === null || v === ""
      ? []
      : [String(v).trim()];

/**
 * The settings from the parsed `roles:` and `approvals:` of
 * `harness.config.yaml`. Throws on a value it cannot read, naming it.
 */
export function readApprovalSettings(parsed: Record<string, unknown>): ApprovalSettings {
  const roles: Roles = {};
  const rawRoles = parsed.roles;
  if (rawRoles !== undefined && rawRoles !== null) {
    if (typeof rawRoles !== "object" || Array.isArray(rawRoles)) {
      throw new Error("roles: must map each role to the people who hold it");
    }
    for (const [role, who] of Object.entries(rawRoles as Record<string, unknown>)) {
      roles[role.trim()] = asList(who);
    }
  }
  const raw = (parsed.approvals || {}) as Record<string, unknown>;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("approvals: must be a mapping (required, quorum)");
  }
  const required = String(raw.required ?? "layered").trim() as ApprovalRequirement;
  if (!REQUIRED.includes(required)) {
    throw new Error(`approvals.required: '${required}' is not one of ${REQUIRED.join(", ")}`);
  }
  const quorum: Partial<Record<LayerId, number>> = {};
  for (const [layer, n] of Object.entries((raw.quorum || {}) as Record<string, unknown>)) {
    if (!LAYERS.some((l) => l.id === layer)) {
      throw new Error(`approvals.quorum.${layer}: not a layer (discover, design, tasks)`);
    }
    const count = Number(n);
    if (!Number.isInteger(count) || count < 1) {
      throw new Error(`approvals.quorum.${layer}: '${n}' is not a whole number of people`);
    }
    quorum[layer as LayerId] = count;
  }
  return { roles, required, quorum };
}

const norm = (s: string) => s.trim().toLowerCase();

/** Whether the person is one of a role's entries: their email or their name. */
function named(entries: string[], who: Identity): boolean {
  const mine = [who.email, who.name].filter(Boolean).map(norm);
  return entries.some((e) => mine.includes(norm(e)));
}

/** Whether the person holds the role. A role nobody is named for is open to anyone. */
export function holdsRole(settings: ApprovalSettings, role: string, who: Identity): boolean {
  const entries = settings.roles[role];
  if (!entries || entries.length === 0) return true;
  return named(entries, who);
}

/** Every role the person holds: the ones naming them, and the ones naming nobody. */
export function rolesHeld(settings: ApprovalSettings, who: Identity): string[] {
  const roles = new Set<string>([...LAYERS.map((l) => l.owner), ...Object.keys(settings.roles)]);
  return [...roles].filter((r) => holdsRole(settings, r, who)).sort();
}

const sha = (text: string) =>
  `sha256:${createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex")}`;

/**
 * The hash an approval is of: line endings do not count, the text does, and a
 * task box counts as open whether it is ticked or not (REQ-370). Delivering a
 * requirement ticks its task (REQ-353); hashing the tick made the harness
 * refuse a change's second requirement as "not approved: tasks" (truck-flote,
 * MS2-8). Any other edit still changes the hash (REQ-314).
 */
export function contentHash(text: string): string {
  return sha(text.replace(/^(\s*[-*+]\s*)\[[xX]\]/gm, "$1[ ]"));
}

/** The hash of the text as written: what 1.0.0-rc.1 and rc.2 recorded (REQ-371). */
export function rawContentHash(text: string): string {
  return sha(text);
}

export interface LayerApproval {
  layer: LayerId;
  owner: string;
  file: string;
  /** The layer is written: an unwritten layer is not asked for. */
  present: boolean;
  quorum: number;
  /** Approvals of the text as it is now, one per person. */
  approvals: ApprovalRecord[];
  /** Approvals of an earlier text: the layer changed after them (REQ-314). */
  stale: ApprovalRecord[];
  approved: boolean;
}

const personKey = (who: Identity) => norm(who.email || who.name);

/** What each layer's approvals are worth against its current text. */
export function layerApprovals(
  layers: Array<{ id: LayerId; owner: string; file: string; text: string | null }>,
  records: ApprovalRecord[],
  settings: ApprovalSettings
): LayerApproval[] {
  return layers.map((l) => {
    const hash = l.text === null ? "" : contentHash(l.text);
    // REQ-371: a record of an earlier candidate hashed the text as written.
    const raw = l.text === null ? "" : rawContentHash(l.text);
    const matches = (r: ApprovalRecord) => r.hash === hash || r.hash === raw;
    const mine = records.filter((r) => r.layer === l.id);
    const current: ApprovalRecord[] = [];
    const seen = new Set<string>();
    for (const r of mine) {
      if (!matches(r)) continue;
      const key = personKey(r.by);
      if (seen.has(key)) continue;
      seen.add(key);
      current.push(r);
    }
    const stale = mine.filter((r) => !matches(r));
    const quorum = settings.quorum[l.id] || 1;
    return {
      layer: l.id,
      owner: l.owner,
      file: l.file,
      present: l.text !== null,
      quorum,
      approvals: current,
      stale,
      approved: l.text !== null && current.length >= quorum,
    };
  });
}

/** Whether a change of this schema needs its approvals before it is built (REQ-315). */
export function approvalsRequired(schema: string, settings: ApprovalSettings): boolean {
  if (settings.required === "never") return false;
  if (settings.required === "always") return true;
  return schema === "layered";
}

/** A change is approved when every written layer is, and at least one is written. */
export function changeApproved(layers: LayerApproval[]): boolean {
  const present = layers.filter((l) => l.present);
  return present.length > 0 && present.every((l) => l.approved);
}
