/**
 * @rsaglobaltech/specgate/api (change specgate-api, REQ-466 … REQ-469).
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
