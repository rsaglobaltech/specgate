export interface PromptRequirement {
  requirement: string;
  scenarioId?: string;
  scenario_id?: string;
  category?: string;
  featureFile?: string;
  feature_file?: string;
  testArtifact?: string;
  test_artifact?: string;
  technicalArtifact?: string;
  technical_artifact?: string;
  status?: string;
  [key: string]: any;
}

export interface PromptOptions {
  promptPrefix?: string;
  hint?: string;
  previousFailure?: string;
  /** What an advisory reviewer said about the previous attempt. */
  reviewFindings?: string;
  attempt?: number;
  maxAttempts?: number;
  featureContent?: string | null;
  aiRulesContent?: string | null;
  stageRules?: string[];
  /** Ask the use case to look one up. `precedent` is what it found. */
  withPrecedents?: boolean;
  /**
   * An already-accepted requirement to show as an example (D2, opt-in).
   *
   * Everything else in this prompt is normative — it says what must be true.
   * This is the one part that says what "done, and accepted, here" looks like.
   */
  precedent?: {
    requirementId: string;
    testArtifact?: string;
    testExcerpt?: string;
    technicalArtifact?: string;
    technicalExcerpt?: string;
  } | null;
  /**
   * The `## REQ-NNN` section from `spec.md`.
   *
   * Without it the prompt said `# Implement REQ-002`, listed every fact as
   * `-`, and asked the agent to "create it from the requirement" — with the
   * requirement nowhere in the prompt. A cold evaluator: *"the loop doesn't
   * close on a brownfield adopt"*. It could not: there was nothing to read.
   */
  requirementText?: string;
}

