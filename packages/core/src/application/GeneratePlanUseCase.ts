import { ITraceabilityRepository } from "./ports/ITraceabilityRepository";
import { RequirementPlan, PlanItem, PlanSummary, RawMatrixRow } from "../domain/RequirementPlan";
import { RequirementGraph } from "../domain/RequirementGraph";
import { IRequirementGraphRepository } from "./ports/IRequirementGraphRepository";

export interface GeneratePlanResult {
  items: PlanItem[];
  summary: PlanSummary;
  rawMatrix: string | null;
}

export class GeneratePlanUseCase {
  constructor(
    private traceRepo: ITraceabilityRepository,
    private fileExistsFn: (projectDir: string, relPath: string) => boolean,
    private graphRepo: IRequirementGraphRepository,
    /** A scenario of the row with no test naming it (#54); see `classifyRow`. */
    private scenarioGapFn?: (projectDir: string, row: any) => boolean
  ) {}

  public execute(projectDir: string): GeneratePlanResult {
    const rawContent = this.traceRepo.readTraceability(projectDir);
    if (!rawContent) {
      return {
        items: [],
        summary: {
          total: 0,
          done: 0,
          needs_feature: 0,
          needs_test: 0,
          needs_implementation: 0,
          needs_status_update: 0,
          needs_everything: 0,
          blocked: 0,
        },
        rawMatrix: null,
      };
    }

    const rows = this.parseTraceabilityRows(rawContent);
    const unconstrainedItems: PlanItem[] = [];

    for (const row of rows) {
      const item = RequirementPlan.classifyRow(
        row,
        (rel) => this.fileExistsFn(projectDir, rel),
        this.scenarioGapFn ? (r) => this.scenarioGapFn!(projectDir, r) : undefined
      );
      if (item) {
        unconstrainedItems.push(item);
      }
    }

    const items = this.applyDependencies(unconstrainedItems, projectDir);
    const summary = RequirementPlan.buildSummary(items);

    return {
      items,
      summary,
      rawMatrix: rawContent,
    };
  }

  private parseTraceabilityRows(content: string): RawMatrixRow[] {
    const rows: RawMatrixRow[] = [];
    let mode: "rich" | "legacy" | null = null;
    const trimCell = (v: string) => (v || "").trim();

    for (const raw of content.split("\n")) {
      const line = raw.trimEnd();
      if (!line.startsWith("|")) continue;
      if (line.includes("---")) continue;
      if (line.includes("| Requirement | Scenario ID |")) {
        mode = "rich";
        continue;
      }
      if (line.includes("| Feature | Scenario |")) {
        mode = "legacy";
        continue;
      }
      if (!mode) continue;

      const cells = line.split("|").map(trimCell);
      if (mode === "rich" && cells.length >= 12) {
        rows.push({
          mode,
          requirement: cells[1],
          scenarioId: cells[2],
          featureFile: cells[3],
          useCase: cells[4],
          command: cells[5],
          aggregate: cells[6],
          event: cells[7],
          technicalArtifact: cells[8],
          testArtifact: cells[9],
          status: cells[10],
        });
      } else if (mode === "legacy" && cells.length >= 6) {
        rows.push({
          mode,
          requirement: this.extractReqFromCells(cells),
          scenarioId: cells[2],
          featureFile: cells[1],
          technicalArtifact: cells[3],
          testArtifact: "",
          status: cells[4],
        });
      }
    }
    return rows;
  }

  private extractReqFromCells(cells: string[]): string {
    for (const cell of cells) {
      const m = (cell || "").match(/REQ-\d+/);
      if (m) return m[0];
    }
    return "";
  }

  private applyDependencies(items: PlanItem[], projectDir: string): PlanItem[] {
    const ids = items.map((it) => it.requirement);
    const declared = this.graphRepo.readDeclaredDependencies(projectDir);
    const graph = RequirementGraph.fromDependencies(ids, declared);

    // A requirement with several scenarios has several items: it is done when
    // all of them are, and the order keeps every one of them, once.
    const isDone = (id: string) => {
      const its = items.filter((it) => it.requirement === id);
      return its.length > 0 && its.every((it) => it.category === "DONE");
    };

    for (const item of items) {
      const deps = graph.dependsOn[item.requirement] || [];
      item.depends_on = deps;
      item.blocked_by = deps.filter((dep: string) => !isDone(dep));
    }

    const ordered: PlanItem[] = [];
    const placed = new Set<string>();
    for (const id of graph.order) {
      if (placed.has(id)) continue;
      placed.add(id);
      for (const item of items) if (item.requirement === id) ordered.push(item);
    }
    for (const item of items) {
      if (!ordered.includes(item)) ordered.push(item);
    }
    return ordered;
  }
}
