export interface ValidationFinding {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  file?: string;
  line?: number;
  target?: string;
  fix?: string;
  /** The fix as separate lines, for surfaces that render one per line. */
  fixLines?: readonly string[];
  /** The requirement the finding is about, when there is one (REQ-531's baseline matches on it). */
  requirement?: string;
}

export interface FindingOptions {
  file?: string;
  line?: number;
  target?: string;
  fix?: string;
  fixLines?: readonly string[];
  requirement?: string;
}

export class ValidationReport {
  public findings: ValidationFinding[] = [];

  public get valid(): boolean {
    return !this.findings.some((f) => f.severity === "error");
  }

  public get errors(): ValidationFinding[] {
    return this.findings.filter((f) => f.severity === "error");
  }

  public get warnings(): ValidationFinding[] {
    return this.findings.filter((f) => f.severity === "warning");
  }

  public addError(code: string, message: string, opts: FindingOptions = {}): void {
    this.findings.push({
      severity: "error",
      code,
      message,
      file: opts.file,
      line: opts.line,
      target: opts.target,
      fix: opts.fix,
      fixLines: opts.fixLines,
      ...(opts.requirement ? { requirement: opts.requirement } : {}),
    });
  }

  public addWarning(code: string, message: string, opts: FindingOptions = {}): void {
    this.findings.push({
      severity: "warning",
      code,
      message,
      file: opts.file,
      line: opts.line,
      target: opts.target,
      fix: opts.fix,
      fixLines: opts.fixLines,
      ...(opts.requirement ? { requirement: opts.requirement } : {}),
    });
  }

  public addInfo(code: string, message: string, opts: FindingOptions = {}): void {
    this.findings.push({
      severity: "info",
      code,
      message,
      file: opts.file,
      line: opts.line,
      target: opts.target,
      fix: opts.fix,
      fixLines: opts.fixLines,
      ...(opts.requirement ? { requirement: opts.requirement } : {}),
    });
  }
}