export class AgentPrompt {
  public static build(req: PromptRequirement, opts: PromptOptions = {}): string {
    const parts: string[] = [];

    if (opts.promptPrefix && String(opts.promptPrefix).trim()) {
      parts.push(String(opts.promptPrefix).trimEnd());
      parts.push("---");
    }

    parts.push(
      `# Implement ${req.requirement}\n\n` +
        `You are a coding agent working inside a spec-driven project. Implement ` +
        `exactly one requirement — **${req.requirement}** — following the project's ` +
        `existing conventions. Do not touch unrelated files.`
    );

    const field = (camel: string, snake: string) => {
      const val = req[camel] !== undefined ? req[camel] : req[snake];
      return val === null || val === undefined ? "" : val;
    };

    const facts = [
      `- Requirement: ${req.requirement}`,
      `- Scenario ID: ${field("scenarioId", "scenario_id") || "(none)"}`,
      `- plan category: ${req.category || ""}`,
      `- Feature file: ${field("featureFile", "feature_file") || "(none declared)"}`,
      `- Test artifact (write this first — TDD): ${field("testArtifact", "test_artifact") || "(none declared)"}`,
      `- Production artifact: ${field("technicalArtifact", "technical_artifact") || "(none declared)"}`,
      `- Current status: ${req.status || "(none)"}`,
    ].join("\n");
    // Before the facts, because it is the thing being implemented and the facts
    // are only pointers to where it goes.
    if (opts.requirementText && String(opts.requirementText).trim()) {
      parts.push(
        AgentPrompt.section("The requirement (spec.md)", String(opts.requirementText).trimEnd())
      );
    } else {
      parts.push(
        AgentPrompt.section(
          "The requirement (spec.md)",
          `\`spec.md\` has no \`## ${req.requirement}\` section, so this prompt cannot ` +
            `tell you what ${req.requirement} requires.\n\n` +
            `Do not guess. Stop and report that the requirement has no text — an ` +
            `implementation invented from a table row is worse than no implementation, ` +
            `because the matrix will then claim it is covered.`
        )
      );
    }

    parts.push(AgentPrompt.section("Requirement facts", facts));

    if (opts.hint) {
      parts.push(AgentPrompt.section("Suggested approach", opts.hint));
    }

    // `req add` writes `-` in the Feature file column by design, and this used
    // to render it as a filename: "The feature file `-` does not exist yet.
    // Create it." Every requirement made the documented way hit that, and an
    // evaluator stopped rather than pay an agent to find out what a file named
    // `-` was supposed to be.
    const rawFeature = String(field("featureFile", "feature_file") || "")
      .replace(/^`|`$/g, "")
      .trim();
    const featureRel = rawFeature === "-" ? "" : rawFeature;
    const featureUndeclared = rawFeature === "" || rawFeature === "-";

    if (featureRel) {
      if (opts.featureContent) {
        parts.push(
          AgentPrompt.section(
            `Gherkin scenario (${featureRel})`,
            "```gherkin\n" + opts.featureContent.trimEnd() + "\n```"
          )
        );
      } else {
        parts.push(
          AgentPrompt.section(
            "Gherkin scenario",
            `The feature file \`${featureRel}\` does not exist yet. Create it from the ` +
              `requirement before writing code.`
          )
        );
      }
    } else if (featureUndeclared) {
      parts.push(
        AgentPrompt.section(
          "Gherkin scenario",
          `This requirement declares no feature file — the matrix cell is empty.\n\n` +
            `Write the scenario first, as \`features/<area>/<behaviour>.feature\`, tagged ` +
            `\`@${req.requirement}\` and \`@${
              field("scenarioId", "scenario_id") || "SCN-NNN"
            }\` above its \`Scenario:\` line. Then record it:\n\n` +
            `    specgate req link ${req.requirement} --feature <path>\n\n` +
            `Creating a file that does not exist is not editing the contract — the ` +
            `rule below is about changing scenarios that are already there.`
        )
      );
    }

    if (opts.aiRulesContent) {
      parts.push(
        AgentPrompt.section(
          "Project rules (AI_RULES.md — non-negotiable)",
          opts.aiRulesContent.trimEnd()
        )
      );
    }

    if (opts.precedent && (opts.precedent.testExcerpt || opts.precedent.technicalExcerpt)) {
      const p = opts.precedent;
      const body: string[] = [
        `${p.requirementId} was accepted in this same bounded context. Match its ` +
          `structure, naming and test style — this is what "done" looks like here.`,
        "",
      ];
      if (p.testExcerpt) {
        body.push(`**Its test — \`${p.testArtifact}\`**`, "", "```", p.testExcerpt, "```", "");
      }
      if (p.technicalExcerpt) {
        body.push(
          `**Its implementation — \`${p.technicalArtifact}\`**`,
          "",
          "```",
          p.technicalExcerpt,
          "```",
          ""
        );
      }
      // Named a precedent, not a rule: the agent must not conclude that copying
      // it satisfies a different requirement.
      body.push(
        "This is an example of *shape*, not of behaviour. Your requirement is the " +
          "one above; do not copy its assertions."
      );
      parts.push(
        AgentPrompt.section("Precedent — an accepted requirement nearby", body.join("\n"))
      );
    }

    const baseRules = opts.stageRules || [
      "Write the test first against the technical artifact path declared in the requirement.",
      "Run the project test command; verify the test fails for the expected reason.",
      "Implement the requirement; verify the test passes.",
    ];

    const doneRules = [
      ...baseRules,
      "**Do not modify** `spec.md`, `AI_RULES.md`, or any existing `features/**/*.feature` — " +
        "they are the contract you are being judged against. Creating a feature file that " +
        "does not exist yet is not modifying one, and the gate allows it: an agent asked " +
        "to write a missing scenario is not being asked to break this rule.",
      "The harness will run `validate . --strict` and the project test command. Both must pass.",
    ];
    parts.push(
      AgentPrompt.section(
        "Definition of done",
        doneRules.map((r, i) => `${i + 1}. ${r}`).join("\n")
      )
    );

    if (opts.previousFailure) {
      parts.push(
        AgentPrompt.section(
          `Previous attempt failed (attempt ${(opts.attempt || 2) - 1}` +
            `${opts.maxAttempts ? ` of ${opts.maxAttempts}` : ""})`,
          "The gate rejected the last attempt. Fix the specific failure below — do not " +
            "start over.\n\n```\n" +
            String(opts.previousFailure).trim().slice(-4000) +
            "\n```"
        )
      );
    }

    if (opts.reviewFindings) {
      parts.push(
        AgentPrompt.section(
          "Reviewer findings",
          "A reviewer read the previous attempt and reported the following. These are " +
            "advice, not a verdict: the gate decides, and a finding it does not care " +
            "about must not send you off-spec.\n\n```\n" +
            String(opts.reviewFindings).trim().slice(-4000) +
            "\n```"
        )
      );
    }

    return parts.join("\n");
  }

  private static section(title: string, body: string): string {
    return `## ${title}\n\n${body}\n`;
  }
}
