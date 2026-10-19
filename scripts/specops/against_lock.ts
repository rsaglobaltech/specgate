/**
 * `validate --against-lock` — the drift gate.
 *
 * Checks the project's traceability matrix against locked domain packs.
 */

import * as fs from "node:fs";
import { parseTraceabilityRows } from "../../packages/core/src/domain/TraceabilityFormat";
import { paths } from "../../packages/core/src/infrastructure/ChangeWorkspace";
import { error, warning, info } from "../lib/diagnostics";
import type { Diagnostic } from "../lib/diagnostics";
import { DiskLockfileRepository } from "../../packages/core/src/infrastructure/DiskLockfileRepository";
import { DiskDomainPackRepository } from "../../packages/core/src/infrastructure/DiskDomainPackRepository";
import { CheckAgainstLockUseCase } from "../../packages/core/src/application/CheckAgainstLockUseCase";
import type {
  CheckAgainstLockOptions,
  DiagnosticResult,
  TraceabilityRow,
} from "../../packages/core/src/application/CheckAgainstLockUseCase";
import type { ILockfileRepository } from "../../packages/core/src/application/ports/ILockfileRepository";
import type { IDomainPackRepository } from "../../packages/core/src/application/ports/IDomainPackRepository";
import type { PackEntry } from "../../packages/core/src/domain/Lockfile";
import type { PackRawModel } from "../../packages/core/src/domain/DomainPack";

/** The use case's plain findings, as the diagnostics the CLI prints. */
function toDiagnostic(d: DiagnosticResult): Diagnostic {
  if (d.severity === "error") {
    return error(d.code, d.message, { target: d.target, fix: d.fix });
  }
  if (d.severity === "warning") {
    return warning(d.code, d.message, { target: d.target, fix: d.fix });
  }
  return info(d.code, d.message, { target: d.target, fix: d.fix });
}

/**
 * Run the gate for every pack in the lockfile using the Clean Architecture Use Case.
 */
export function checkAgainstLock(
  projectDir: string,
  opts?: CheckAgainstLockOptions
): { checked: number; diagnostics: Diagnostic[] } {
  const traceabilityFile = paths(projectDir).traceability;
  const matrix = fs.existsSync(traceabilityFile)
    ? parseTraceabilityRows(fs.readFileSync(traceabilityFile, "utf8"))
    : { mode: "rich", rows: [] };

  const isLegacy = matrix.mode !== "rich";
  // A rich matrix's rows are the ten-column shape the use case reads by name;
  // the parser's union also covers the legacy shape, which never reaches here.
  const rows = isLegacy ? null : (matrix.rows as TraceabilityRow[]);

  const lockRepo = new DiskLockfileRepository(projectDir);
  const packRepo = new DiskDomainPackRepository();
  const useCase = new CheckAgainstLockUseCase(lockRepo, packRepo);

  const result = useCase.execute(rows, isLegacy, opts);

  // Convert to full diagnostics
  const diagnostics = result.diagnostics.map(toDiagnostic);

  return { checked: result.checked, diagnostics };
}

import { DomainPack } from "../../packages/core/src/domain/DomainPack";

/** The use case's per-pack check, which it keeps private. */
interface PackMatrixCheck {
  checkPackAgainstMatrix(
    pack: DomainPack,
    entry: Partial<PackEntry>,
    matrixRows: TraceabilityRow[]
  ): DiagnosticResult[];
}

/**
 * Check one pack model against matrix rows already in hand — no lockfile, no
 * fetch. Neither repository is consulted on this path, so each is a stub of
 * the one method a constructor could reach.
 */
export function checkPackAgainstProject(
  pack: PackRawModel,
  entry: Partial<PackEntry>,
  matrixRows: TraceabilityRow[]
): Diagnostic[] {
  const domainPack = new DomainPack(entry.pack_id || "", pack, entry.version || "");
  const lockRepo: Pick<ILockfileRepository, "readLock"> = { readLock: () => null };
  const packRepo: Pick<IDomainPackRepository, "resolveRemotePack"> = {
    resolveRemotePack: () => ({ packRoot: "", commit: "" }),
  };
  const useCase = new CheckAgainstLockUseCase(
    lockRepo as ILockfileRepository,
    packRepo as IDomainPackRepository
  );
  // The method is private to the use case; this seam is how the tests reach it.
  const rawDiags = (useCase as unknown as PackMatrixCheck).checkPackAgainstMatrix(
    domainPack,
    entry,
    matrixRows
  );
  return rawDiags.map(toDiagnostic);
}
