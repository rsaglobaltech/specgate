/**
 * The brief as a form, on disk (REQ-486, REQ-487): what
 * `specgate propose --from-brief --form --json` prints and the API answers.
 * The reading and the writing themselves are `BriefForm`'s, pure over the text.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import {
  readBriefForm,
  writeBriefForm,
  type BriefFormData,
  type BriefFormInput,
} from "../../packages/core/src/domain/BriefForm";
import type { Diagnostic } from "../../packages/core/src/domain/Diagnostic";
import { checkBrief, projectSurfaces } from "../draft/brief-check";

export interface BriefFormJson extends BriefFormData {
  /** The brief's path, as given: relative to the project, or absolute. */
  brief: string;
  exists: boolean;
  /** On a write: whether the file changed. */
  written?: boolean;
}

export interface BriefFormAnswer {
  form: BriefFormJson;
  status: Diagnostic[];
}

const posix = (p: string) => p.split(path.sep).join("/");

/** The brief at `brief` (relative to the project, or absolute) read as a form, with its findings. */
export function briefFormAnswer(projectDir: string, brief: string): BriefFormAnswer {
  const file = path.resolve(projectDir, brief);
  let text: string | undefined;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    text = undefined;
  }
  const rel = posix(brief);
  if (text === undefined) {
    return { form: { brief: rel, exists: false, ...readBriefForm("") }, status: [] };
  }
  return {
    form: { brief: rel, exists: true, ...readBriefForm(text) },
    status: checkBrief(text, rel, projectSurfaces(projectDir)),
  };
}

/** The form written into the brief, only what changed rewritten; then read back. */
export function saveBriefFormFile(
  projectDir: string,
  brief: string,
  input: BriefFormInput
): BriefFormAnswer {
  const file = path.resolve(projectDir, brief);
  const exists = fs.existsSync(file);
  const text = exists ? fs.readFileSync(file, "utf8") : "";
  const out = writeBriefForm(text, input);
  const written = out !== text || !exists;
  if (written) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, out, "utf8");
  }
  const answer = briefFormAnswer(projectDir, brief);
  return { ...answer, form: { ...answer.form, written } };
}

/** Why a value is not a form `writeBriefForm` can write, or null when it is. */
export function formProblem(value: unknown): string | null {
  if (!value || typeof value !== "object") return "The form is not a JSON object.";
  const v = value as Record<string, unknown>;
  const fm = v.frontMatter as Record<string, unknown> | undefined;
  if (!fm || typeof fm !== "object") return "The form has no `frontMatter`.";
  if (!Array.isArray(v.modules)) return "The form has no `modules` list.";
  for (const m of v.modules as unknown[]) {
    if (
      !m ||
      typeof m !== "object" ||
      !String(
        (m as { name?: unknown; key?: unknown }).name || (m as { key?: unknown }).key || ""
      ).trim()
    ) {
      return "Each module of the form needs a `name` or a `key`.";
    }
  }
  return null;
}
