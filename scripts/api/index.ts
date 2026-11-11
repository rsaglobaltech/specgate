/**
 * @rsaglobaltech/specgate/api (change specgate-api, REQ-466 … REQ-469; change
 * studio-json-gaps, REQ-484, REQ-486, REQ-487).
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
import { stopAfterCurrent } from "../lib/harness-guard";
import { changeShowAnswer } from "../cli/commands/change/ChangeCommand";
import { DEFAULT_BRIEF } from "../cli/commands/spec/DraftCommand";
import { briefFormAnswer, formProblem, saveBriefFormFile } from "../lib/brief-form";
import type { BriefFormInput } from "../../packages/core/src/domain/BriefForm";

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

/**
 * `specgate harness stop --after-current --json` (REQ-492). Unlike the reads
 * above, it writes one file when a run is working: the stop request beside
 * the events, which the run reads between requirements.
 */
export const harnessStop: typeof Api.harnessStop = async (dir, options) => {
  const resolved = project(dir);
  if (!options || options.afterCurrent !== true) {
    throw Object.assign(new Error("harnessStop needs { afterCurrent: true }."), {
      code: "usage",
      fix: "harnessStop(dir, { afterCurrent: true })",
    });
  }
  return asPrinted<Api.HarnessStopAnswer>(stopAfterCurrent(resolved));
};

/** `specgate change show <id> --json` (REQ-484); rejects with `change_not_found` for no such change. */
export const change: typeof Api.change = async (dir, id) => {
  const answer = changeShowAnswer(project(dir), id);
  if (!answer) {
    throw Object.assign(new Error(`Change "${id}" does not exist.`), {
      code: "change_not_found",
      fix: "specgate change list",
    }) as Api.SpecgateApiError;
  }
  return asPrinted<Api.ChangeAnswer>(answer);
};

/** `specgate propose --from-brief --form --json` (REQ-486): docs/brief.md as a form; reads only. */
export const briefForm: typeof Api.briefForm = async (dir) =>
  asPrinted<Api.BriefFormAnswer>(briefFormAnswer(project(dir), DEFAULT_BRIEF));

/**
 * `specgate propose --from-brief --form <file> --json` (REQ-487): the one call
 * that writes — docs/brief.md, and only the fields and module sections whose
 * values changed. Rejects with `brief_form_invalid` for what is not a form.
 */
export const writeBriefForm: typeof Api.writeBriefForm = async (dir, form) => {
  const resolved = project(dir);
  const problem = formProblem(form);
  if (problem) {
    throw Object.assign(new Error(problem), {
      code: "brief_form_invalid",
      fix: "Pass what briefForm(dir) answered under `form`, with its values changed.",
    }) as Api.SpecgateApiError;
  }
  return asPrinted<Api.BriefFormAnswer>(
    saveBriefFormFile(resolved, DEFAULT_BRIEF, form as unknown as BriefFormInput)
  );
};
