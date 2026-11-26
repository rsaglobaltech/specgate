/**
 * Where each requirement lives (REQ-678): the map an agent reads to reach a
 * feature in the running app and check its own work — phase 1 of the trust
 * curve (docs/specs/trust-curve.md).
 *
 * Read as `status` reads the project: with every open change archived into it.
 * The route is the trace's `route=`, else the first page an end-to-end test
 * (or a test) that names the requirement opens.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { inFlightView } from "./in-flight";
import { readCapabilityRequirements } from "./capability-specs";
import { requirementsIn } from "../../packages/core/src/domain/DerivedMatrix";
import { matrixScenarios } from "../cli/commands/spec/MatrixCommand";
import { e2eTestsNaming, requirementSurfaces } from "./screen-requirements";
import { readHarnessConfig } from "../../packages/core/src/infrastructure/HarnessConfigFile";

export interface MapEntry {
  requirement: string;
  title: string;
  capability: string | null;
  status: string;
  useCase: string | null;
  actor: string | null;
  surfaces: string[];
  route: string | null;
  routeFrom: "trace" | "e2e" | null;
  url: string | null;
  feature: string | null;
  scenarios: string[];
  code: string[];
  tests: string[];
  e2e: string[];
}

/** The first page a test opens: `goto("/x")`, `visit("/x")`, `get("/x")`. */
const OPENS = /\b(?:goto|visit|navigate|get)\(\s*(["'`])(\/[^"'`\s]*)\1/;
const OPENS_A_PAGE = /\b(?:page\.goto|cy\.visit|browser\.url|driver\.get)\(/;

function read(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function joinUrl(base: string, route: string): string {
  return `${base.replace(/\/+$/, "")}${route.startsWith("/") ? route : `/${route}`}`;
}

/** Every requirement's map entry, or the one asked for. */
export function featureMap(projectDir: string): MapEntry[] {
  const view = inFlightView(projectDir);
  try {
    const dir = view ? view.dir : projectDir;
    const rows = matrixScenarios(projectDir, view);
    const config = readHarnessConfig(projectDir) || {};
    const appUrl = String(config.appUrl || "").trim();
    const e2eDir = String(config.e2eDir || "").trim();

    // Title, capability and trace, from spec.md and the capability specs of the view.
    const known = new Map<
      string,
      { title: string; capability: string | null; trace: Record<string, unknown> }
    >();
    for (const r of requirementsIn(read(path.join(dir, "spec.md")))) {
      known.set(r.id, { title: r.title, capability: null, trace: r.trace });
    }
    for (const r of readCapabilityRequirements(dir)) {
      if (!r.req.id || known.has(r.req.id)) continue;
      const title = String(r.req.name || "")
        .replace(new RegExp(`^${r.req.id}\\s*[—–:-]?\\s*`), "")
        .trim();
      known.set(r.req.id, {
        title,
        capability: r.capability,
        trace: (r.req.trace || {}) as Record<string, unknown>,
      });
    }

    const byReq = new Map<string, typeof rows>();
    for (const row of rows)
      byReq.set(row.requirement, [...(byReq.get(row.requirement) || []), row]);
    const ids = [...new Set([...known.keys(), ...byReq.keys()])].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );

    return ids.map((id) => {
      const own = byReq.get(id) || [];
      const info = known.get(id);
      const trace = info?.trace || {};
      const text = (k: string) => {
        const v = trace[k];
        return v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim();
      };
      const tests = [...new Set(own.flatMap((r) => r.tests))].sort();
      const named = e2eDir ? e2eTestsNaming(projectDir, e2eDir, id) : [];
      const e2e = [
        ...new Set([
          ...named,
          ...tests.filter((t) => OPENS_A_PAGE.test(read(path.join(projectDir, t)))),
        ]),
      ].sort();

      let route = text("route");
      let routeFrom: MapEntry["routeFrom"] = route ? "trace" : null;
      if (!route) {
        for (const t of [...e2e, ...tests]) {
          const m = OPENS.exec(read(path.join(projectDir, t)));
          if (m) {
            route = m[2];
            routeFrom = "e2e";
            break;
          }
        }
      }
      return {
        requirement: id,
        title: info?.title || id,
        capability: info?.capability ?? null,
        status: own[0]?.status || text("status") || "Draft",
        useCase: text("uc"),
        actor: text("actor"),
        surfaces: requirementSurfaces(dir, id),
        route,
        routeFrom,
        url: route && appUrl ? joinUrl(appUrl, route) : null,
        feature: own.find((r) => r.feature)?.feature || text("feature"),
        scenarios: own.map((r) => r.scenario).filter((s): s is string => Boolean(s)),
        code: [...new Set(own.flatMap((r) => r.code))].sort(),
        tests,
        e2e,
      };
    });
  } finally {
    if (view) view.cleanup();
  }
}
