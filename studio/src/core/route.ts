/** The route's data, as `/api/route` and `/api/home` give it (REQ-205, REQ-212). */
import type { Section } from "./routes";

export type StepKey = "project" | "brief" | "drafts" | "questions" | "review" | "build" | "report";
export type StepState = "done" | "current" | "open" | "locked";

export interface RouteData {
  project: string;
  isProject: boolean;
  /** A folder with no files: a project can be created in it (REQ-213). */
  empty?: boolean;
  steps: Array<{ key: StepKey; state: StepState; counts: Record<string, number> }>;
  next: StepKey | null;
  /** What the next step means here (REQ-474). */
  hint?: "adopt" | "create" | "specify" | null;
  /** The areas adoption found (REQ-471). */
  areas?: number;
}

export interface HomeData {
  built: number;
  total: number;
  questions: number;
  drafts: number;
  ready: number;
  modules: Array<{ name: string; done: number; total: number; waiting: number; draft: boolean }>;
}

/** Where each step of the route is done in the studio (REQ-212). */
export const STEP_SECTION: Record<StepKey, Section> = {
  project: "settings",
  brief: "brief",
  drafts: "changes",
  questions: "questions",
  review: "changes",
  build: "build",
  report: "report",
};
