import { ILockfileRepository } from "./ports/ILockfileRepository";
import { IDomainPackRepository } from "./ports/IDomainPackRepository";
import { DomainPack } from "../domain/DomainPack";

export interface TraceabilityRow {
  requirement: string;
  scenarioId?: string;
  featureFile?: string;
  [key: string]: any;
}

export interface CheckAgainstLockOptions {
  pack?: string;
  cacheDir?: string;
}

export interface DiagnosticResult {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  target?: string;
  fix?: string;
}

export class CheckAgainstLockUseCase {
  constructor(
    private lockRepo: ILockfileRepository,
    private packRepo: IDomainPackRepository
  ) {}

  public execute(
    matrixRows: TraceabilityRow[] | null,
    isLegacyMatrix: boolean,
    opts: CheckAgainstLockOptions = {}
  ): { checked: number; diagnostics: DiagnosticResult[] } {
    const diagnostics: DiagnosticResult[] = [];
    const lock = this.lockRepo.readLock();

    if (!lock || !Array.isArray(lock.packs) || lock.packs.length === 0) {
      return { checked: 0, diagnostics };
    }

    if (isLegacyMatrix || matrixRows === null) {
      diagnostics.push({
        severity: "warning",
        code: "traceability_legacy_format",
        message:
          "traceability.md uses the legacy 4-column format; requirement-level drift cannot be checked.",
        fix: "Migrate the matrix to the 10-column format.",
      });
      return { checked: 0, diagnostics };
    }

    let checked = 0;
    for (const entry of lock.packs) {
      if (opts.pack && entry.pack_id !== opts.pack) continue;
      if (!entry.repo) continue;

      let resolved: { packRoot: string; commit: string };
      try {
        resolved = this.packRepo.resolveRemotePack({
          repo: entry.repo,
          version: entry.version,
          cacheDir: opts.cacheDir,
        });
      } catch (err: any) {
        diagnostics.push({
          severity: "error",
          code: "pack_unavailable",
          message: `Could not resolve ${entry.pack_id}@${entry.version}: ${err.message}`,
          target: entry.pack_id,
          // A private pack repository fails the same way as a network outage,
          // and "check network access" sent a team after the wrong problem.
          fix: /could not read Username|Authentication failed|terminal prompts disabled|Repository not found|returned error: 40[13]/i.test(
            String(err.message)
          )
            ? "The pack repository needs credentials. In CI, add a SPECOPS_TOKEN secret with read access to it — the job `specgate ci init` writes uses it — or make the repository public."
            : "Check network access and that the pinned tag still exists upstream.",
        });
        continue;
      }

      let pack: DomainPack;
      try {
        pack = this.packRepo.loadPackModel(resolved.packRoot, entry.pack_id);
      } catch (err: any) {
        diagnostics.push({
          severity: "error",
          code: "pack_unreadable",
          message: `Could not read the model of ${entry.pack_id}: ${err.message}`,
          target: entry.pack_id,
          fix: "The locked tag may not contain this pack id any more.",
        });
        continue;
      }

      checked += 1;
      diagnostics.push(...this.checkPackAgainstMatrix(pack, entry, matrixRows));
    }

    return { checked, diagnostics };
  }

  private checkPackAgainstMatrix(
    pack: DomainPack,
    entry: any,
    matrixRows: TraceabilityRow[]
  ): DiagnosticResult[] {
    const diagnostics: DiagnosticResult[] = [];
    const requirements = pack.getRequirementsById();
    const scenarios = pack.getScenariosByRequirement();

    const bare = (val: any) =>
      String(val === undefined || val === null ? "" : val)
        .trim()
        .replace(/^`|`$/g, "");

    const EMPTY = new Set(["", "-", "TBD"]);
    const isEmpty = (v: any) => EMPTY.has(bare(v));

    const rowFor = (id: string) =>
      matrixRows.find((r) => bare(r.requirement).toUpperCase() === String(id).toUpperCase());

    for (const [id, req] of requirements) {
      const row = rowFor(id);
      const label = `${id} — ${req.title || id}`;

      if (!row) {
        diagnostics.push({
          severity: "error",
          code: "pack_requirement_missing",
          message: `${label} is declared by the pack but absent from the project.`,
          target: id,
          fix: `Run \`specgate specops sync --pack ${entry.pack_id}\` to bring it in.`,
        });
        continue;
      }

      const packScenarios = scenarios.get(id) || [];
      const expectedScenario = packScenarios[0] && packScenarios[0].id;
      const expectedFeature = packScenarios[0] && packScenarios[0].target;

      if (
        expectedScenario &&
        !isEmpty(row.scenarioId) &&
        bare(row.scenarioId) !== expectedScenario
      ) {
        diagnostics.push({
          severity: "error",
          code: "pack_requirement_drifted",
          message: `${label} points at scenario ${bare(row.scenarioId)}, but the pack declares ${expectedScenario}.`,
          target: id,
          fix: `Reconcile with \`specgate specops diff --pack ${entry.pack_id} --as-change\`, or accept the local decision by recording it in a change.`,
        });
      }

      if (
        expectedFeature &&
        !isEmpty(row.featureFile) &&
        bare(row.featureFile) !== expectedFeature
      ) {
        diagnostics.push({
          severity: "error",
          code: "pack_requirement_drifted",
          message: `${label} points at feature ${bare(row.featureFile)}, but the pack declares ${expectedFeature}.`,
          target: id,
          fix: `Reconcile with \`specgate specops diff --pack ${entry.pack_id} --as-change\`, or accept the local decision by recording it in a change.`,
        });
      }
    }

    const local = matrixRows.filter((r) => {
      const id = bare(r.requirement).toUpperCase();
      return id && !requirements.has(id) && /^REQ-/.test(id);
    });

    if (local.length > 0) {
      diagnostics.push({
        severity: "info",
        code: "local_requirements",
        message: `${local.length} requirement(s) are local to this project.`,
        target: local.map((r) => bare(r.requirement)).join(", "),
      });
    }

    return diagnostics;
  }
}
