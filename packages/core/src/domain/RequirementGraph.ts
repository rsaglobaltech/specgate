/**
 * The dependency graph between requirements.
 *
 * `harness run` processed requirements in matrix order and cut every worktree
 * from the same base, which is wrong whenever one requirement builds on
 * another: REQ-002 needed REQ-001's code to exist and there was no way to say
 * so, so somebody had to know it and pass `--base-branch` by hand. That is
 * defect H12 of the closure plan, and the false failure recorded as H9 was the
 * same gap seen from the other side.
 *
 * A requirement declares what it builds on inside the `specgate:trace` comment it
 * already carries:
 *
 *   <!-- specgate:trace uc=UC-002 feature=features/auth/scopes.feature
 *        depends=REQ-001 -->
 *
 * That comment is the repository's existing way of attaching machine-readable
 * facts to a requirement, and `change archive` already reads it to write the
 * traceability row. So the model is the one this repository uses everywhere
 * else: **the requirement declares, the matrix reflects.** Nothing about the
 * ten-column format changes, which matters — `done` and `alm sync` both read
 * Status as the penultimate cell, so an extra column would have silently sent
 * status writes to the wrong place.
 *
 * A missing declaration means no dependencies, so every project that never
 * writes one behaves exactly as it does today.
 */

/** `{ REQ-id: [REQ-id, …] }`. Sparse: no entry and no dependencies are the same thing. */
export type DependencyMap = Readonly<Record<string, readonly string[]>>;

/** A dependency naming a requirement this project does not have. */
export interface UnknownDependency {
  readonly requirement: string;
  readonly dependency: string;
}

/** `"REQ-001, REQ-003"` → `["REQ-001", "REQ-003"]`, de-duplicated and upper-cased. */
export function splitDependencies(raw: string): string[] {
  const seen = new Set<string>();
  for (const token of String(raw).split(/[,;\s]+/)) {
    const id = token.trim().toUpperCase();
    if (id) seen.add(id);
  }
  return [...seen];
}

/**
 * The graph over a known set of requirements, and every question the CLI asks
 * of it.
 *
 * Built once and then queried: ordering, levels and cycles are all derived
 * from the same two adjacency maps, so they cannot disagree with each other.
 */
export class RequirementGraph {
  readonly dependsOn: Readonly<Record<string, string[]>>;
  readonly dependents: Readonly<Record<string, string[]>>;
  readonly unknown: readonly UnknownDependency[];
  readonly selfReferential: readonly string[];

  private readonly ids: readonly string[];

  private constructor(requirementIds: readonly string[], declared: DependencyMap) {
    this.ids = requirementIds.map((id) => String(id).toUpperCase());
    const known = new Set(this.ids);

    const dependsOn: Record<string, string[]> = {};
    const dependents: Record<string, string[]> = {};
    for (const id of known) {
      dependsOn[id] = [];
      dependents[id] = [];
    }

    const unknown: UnknownDependency[] = [];
    const selfReferential: string[] = [];

    for (const [requirement, deps] of Object.entries(declared)) {
      if (!known.has(requirement)) continue; // declared for a REQ not in this project
      for (const dependency of deps) {
        if (dependency === requirement) {
          selfReferential.push(requirement);
        } else if (!known.has(dependency)) {
          unknown.push({ requirement, dependency });
        } else {
          dependsOn[requirement].push(dependency);
          dependents[dependency].push(requirement);
        }
      }
    }

    this.dependsOn = dependsOn;
    this.dependents = dependents;
    this.unknown = unknown;
    this.selfReferential = selfReferential;
  }

  /** Build from an adjacency map the caller already has — the harness has one. */
  static fromDependencies(
    requirementIds: readonly string[],
    declared: DependencyMap
  ): RequirementGraph {
    return new RequirementGraph(requirementIds, declared);
  }

  /**
   * Requirements in an order where every dependency comes before what needs
   * it, and the sets that could run at the same time.
   *
   * Kahn's algorithm with the queue kept in the caller's original order, so
   * the result is stable: two requirements that do not constrain each other
   * stay in matrix order, and a project with no declarations gets its input
   * back untouched.
   */
  get schedule(): { order: string[]; levels: string[][] } {
    const remaining = new Map<string, Set<string>>(
      this.ids.map((id) => [id, new Set(this.dependsOn[id] ?? [])])
    );

    const order: string[] = [];
    const levels: string[][] = [];

    while (remaining.size > 0) {
      const ready = this.ids.filter((id) => remaining.get(id)?.size === 0);
      if (ready.length === 0) break; // everything left is in, or behind, a cycle

      levels.push(ready);
      for (const id of ready) {
        order.push(id);
        remaining.delete(id);
      }
      for (const deps of remaining.values()) {
        for (const id of ready) deps.delete(id);
      }
    }

    return { order, levels };
  }

  get order(): string[] {
    return this.schedule.order;
  }

  get levels(): string[][] {
    return this.schedule.levels;
  }

  /**
   * The cycles among the requirements that could not be ordered.
   *
   * Reporting "there is a cycle" is not actionable; reporting
   * `REQ-002 → REQ-003 → REQ-002` is.
   */
  get cycles(): string[][] {
    const ordered = new Set(this.order);
    const stuck = this.ids.filter((id) => !ordered.has(id));
    return this.findCycles(stuck);
  }

  /**
   * Everything that transitively waits on `requirement`, so a cascade is
   * reported once as blocked rather than N times as failed.
   */
  transitiveDependents(requirement: string): Set<string> {
    const blocked = new Set<string>();
    let grew = true;
    while (grew) {
      grew = false;
      for (const [id, deps] of Object.entries(this.dependsOn)) {
        if (blocked.has(id)) continue;
        if (deps.some((d) => d === requirement || blocked.has(d))) {
          blocked.add(id);
          grew = true;
        }
      }
    }
    return blocked;
  }

  /** Depth-first, returning each cycle once, as the path that closes it. */
  private findCycles(stuck: readonly string[]): string[][] {
    const inStuck = new Set(stuck);
    const cycles: string[][] = [];
    const seenSignature = new Set<string>();
    const done = new Set<string>();
    const path: string[] = [];

    const visit = (id: string): void => {
      if (done.has(id)) return;

      const at = path.indexOf(id);
      if (at !== -1) {
        this.recordCycle(path.slice(at), cycles, seenSignature);
        return;
      }

      path.push(id);
      for (const dep of this.dependsOn[id] ?? []) {
        if (inStuck.has(dep)) visit(dep);
      }
      path.pop();
      done.add(id);
    };

    for (const id of stuck) visit(id);
    return cycles;
  }

  /** Rotate to the smallest id so one loop found from two entry points is one cycle. */
  private recordCycle(cycle: string[], cycles: string[][], seen: Set<string>): void {
    const smallest = [...cycle].sort()[0];
    const pivot = cycle.indexOf(smallest);
    const normalised = [...cycle.slice(pivot), ...cycle.slice(0, pivot)];
    const signature = normalised.join(">");
    if (seen.has(signature)) return;
    seen.add(signature);
    cycles.push(normalised);
  }
}
