/**
 * The brief rules, B1 to B13, as diagnostics (ADR-0038).
 *
 * B1 is the front matter's shapes and fields (`brief-setup.ts`); B2 to B13
 * read the body's module cards (`BriefCards`). `propose --from-brief --check`
 * prints them, the overview stops on their errors, and a draft is not opened
 * over one.
 */

import type { Diagnostic } from "../../packages/core/src/domain/Diagnostic";
import { error, hasErrors } from "../../packages/core/src/domain/Diagnostic";
import * as fs from "node:fs";
import * as path from "node:path";
import { checkBriefBody } from "../../packages/core/src/domain/BriefCards";
import type { ProjectSurfaces } from "../../packages/core/src/domain/BriefCards";
import { checkFrontMatter, frontMatter } from "./brief-setup";

/**
 * What the project can show (REQ-245): forja says it in `forja.config.json`;
 * otherwise a React Native or Expo dependency in a package.json, at the root
 * or one level into apps/ or packages/. Unknown — nothing compared — when the
 * folder has no build file at all.
 */
export function projectSurfaces(projectDir: string): ProjectSurfaces {
  const read = (rel: string) => {
    try {
      return fs.readFileSync(path.join(projectDir, rel), "utf8");
    } catch {
      return "";
    }
  };
  const forja = read("forja.config.json");
  if (forja) {
    try {
      const platforms: string[] = JSON.parse(forja).platforms || [];
      return { mobileApp: platforms.includes("mobile") };
    } catch {
      /* unreadable: fall through to the dependencies */
    }
  }
  const manifests = ["package.json"];
  for (const dir of ["apps", "packages"]) {
    try {
      for (const e of fs.readdirSync(path.join(projectDir, dir), { withFileTypes: true }))
        if (e.isDirectory()) manifests.push(`${dir}/${e.name}/package.json`);
    } catch {
      /* no such folder */
    }
  }
  const texts = manifests.map(read).filter(Boolean);
  const builds = ["pom.xml", "build.gradle", "build.gradle.kts"].some((f) => read(f));
  if (texts.length === 0 && !builds) return {};
  return { mobileApp: texts.some((t) => /"(react-native|expo)"\s*:/.test(t)) };
}

/** Every finding on a brief, front matter first; `file` is the brief's path. */
export function checkBrief(
  text: string,
  file: string,
  project: ProjectSurfaces = {}
): Diagnostic[] {
  const head =
    frontMatter(text) === null
      ? [
          error("brief_no_front_matter", "The brief has no front matter.", {
            fix: "Run `specgate propose --from-brief` — it shows the four fields to add at the top.",
          }),
        ]
      : checkFrontMatter(text).map((p) => error(p.code, p.message, { fix: p.fix }));
  const rank = { error: 0, warning: 1, info: 2 };
  return [...head, ...checkBriefBody(text, project)]
    .map((d) => ({ ...d, file }))
    .sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Whether a draft may be opened from this brief: no error among its findings. */
export function briefReady(findings: readonly Diagnostic[]): boolean {
  return !hasErrors(findings);
}
