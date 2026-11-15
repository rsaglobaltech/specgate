/**
 * The public face of the core package.
 *
 * Three circles, innermost first: the domain knows nothing but itself, the
 * application depends only on the domain and on its own ports, and the
 * infrastructure adapters implement those ports. `tests/unit/architecture.test.ts`
 * fails the build if an import ever points the other way.
 */

// ── Domain ───────────────────────────────────────────────────────────────────
export * from "./domain/ArchivePlan";
export * from "./domain/ChangeTemplates";
export * from "./domain/ChangeLayers";
export * from "./domain/DeltaSpec";
export * from "./domain/CucumberMessages";
export * from "./domain/DeclaredArtifacts";
export * from "./domain/EmptyAttempt";
export * from "./domain/Diagnostic";
export * from "./domain/DomainPack";
export * from "./domain/FileChangeSet";
export * from "./domain/Gherkin";
export * from "./domain/GherkinDialects";
export * from "./domain/GherkinQuality";
export * from "./domain/GherkinTags";
export * from "./domain/GitSafety";
export * from "./domain/HarnessConfig";
export * from "./domain/HarnessReport";
export * from "./domain/HarnessRun";
export * from "./domain/Language";
export * from "./domain/Lockfile";
export * from "./domain/PackContribution";
export * from "./domain/PackDelta";
export * from "./domain/PackSpec";
export * from "./domain/Reconciliation";
export * from "./domain/ProfileMatch";
export * from "./domain/RequirementGraph";
export * from "./domain/RunBudget";
export * from "./domain/RequirementPlan";
export * from "./domain/RequirementReadiness";
export * from "./domain/RequirementSyntax";
export * from "./domain/ResumeState";
export * from "./domain/SpecDiff";
export * from "./domain/SpecParser";
export * from "./domain/WriteScope";
export * from "./domain/SpecopsManifest";
export * from "./domain/TraceabilityFormat";
export * from "./domain/TraceabilityMerge";
export * from "./domain/TraceabilityMatrix";
export * from "./domain/ValidationReport";
export * from "./domain/ValueAnnotations";
export * from "./domain/YamlLite";

// ── Application ports ────────────────────────────────────────────────────────
export * from "./application/ports/IDomainPackRepository";
export * from "./application/ports/IHarnessConfigRepository";
export * from "./application/ports/IProjectRepository";
export * from "./application/ports/IRequirementGraphRepository";
export * from "./application/ports/ITraceabilityRepository";
// `WriteOptions` is declared by both of these ports; re-export it under a name
// that says which one it belongs to rather than letting one shadow the other.
export {
  ILockfileRepository,
  WriteOptions as LockfileWriteOptions,
} from "./application/ports/ILockfileRepository";
export {
  IManifestRepository,
  WriteOptions as ManifestWriteOptions,
} from "./application/ports/IManifestRepository";

// ── Application use cases ────────────────────────────────────────────────────
export * from "./application/AddRequirementUseCase";
export * from "./application/ArchiveChangeUseCase";
export * from "./application/CheckAgainstLockUseCase";
export * from "./application/GenerateAgentPromptUseCase";
export * from "./application/GeneratePlanUseCase";
export * from "./application/LinkRequirementUseCase";
export * from "./application/RemovePackUseCase";
export * from "./application/UpdateRequirementStatusUseCase";
export * from "./application/ValidateChangeUseCase";
export * from "./application/ValidateProjectUseCase";

// ── Infrastructure ───────────────────────────────────────────────────────────
export * from "./infrastructure/ChangeWorkspace";
export * from "./infrastructure/ConsoleReporter";
export * from "./infrastructure/DirectorySnapshot";
export * from "./infrastructure/GitContributionStager";
export * from "./infrastructure/DiskDomainPackRepository";
export * from "./infrastructure/DiskHarnessConfigRepository";
export * from "./infrastructure/DiskLanguageRepository";
export * from "./infrastructure/GitMergeDriver";
export * from "./infrastructure/PackChangeDeposit";
// `readConfig` means the change config in ChangeWorkspace and the specops
// config here. Both keep their name in their own module; the barrel says which.
export {
  CONFIG_FILE as SPECOPS_CONFIG_FILE,
  readConfig as readSpecopsConfig,
  configToPacks,
} from "./infrastructure/SpecopsConfigFile";
export * from "./infrastructure/DiskLockfileRepository";
export * from "./infrastructure/DiskManifestRepository";
export * from "./infrastructure/DiskPackDeltaRepository";
// The pure rule takes a `templateExists` predicate; the disk-wired convenience
// supplies it. Both are useful, so the barrel names which is which.
export { validatePackModel as validatePackModelOnDisk } from "./infrastructure/DiskPackRepository";
export {
  loadPack,
  ensureProjectDir,
  readTemplate,
  writeFile,
  getWrittenFiles,
  resetWrittenFiles,
  safeResolve,
} from "./infrastructure/DiskPackRepository";
export * from "./infrastructure/DiskProjectRepository";
export * from "./infrastructure/DiskRequirementGraphRepository";
export * from "./infrastructure/DiskTraceabilityRepository";
export * from "./infrastructure/HarnessConfigFile";
export * from "./infrastructure/RemotePackResolver";
