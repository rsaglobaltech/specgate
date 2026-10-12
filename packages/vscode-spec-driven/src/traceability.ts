// Matches REQ-001, UC-001, SCN-001, BC-001, AGG-001, EVT-001, RUL-001, CMD-001
const ID_PATTERN = /\b(REQ|UC|SCN|BC|AGG|EVT|RUL|CMD)-\d{3,}\b/g;

export interface RequirementMatch {
  id: string;
  line: number;
  col: number;
  endCol: number;
}

export interface Diagnostic {
  message: string;
  severity: "error" | "warning" | "info";
}

export class TraceabilityManager {
  public findRequirementIds(text: string): RequirementMatch[] {
    const results: RequirementMatch[] = [];
    const lines = text.split("\n");
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      ID_PATTERN.lastIndex = 0;
      let match;
      while ((match = ID_PATTERN.exec(line)) !== null) {
        results.push({
          id: match[0],
          line: lineIdx,
          col: match.index,
          endCol: match.index + match[0].length,
        });
      }
    }
    return results;
  }

  public findIdInTraceability(traceContent: string, id: string): number {
    const lines = traceContent.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(id)) return i;
    }
    return -1;
  }

  public parseValidateOutput(stdout: string, stderr: string): Diagnostic[] {
    const combined = [stdout || "", stderr || ""].join("\n");
    const diagnostics: Diagnostic[] = [];

    for (const raw of combined.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      // The CLI's markers since 0.19 (`✖`, `▲`, `✔` at the start of the
      // line), and before it (`❌ [ERROR]`, `⚠️ [WARN]`, `ℹ️ [INFO] ✅`).
      if (line.includes("[ERROR]") || line.includes("❌") || line.startsWith("✖")) {
        diagnostics.push({
          message: line.replace(/^.*?(?:\[ERROR\]|❌|✖)\s*/, "").trim(),
          severity: "error",
        });
      } else if (line.includes("[WARN]") || line.includes("⚠️") || line.startsWith("▲")) {
        diagnostics.push({
          message: line.replace(/^.*?(?:\[WARN\]|⚠️|▲)\s*/, "").trim(),
          severity: "warning",
        });
      } else if ((line.includes("[INFO]") && line.includes("✅")) || line.startsWith("✔")) {
        diagnostics.push({
          message: line.replace(/^.*?(?:\[INFO\]\s*✅|ℹ️|✔)\s*/, "").trim(),
          severity: "info",
        });
      }
    }

    return diagnostics;
  }
}

// Legacy exports
const defaultManager = new TraceabilityManager();
export const findRequirementIds = (text: string) => defaultManager.findRequirementIds(text);
export const findIdInTraceability = (content: string, id: string) =>
  defaultManager.findIdInTraceability(content, id);
export const parseValidateOutput = (stdout: string, stderr: string) =>
  defaultManager.parseValidateOutput(stdout, stderr);
