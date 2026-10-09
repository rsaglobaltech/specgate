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

  /** `src/a.ts`, `a.test.js, b.test.js` — not `npm test` or `existing codebase`. */
  public static looksLikePath(value: string): boolean {
    const parts = value
      .replace(/`/g, "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.length > 0 && parts.every((p) => !/\s/.test(p) && /[/.]/.test(p));
  }

  /**
   * `scenarioGap` says whether a scenario of the row's feature has no test
   * naming it while its siblings do — what `validate --strict` reports as
   * "Nothing proves". Without it, a requirement that gained two scenarios was
   * "Ready to close — its test is in place" in `status` and NEEDS_STATUS_UPDATE
   * to the harness, while `validate` refused it (reservas_app, #54).
   */
  public static classifyRow(
    row: RawMatrixRow,
    fileChecker: (relPath: string) => boolean,
    scenarioGap?: (row: RawMatrixRow) => boolean
  ): PlanItem | null {
    const reqId = row.requirement || "";
    if (!/^REQ-\d+/.test(reqId)) return null;

    const featureExists = fileChecker(row.featureFile || "");
    const techDeclared = RequirementPlan.isMeaningful(row.technicalArtifact);
    const testDeclared = RequirementPlan.isMeaningful(row.testArtifact);
    const isDone = RequirementPlan.DONE_STATUSES.has(row.status || "");
    // `adopt` records its baseline as `test='npm test'` and `artifact='existing
    // codebase'` — a command and a description, not files. Once the
    // requirement is delivered (`done` ran the gate), such a value is not
    // missing evidence; without this the baseline was planned, and handed to
    // the harness, as work forever (golden_app finding #29).
    const present = (value: string) =>
      fileChecker(value) || (isDone && !RequirementPlan.looksLikePath(value));
    const techExists = techDeclared && present(row.technicalArtifact || "");
    const testExists = testDeclared && present(row.testArtifact || "");

    let category: PlanCategory;
    if (!featureExists) category = "NEEDS_FEATURE";
    else if (!techDeclared && !testDeclared) category = "NEEDS_EVERYTHING";
    else if (testDeclared && !testExists && techDeclared && !techExists)
      category = "NEEDS_EVERYTHING";
    else if (testDeclared && !testExists) category = "NEEDS_TEST";
    // A scenario with no test is not done, whatever the requirement's status:
    // it is how a scenario added after delivery shows up (golden_app #32).
    else if (!testDeclared) category = "NEEDS_TEST";
    else if (scenarioGap && scenarioGap(row)) category = "NEEDS_TEST";
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
