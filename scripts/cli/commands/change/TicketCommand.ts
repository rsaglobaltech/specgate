/**
 * `specgate propose --from-ticket <KEY | issue.json>` — a Jira ticket as the
 * source text of a change (ADR-0039).
 *
 * Reading the ticket is the ALM provider's job and stays read-only; writing
 * the change is this command's, as `alm pull` writes its own outside
 * `scripts/alm/` (ADR-0021 §1).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { BaseCommand } from "../../../lib/command";
import * as ui from "../../../lib/ui";
import { agentIo } from "../../../lib/agent";
import { error } from "../../../lib/diagnostics";
import { resolveProjectDir } from "../../../lib/project-root";
import { readAlmConfig } from "../../../alm/core";
import { makeClient } from "../../../alm/clients";
import type { AlmConfig } from "../../../alm/port";
import { readTicket } from "../../../../packages/core/src/domain/TicketText";
import type { Ticket } from "../../../../packages/core/src/domain/TicketText";

export interface TicketOptions {
  ticket: string;
  check: boolean;
  json: boolean;
  projectDir: string;
}

const NULL_SHAPE = { ticket: null };

export function parseTicketArgs(argv: string[]): TicketOptions {
  const opts: TicketOptions = { ticket: "", check: false, json: false, projectDir: "." };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--from-ticket") opts.ticket = argv[++i] ?? "";
    else if (a === "--check") opts.check = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--project-dir") opts.projectDir = argv[++i] ?? ".";
  }
  return opts;
}

/** `alm.config.yaml`, when there is one: a file needs none, a key does. */
function almConfig(projectDir: string): AlmConfig | undefined {
  return fs.existsSync(path.join(projectDir, "alm.config.yaml"))
    ? readAlmConfig(projectDir)
    : undefined;
}

const looksLikeFile = (ref: string) => /\.json$/i.test(ref) || fs.existsSync(ref);

/** The ticket: an exported issue on disk, or the issue read from the board. */
async function loadTicket(ref: string, cfg: AlmConfig | undefined, projectDir: string) {
  const opts = {
    acceptanceField: cfg?.acceptance_field ? String(cfg.acceptance_field) : undefined,
    baseUrl: cfg?.base_url,
  };
  if (looksLikeFile(ref)) {
    const file = path.resolve(ref);
    return readTicket(JSON.parse(fs.readFileSync(file, "utf8")), opts);
  }
  if (!cfg) {
    throw new Error(
      `alm.config.yaml not found in ${projectDir}: reading ${ref} from the board needs it.\n` +
        "Fix: add it (`specgate alm --help`), or export the issue as JSON and pass the file."
    );
  }
  const client = makeClient(cfg, undefined, projectDir);
  if (typeof client.readIssue !== "function") {
    throw new Error(
      `Provider '${cfg.provider}' cannot read one issue.\n` +
        "Fix: export the issue as JSON and pass the file to --from-ticket."
    );
  }
  return readTicket(await client.readIssue(ref), opts);
}

function ticketJson(t: Ticket) {
  return {
    key: t.key,
    summary: t.summary,
    type: t.type,
    parent: t.parent,
    labels: t.labels,
    url: t.url,
    intent: t.intent,
    source: t.source,
    criteria: t.criteria,
    questions: t.questions,
  };
}

export class TicketCommand extends BaseCommand {
  async execute(): Promise<void> {
    const opts = parseTicketArgs(this.args);
    const io = agentIo(opts.json);
    if (!opts.ticket) {
      io.usage(NULL_SHAPE, [
        error("ticket_missing", "--from-ticket needs a ticket key or an exported issue.", {
          fix: "specgate propose --from-ticket KAN-13 --check, or --from-ticket KAN-13.json",
        }),
      ]);
    }
    let projectDir: string;
    let ticket: Ticket;
    try {
      projectDir = resolveProjectDir(opts.projectDir);
      ticket = await loadTicket(opts.ticket, almConfig(projectDir), projectDir);
    } catch (e) {
      return io.fail(NULL_SHAPE, [error("ticket_unreadable", (e as Error).message)]);
    }
    this.check(opts, ticket);
  }

  /** `--check`: the ticket's parts, and what keeps it from being drafted. */
  private check(opts: TicketOptions, ticket: Ticket): void {
    const io = agentIo(opts.json);
    io.emit({ ticket: ticketJson(ticket), status: [] }, () => {
      const out = process.stdout;
      out.write(ui.header("propose --from-ticket --check", ticket.key));
      out.write(
        ui.ok(
          `${ui.bold(ticket.key)} ${ticket.summary} ` +
            ui.muted(
              `· ${ticket.type || "issue"} · ${ticket.criteria.length} criteria · ` +
                `${ticket.questions.length} open question(s)`
            )
        )
      );
    });
  }
}
