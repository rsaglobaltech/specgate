import { IHarnessConfigRepository } from "./ports/IHarnessConfigRepository";
import { AgentPrompt, PromptRequirement, PromptOptions } from "../domain/AgentPrompt";
import { featureFilePath } from "../domain/HarnessRun";
import { choosePrecedent, excerpt, PrecedentRow } from "../domain/Precedents";
import { extractRequirementSection } from "../domain/SpecSections";
import {
  detectTraceabilityMode,
  parseMatrixContexts,
  parseMatrixRows,
  readRowFields,
} from "../domain/TraceabilityFormat";

const MATRIX = "docs/specs/traceability.md";
const CAPABILITIES = "docs/specs/capabilities";

export class GenerateAgentPromptUseCase {
  constructor(private configRepo: IHarnessConfigRepository) {}

  public execute(req: PromptRequirement, projectDir: string, opts: PromptOptions = {}): string {
    const featurePath = featureFilePath(req) || null;
    const featureContent = featurePath
      ? this.configRepo.readProjectFile(projectDir, featurePath)
      : null;
    // AGENTS.md is the agent contract (ADR-0031). Until `specgate update`
    // folds a team's AI_RULES.md into it, both are read: the team's rules must
    // not drop out of the prompt because AGENTS.md appeared.
    const agentsMd = this.configRepo.readProjectFile(projectDir, "AGENTS.md");
    const legacyRules = this.configRepo.readProjectFile(projectDir, "AI_RULES.md");
    const aiRulesContent = [agentsMd, legacyRules].filter(Boolean).join("\n\n") || null;
    const rulesFile = [agentsMd && "AGENTS.md", legacyRules && "AI_RULES.md"]
      .filter(Boolean)
      .join(" + ");

    // The requirement's own prose. Not reading it is how the prompt came to say
    // "Implement REQ-002" with every fact `-` and nothing to implement.
    const specSource = this.configRepo.readProjectFile(projectDir, "spec.md");
    const reqId = String(req.requirement || "");
    let requirementText = specSource ? extractRequirementSection(specSource, reqId) : null;
    // A requirement installed from a pack, or archived from a change, lives in
    // a capability spec. Reading only spec.md told the agent there was no text
    // and to stop — for every one of them.
    if (!requirementText && this.configRepo.listProjectDir) {
      for (const cap of this.configRepo.listProjectDir(projectDir, CAPABILITIES)) {
        const source = this.configRepo.readProjectFile(
          projectDir,
          `${CAPABILITIES}/${cap}/spec.md`
        );
        requirementText = source ? extractRequirementSection(source, reqId) : null;
        if (requirementText) break;
      }
    }

    // Every scenario of the requirement, not only the one on this row: a
    // requirement with two scenarios was implemented against half of them.
    const otherScenarios = this.otherScenarios(req, projectDir, featurePath);

    return AgentPrompt.build(req, {
      ...opts,
      featureContent,
      aiRulesContent,
      rulesFile,
      requirementText: requirementText || undefined,
      otherScenarios,
      // Opt-in: the caller decides, because a precedent costs prompt budget and
      // is only worth it once a project has accepted work to point at.
      precedent: opts.withPrecedents ? this.findPrecedent(req, projectDir) : null,
    });
  }

  /** The feature files of the requirement's other rows, read. */
  private otherScenarios(req: PromptRequirement, projectDir: string, own: string | null) {
    const matrix = this.configRepo.readProjectFile(projectDir, MATRIX);
    if (!matrix) return [];
    const mode = detectTraceabilityMode(matrix);
    if (!mode) return [];
    const seen = new Set<string>(own ? [own] : []);
    const out: Array<{ path: string; content: string }> = [];
    for (const cells of parseMatrixRows(matrix)) {
      const fields = readRowFields(cells, mode);
      if (fields.requirementId !== req.requirement) continue;
      // Cells are 1-based (cell 0 is before the first pipe): the feature
      // file is the third column.
      const feature = String(cells[3] || "")
        .replace(/`/g, "")
        .trim();
      if (!feature || feature === "-" || seen.has(feature)) continue;
      seen.add(feature);
      const content = this.configRepo.readProjectFile(projectDir, feature);
      if (content) out.push({ path: feature, content });
    }
    return out;
  }

  /**
   * The most recent accepted requirement in the same bounded context, with the
   * top of its test and its implementation.
   *
   * Returns null rather than throwing on anything missing. A prompt that fails
   * to build because an artifact was moved would stop a run over a section that
   * is, by design, optional.
   */
  private findPrecedent(req: PromptRequirement, projectDir: string) {
    const matrix = this.configRepo.readProjectFile(projectDir, MATRIX);
    if (!matrix) return null;

    const mode = detectTraceabilityMode(matrix);
    if (!mode) return null;

    const rows: PrecedentRow[] = parseMatrixRows(matrix).map((cells) => {
      const fields = readRowFields(cells, mode);
      return {
        requirementId: fields.requirementId,
        status: fields.status,
        testArtifact: fields.testArtifact,
        // The production artifact is the column before the test one in a rich
        // matrix, and absent from a legacy one.
        technicalArtifact: mode === "rich" ? cells[8] || "" : "",
      };
    });

    const choice = choosePrecedent(rows, parseMatrixContexts(matrix), req.requirement);
    if (!choice) return null;

    const read = (rel: string) => (rel ? this.configRepo.readProjectFile(projectDir, rel) : null);
    const testSource = read(choice.testArtifact);
    const codeSource = read(choice.technicalArtifact);
    if (!testSource && !codeSource) return null;

    return {
      requirementId: choice.requirementId,
      testArtifact: choice.testArtifact,
      testExcerpt: testSource ? excerpt(testSource) : "",
      technicalArtifact: choice.technicalArtifact,
      technicalExcerpt: codeSource ? excerpt(codeSource) : "",
    };
  }
}
