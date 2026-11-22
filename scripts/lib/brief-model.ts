/**
 * The project's domain model, to draw (brief-domain-views REQ-658): the
 * workshop's models when there are any, else the specification — the
 * capabilities and the open changes' deltas — and the use cases.
 */
import * as fs from "fs";
import * as path from "path";
import {
  modelFromSpec,
  moduleFromYaml,
  requirementsOf,
  type DomainView,
  type SpecRequirement,
  type SpecUseCase,
} from "../../packages/core/src/domain/DomainView";
import { projectUseCases } from "./domain-docs";
import { MODELS_DIR } from "../draft/workshop-import";

const specFiles = (root: string): Array<{ module: string; text: string }> => {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(root, d.name, "spec.md"))
    .filter((f) => fs.existsSync(f))
    .map((f) => ({ module: path.basename(path.dirname(f)), text: fs.readFileSync(f, "utf8") }));
};

export function briefModel(dir: string): DomainView {
  const models = path.join(dir, MODELS_DIR);
  const yamls = fs.existsSync(models)
    ? fs
        .readdirSync(models)
        .filter((f) => f.endsWith(".yaml"))
        .sort()
    : [];
  if (yamls.length) {
    const modules = yamls.map((f) => moduleFromYaml(fs.readFileSync(path.join(models, f), "utf8")));
    // The core context first, as the workshop's canvases put it.
    modules.sort(
      (a, b) =>
        Number(b.classification.domain === "core") - Number(a.classification.domain === "core")
    );
    return { source: "workshop", modules };
  }
  const specs = path.join(dir, "docs", "specs");
  const requirements: SpecRequirement[] = [];
  const seen = new Set<string>();
  const add = (list: SpecRequirement[]) => {
    for (const r of list) if (!seen.has(r.id)) (seen.add(r.id), requirements.push(r));
  };
  // Open changes first: their requirements are the newest word on them.
  const changes = path.join(specs, "changes");
  if (fs.existsSync(changes))
    for (const c of fs.readdirSync(changes, { withFileTypes: true }))
      if (c.isDirectory() && c.name !== "archive")
        for (const f of specFiles(path.join(changes, c.name, "specs")))
          add(requirementsOf(f.text, f.module));
  for (const f of specFiles(path.join(specs, "capabilities")))
    add(requirementsOf(f.text, f.module));
  const moduleOfReq = new Map(requirements.map((r) => [r.id, r.module]));
  const uc = projectUseCases(dir);
  const useCases: SpecUseCase[] = [];
  const pushCase = (c: {
    id: string;
    name: string;
    actor?: string | null;
    requirements?: string[];
    spec: { flows: Array<{ id: string; steps: string[]; lanes: string[] }> } | null;
  }) => {
    const main = c.spec?.flows.find((f) => f.id === "main");
    if (!main) return;
    useCases.push({
      id: c.id,
      name: c.name,
      actor: c.actor ?? null,
      module: (c.requirements ?? []).map((r) => moduleOfReq.get(r)).find(Boolean) ?? null,
      steps: main.steps.map((text, i) => ({ actor: main.lanes[i] ?? "", text })),
    });
  };
  for (const c of uc?.cases ?? []) pushCase(c as never);
  for (const c of uc?.proposed ?? [])
    if (!useCases.some((u) => u.id === (c as { id: string }).id)) pushCase(c as never);
  return modelFromSpec({ requirements, useCases });
}
