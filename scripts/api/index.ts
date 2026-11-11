/**
 * @rsaglobaltech/specgate/api (change specgate-api, REQ-466 … REQ-469; report
 * and lastCheck: change studio-phase3-json, REQ-499, REQ-501, REQ-504).
 *
 * Each function answers with the very document the command builds for
 * `--json`, so the two cannot drift; its signature is typed against
 * `types/api.d.ts`, the published contract, and a test compares every answer
 * with what the command prints.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import type * as Api from "../../types/api";
import { resolveProjectDir } from "../lib/project-root";
import { statusAnswer } from "../cli/commands/spec/StatusCommand";
import { questionsAnswer } from "../cli/commands/spec/ClarifyCommands";
import { matrixAnswer } from "../cli/commands/spec/MatrixCommand";
import { buildReport, renderJson } from "../cli/commands/quality/ReportCommand";
import { lastCheckAnswer } from "../lib/last-check";
import { capabilityNames, requirementCapabilities, unknownCapability } from "../lib/capabilities";

export const API_VERSION: typeof Api.API_VERSION = "1.0.0";

/** The project in `dir`, or a refusal with its code and fix (REQ-469). */
function project(dir: string): string {
  const resolved = resolveProjectDir(path.resolve(dir));
  if (!fs.existsSync(path.join(resolved, "docs", "specs", "traceability.md"))) {
    throw Object.assign(new Error(`${resolved} is not a specgate project.`), {
      code: "not_a_project",
      fix: "specgate init",
    }) as Api.SpecgateApiError;
  }
  return resolved;
}

/** As `JSON.parse` of what the command prints: no undefined, no shared objects. */
const asPrinted = <T>(document: unknown): T => JSON.parse(JSON.stringify(document)) as T;

export const status: typeof Api.status = async (dir) =>
  asPrinted<Api.StatusAnswer>(statusAnswer(project(dir)));

export const questions: typeof Api.questions = async (dir) =>
  asPrinted<Api.QuestionsAnswer>(questionsAnswer(project(dir)));

export const matrix: typeof Api.matrix = async (dir) =>
  asPrinted<Api.MatrixAnswer>(matrixAnswer(project(dir)));

/** `specgate report --format json --stdout [--capability <name>]` (REQ-499, REQ-501). */
export const report: typeof Api.report = async (dir, options = {}) => {
  const resolved = project(dir);
  const capability = options.capability || null;
  if (capability) {
    const known = capabilityNames(requirementCapabilities(resolved));
    if (!known.includes(capability)) {
      const d = unknownCapability(capability, known, "specgate report");
      throw Object.assign(new Error(d.message), {
        code: "capability_unknown",
        fix: d.fix,
      }) as Api.SpecgateApiError;
    }
  }
  return JSON.parse(renderJson(buildReport(resolved, capability))) as Api.ReportAnswer;
};

/** `specgate check --last --json` (REQ-504). */
export const lastCheck: typeof Api.lastCheck = async (dir) =>
  asPrinted<Api.LastCheckAnswer>(lastCheckAnswer(project(dir)));
