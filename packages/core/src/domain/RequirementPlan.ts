export type PlanCategory =
  | "NEEDS_EVERYTHING"
  | "NEEDS_FEATURE"
  | "NEEDS_TEST"
  | "NEEDS_IMPLEMENTATION"
  | "NEEDS_STATUS_UPDATE"
  | "DONE";

export interface PlanItem {
  requirement: string;
  scenario_id: string;
  feature_file: string;
  technical_artifact: string;
  test_artifact: string;
  status: string;
  feature_exists: boolean;
  technical_exists: boolean;
  test_exists: boolean;
  category: PlanCategory;
  /** The row's Use Case cell — what `status` shows as the requirement's name. */
  title?: string;
  depends_on?: string[];
  blocked_by?: string[];
  [key: string]: any;
}

export interface PlanSummary {
  total: number;
  done: number;
  needs_feature: number;
  needs_test: number;
  needs_implementation: number;
  needs_status_update: number;
  needs_everything: number;
  blocked: number;
}

export interface RawMatrixRow {
  mode?: string;
  requirement?: string;
  scenarioId?: string;
  featureFile?: string;
  useCase?: string;
  command?: string;
  aggregate?: string;
  event?: string;
  technicalArtifact?: string;
  testArtifact?: string;
  status?: string;
}

export class RequirementPlan {
  public static readonly DONE_STATUSES = new Set(["Implemented", "Verified", "Released"]);
  public static readonly PLACEHOLDER_RE = /^(TBD|TODO|\?+|-)?$|\{\{/;

  public static isMeaningful(value: any): boolean {
    if (typeof value !== "string") return false;
    const stripped = value.replace(/^`|`$/g, "").trim();
    if (!stripped) return false;
    return !RequirementPlan.PLACEHOLDER_RE.test(stripped);
  }

  public static classifyRow(
    row: RawMatrixRow,
    fileChecker: (relPath: string) => boolean
  ): PlanItem | null {
    const reqId = row.requirement || "";
    if (!/^REQ-\d+/.test(reqId)) return null;

    const featureExists = fileChecker(row.featureFile || "");
    const techDeclared = RequirementPlan.isMeaningful(row.technicalArtifact);
    const testDeclared = RequirementPlan.isMeaningful(row.testArtifact);
    const techExists = techDeclared && fileChecker(row.technicalArtifact || "");
    const testExists = testDeclared && fileChecker(row.testArtifact || "");
    const isDone = RequirementPlan.DONE_STATUSES.has(row.status || "");

    let category: PlanCategory;
    if (!featureExists) category = "NEEDS_FEATURE";
    else if (!techDeclared && !testDeclared) category = "NEEDS_EVERYTHING";
    else if (testDeclared && !testExists && techDeclared && !techExists)
      category = "NEEDS_EVERYTHING";
    else if (testDeclared && !testExists) category = "NEEDS_TEST";
    else if (techDeclared && !techExists) category = "NEEDS_IMPLEMENTATION";
    else if (!isDone) category = "NEEDS_STATUS_UPDATE";
    else category = "DONE";

    return {
      requirement: reqId,
      scenario_id: row.scenarioId || "",
      feature_file: row.featureFile || "",
      technical_artifact: row.technicalArtifact || "",
      test_artifact: row.testArtifact || "",
      status: row.status || "",
      feature_exists: featureExists,
      technical_exists: techExists,
      test_exists: testExists,
      category,
      title: row.useCase || "",
    };
  }

  public static buildSummary(items: PlanItem[]): PlanSummary {
    const summary: PlanSummary = {
      total: items.length,
      done: 0,
      needs_feature: 0,
      needs_test: 0,
      needs_implementation: 0,
      needs_status_update: 0,
      needs_everything: 0,
      blocked: 0,
    };

    for (const item of items) {
      if (item.category === "DONE") summary.done++;
      else if (item.category === "NEEDS_FEATURE") summary.needs_feature++;
      else if (item.category === "NEEDS_TEST") summary.needs_test++;
      else if (item.category === "NEEDS_IMPLEMENTATION") summary.needs_implementation++;
      else if (item.category === "NEEDS_STATUS_UPDATE") summary.needs_status_update++;
      else if (item.category === "NEEDS_EVERYTHING") summary.needs_everything++;

      if (item.blocked_by && item.blocked_by.length > 0) {
        summary.blocked++;
      }
    }

    return summary;
  }
}
