/**
 * Turning a board issue into a proposal a human can review.
 *
 * ADR-0021 fixes the shape of this: an ALM issue never becomes a matrix row.
 * It becomes a `change` — a proposal and a delta — which then passes through
 * `change validate` and `change archive` like any change written by hand. The
 * board is a mirror, and a mirror does not get to define a requirement.
 *
 * **The scenarios are left empty on purpose, and that is the whole design.**
 * A Jira ticket has a title, a description and a status. It does not contain an
 * executable acceptance criterion, and deriving Gherkin from prose would be
 * inventing the one thing the spec exists to pin down. The empty scenario is
 * not an unfinished feature: it is the marker for the only work that cannot be
 * automated, and `change validate` will refuse the change until a person — or
 * the `spec-author` role — fills it in.
 *
 * Pure: an issue in, markdown out. Reading the board is the provider's job and
 * writing the folder is the change lifecycle's, which is also what keeps the
 * ALM subsystem free of any write path into the spec tree.
 */

export interface InboundIssue {
  readonly key: string;
  readonly title: string;
  readonly body: string;
  readonly url: string | null;
}

export interface InboundChangePlan {
  /** The change id, derived from the issue so re-running finds the same one. */
  changeId: string;
  proposal: string;
  /** The delta, with its scenario deliberately unwritten. */
  delta: string;
  capability: string;
}

/** `ACME-42 Add dynamic pricing` → `alm-acme-42`. Stable, so a second pull is idempotent. */
export function inboundChangeId(issueKey: string): string {
  const slug = String(issueKey)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `alm-${slug || "issue"}`;
}

/** A capability name that will not surprise anyone: the issue's own key. */
function capabilityFor(issue: InboundIssue): string {
  return inboundChangeId(issue.key).replace(/^alm-/, "") || "inbound";
}

/**
 * The proposal, seeded from what the board actually holds.
 *
 * The issue's own words go in verbatim and are labelled as such. Summarising
 * them would put this tool's paraphrase where the reporter's intent should be,
 * and the reviewer would have no way to tell which was which.
 */
function renderProposal(issue: InboundIssue, reqId: string): string {
  const body = issue.body.trim();
  return [
    `# Proposal: ${issue.title.trim() || issue.key}`,
    "",
    "## Intent",
    "",
    `Raised as ${issue.key}${issue.url ? ` (${issue.url})` : ""}.`,
    "",
    "> Imported verbatim from the board. It has not been edited, summarised or",
    "> interpreted — what the reporter wrote is what a reviewer should read.",
    "",
    body
      ? body
          .split("\n")
          .map((l) => `> ${l}`)
          .join("\n")
      : "> _(the issue has no description)_",
    "",
    "## Scope",
    "",
    "In scope:",
    "",
    `- ${reqId}, as described above`,
    "",
    "Out of scope:",
    "",
    "- <!-- A proposal that excludes nothing has not been thought about. -->",
    "",
    "## Acceptance criteria",
    "",
    "**Not yet written, and that is the point.** A board issue carries a title,",
    "a description and a status; it does not carry an executable acceptance",
    "criterion. Write the scenario in the delta before this change can be",
    "validated.",
    "",
  ].join("\n");
}

/**
 * The delta, with a requirement and an unwritten scenario.
 *
 * The scenario heading exists so the shape is obvious and the gap is visible;
 * its steps are a TODO rather than a guess. `change validate` fails while they
 * stay that way, which is the intended behaviour, not an inconvenience.
 */
function renderDelta(issue: InboundIssue, reqId: string, scenarioId: string): string {
  const title = issue.title.trim() || issue.key;
  return [
    `# Delta — ${capabilityFor(issue)}`,
    "",
    "## ADDED Requirements",
    "",
    `### Requirement: ${reqId} — ${title}`,
    "",
    `The system SHALL satisfy what ${issue.key} describes.`,
    "",
    "<!-- Replace this sentence with the requirement in your own words. The",
    "     issue's text is in proposal.md; a requirement is not its description. -->",
    "",
    `#### Scenario: ${scenarioId} — TODO`,
    "",
    "- GIVEN <!-- the precondition -->",
    "- WHEN <!-- the action -->",
    "- THEN <!-- the observable outcome -->",
    "",
    "<!-- These steps are deliberately unwritten. The board cannot supply them:",
    "     a ticket has no executable acceptance criterion, and inventing one",
    "     would defeat the only check this tool can make. `change validate`",
    "     stays red until they say something real. -->",
    "",
    `<!-- specgate:trace origin=alm:${issue.key} -->`,
    "",
  ].join("\n");
}

/** Everything needed to write one change folder, decided without touching a disk. */
export function planInboundChange(
  issue: InboundIssue,
  reqId: string,
  scenarioId: string
): InboundChangePlan {
  return {
    changeId: inboundChangeId(issue.key),
    capability: capabilityFor(issue),
    proposal: renderProposal(issue, reqId),
    delta: renderDelta(issue, reqId, scenarioId),
  };
}
