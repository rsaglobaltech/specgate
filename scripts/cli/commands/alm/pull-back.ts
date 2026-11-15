/**
 * What a ticket gains comes back to its change as notes (REQ-306).
 *
 * Outside `scripts/alm/` for the reason `alm pull` is: ADR-0021 keeps the ALM
 * subsystem from writing the spec tree, and a note is written into the
 * change. It is written where `change note` writes — `review.md` — and nowhere
 * else: a comment on a ticket is a request a person reads and folds in, never
 * a rewrite of the proposal or the delta.
 */

import * as crypto from "node:crypto";
import { noteChange } from "../../../lib/change-review";
import type { AlmClient } from "../../../alm/port";
import type { BoardChange, PhaseMap } from "../../../alm/phases";

export interface BackAction {
  change: string;
  issue: string;
  action: "comment" | "description" | "comments-unsupported";
  text: string;
}

const hash = (text: string) => crypto.createHash("sha256").update(text).digest("hex");

/** One line of a note: a ticket's text, flattened and kept short enough to read in a table. */
function oneLine(text: string, max = 400): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * Bring back each open change's new comments and changed description.
 *
 * The first pull of a ticket records its description and comes back with its
 * comments; from then on only what changed is noted, so pulling twice adds
 * nothing.
 */
export async function pullBack(
  projectDir: string,
  changes: readonly BoardChange[],
  map: PhaseMap,
  client: AlmClient,
  opts: { dryRun?: boolean; today: string }
): Promise<BackAction[]> {
  const actions: BackAction[] = [];
  for (const change of changes) {
    if (change.archived || !change.ticket) continue;
    const ticket = change.ticket;
    const record = (map[change.id] ??= { ticket });
    const note = (action: BackAction["action"], text: string) => {
      actions.push({ change: change.id, issue: ticket, action, text });
      if (!opts.dryRun && action !== "comments-unsupported") {
        noteChange(projectDir, change.id, text, "", opts.today);
      }
    };

    if (client.capabilities.readText && typeof client.readIssueText === "function") {
      const { body } = await client.readIssueText(ticket);
      const now = hash(body);
      if (record.description && record.description !== now) {
        note("description", `The description of ${ticket} changed: ${oneLine(body)}`);
      }
      if (!opts.dryRun) record.description = now;
    }

    if (!client.capabilities.comments || typeof client.listComments !== "function") {
      actions.push({
        change: change.id,
        issue: ticket,
        action: "comments-unsupported",
        text: `This provider cannot read the comments of ${ticket}; read them on the board.`,
      });
      continue;
    }
    const seen = new Set(record.comments ?? []);
    for (const comment of await client.listComments(ticket)) {
      if (seen.has(comment.id)) continue;
      note(
        "comment",
        `Comment on ${ticket}${comment.author ? ` by ${comment.author}` : ""}: ${oneLine(comment.body)}`
      );
      seen.add(comment.id);
    }
    if (!opts.dryRun) record.comments = [...seen];
  }
  return actions;
}
