/**
 * The layers and commands of a project, read from its files (REQ-548).
 *
 * Every fact names its evidence — the dependency in a manifest, or the folder —
 * so a person can check it, and nothing is inferred that a file does not say.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { detectTestCommand } from "../harness/init";
import {
  STACK_FILE,
  stackCommands,
  type LayerFact,
  type StackCommand,
} from "../../packages/core/src/domain/StackFile";

const read = (dir: string, rel: string) => {
  try {
    return fs.readFileSync(path.join(dir, rel), "utf8");
  } catch {
    return null;
  }
};
const exists = (dir: string, rel: string) => fs.existsSync(path.join(dir, rel));

interface Probe {
  layer: LayerFact["layer"];
  technology: string;
  /** A dependency name, as it appears in a manifest. */
  dep?: RegExp;
  /** A folder or file that shows it. */
  path?: string;
}

const PROBES: Probe[] = [
  // migration
  { layer: "migration", technology: "Flyway", dep: /flyway/ },
  { layer: "migration", technology: "Flyway", path: "src/main/resources/db/migration" },
  { layer: "migration", technology: "Liquibase", dep: /liquibase/ },
  { layer: "migration", technology: "Prisma Migrate", path: "prisma/migrations" },
  { layer: "migration", technology: "Alembic", path: "alembic" },
  { layer: "migration", technology: "Rails migrations", path: "db/migrate" },
  { layer: "migration", technology: "Knex migrations", dep: /^knex$/ },
  // persistence
  { layer: "persistence", technology: "JPA (Spring Data)", dep: /spring-boot-starter-data-jpa/ },
  { layer: "persistence", technology: "JDBC (Spring)", dep: /spring-boot-starter-jdbc/ },
  { layer: "persistence", technology: "Prisma", dep: /^@prisma\/client$|^prisma$/ },
  { layer: "persistence", technology: "TypeORM", dep: /^typeorm$/ },
  { layer: "persistence", technology: "Sequelize", dep: /^sequelize$/ },
  { layer: "persistence", technology: "Mongoose", dep: /^mongoose$/ },
  { layer: "persistence", technology: "SQLAlchemy", dep: /^sqlalchemy$/i },
  { layer: "persistence", technology: "GORM", dep: /gorm\.io\/gorm/ },
  // service
  { layer: "service", technology: "Spring Boot", dep: /spring-boot-starter/ },
  { layer: "service", technology: "NestJS", dep: /^@nestjs\/core$/ },
  { layer: "service", technology: "Express", dep: /^express$/ },
  { layer: "service", technology: "Fastify", dep: /^fastify$/ },
  { layer: "service", technology: "Django", dep: /^django$/i },
  { layer: "service", technology: "Flask", dep: /^flask$/i },
  { layer: "service", technology: "FastAPI", dep: /^fastapi$/i },
  { layer: "service", technology: "Rails", dep: /^rails$/ },
  // api
  { layer: "api", technology: "REST (Spring Web)", dep: /spring-boot-starter-web\b/ },
  { layer: "api", technology: "OpenAPI (springdoc)", dep: /springdoc-openapi/ },
  { layer: "api", technology: "GraphQL", dep: /graphql/ },
  { layer: "api", technology: "OpenAPI", path: "openapi.yaml" },
  { layer: "api", technology: "OpenAPI", path: "openapi.yml" },
  { layer: "api", technology: "OpenAPI", path: "openapi.json" },
  // ui
  { layer: "ui", technology: "Next.js", dep: /^next$/ },
  { layer: "ui", technology: "React", dep: /^react$/ },
  { layer: "ui", technology: "Vue", dep: /^vue$/ },
  { layer: "ui", technology: "Angular", dep: /^@angular\/core$/ },
  { layer: "ui", technology: "Svelte", dep: /^svelte$/ },
  // end-to-end
  { layer: "end-to-end", technology: "Playwright", dep: /^@playwright\/test$|playwright/ },
  { layer: "end-to-end", technology: "Cypress", dep: /^cypress$/ },
  { layer: "end-to-end", technology: "Selenium", dep: /selenium/ },
];

/** Every dependency the project's manifests declare, with the manifest it is in. */
function dependencies(dir: string): Array<{ name: string; manifest: string }> {
  const out: Array<{ name: string; manifest: string }> = [];
  const pkg = read(dir, "package.json");
  if (pkg) {
    try {
      const data = JSON.parse(pkg) as Record<string, Record<string, string> | undefined>;
      for (const k of ["dependencies", "devDependencies"]) {
        for (const name of Object.keys(data[k] || {})) out.push({ name, manifest: "package.json" });
      }
    } catch {
      // Not readable: no evidence.
    }
  }
  const pom = read(dir, "pom.xml");
  if (pom) {
    for (const m of pom.matchAll(/<artifactId>([^<]+)<\/artifactId>/g)) {
      out.push({ name: m[1].trim(), manifest: "pom.xml" });
    }
  }
  for (const gradle of ["build.gradle", "build.gradle.kts"]) {
    const text = read(dir, gradle);
    if (!text) continue;
    for (const m of text.matchAll(/["']([\w.-]+):([\w.-]+)(?::[^"']*)?["']/g)) {
      out.push({ name: m[2], manifest: gradle });
    }
  }
  const gomod = read(dir, "go.mod");
  if (gomod) {
    for (const m of gomod.matchAll(/^\s*(?:require\s+)?([\w.-]+\.[\w./-]+)\s+v\d/gm)) {
      out.push({ name: m[1], manifest: "go.mod" });
    }
  }
  for (const py of ["requirements.txt", "pyproject.toml"]) {
    const text = read(dir, py);
    if (!text) continue;
    for (const m of text.matchAll(/^\s*"?([A-Za-z][\w.-]*)/gm)) {
      out.push({ name: m[1], manifest: py });
    }
  }
  const gemfile = read(dir, "Gemfile");
  if (gemfile) {
    for (const m of gemfile.matchAll(/^\s*gem\s+['"]([\w.-]+)['"]/gm)) {
      out.push({ name: m[1], manifest: "Gemfile" });
    }
  }
  return out;
}

/** The layers, one fact per technology, with its first evidence. */
export function detectLayers(dir: string): LayerFact[] {
  const deps = dependencies(dir);
  const seen = new Set<string>();
  const out: LayerFact[] = [];
  for (const p of PROBES) {
    const key = `${p.layer}|${p.technology}`;
    if (seen.has(key)) continue;
    let evidence = "";
    if (p.dep) {
      const hit = deps.find((d) => p.dep!.test(d.name));
      if (hit) evidence = `${hit.manifest}: ${hit.name}`;
    }
    if (!evidence && p.path && exists(dir, p.path)) evidence = p.path;
    if (!evidence) continue;
    seen.add(key);
    out.push({ layer: p.layer, technology: p.technology, evidence });
  }
  return out;
}

/** The commands the build files imply. */
export function detectCommands(dir: string): Partial<Record<StackCommand, string>> {
  const out: Partial<Record<StackCommand, string>> = {};
  if (exists(dir, "pom.xml")) {
    out.build = exists(dir, "mvnw")
      ? "./mvnw -B package -DskipTests"
      : "mvn -B package -DskipTests";
  } else if (exists(dir, "build.gradle") || exists(dir, "build.gradle.kts")) {
    out.build = exists(dir, "gradlew") ? "./gradlew build -x test" : "gradle build -x test";
  } else if (exists(dir, "package.json")) {
    try {
      const scripts = (JSON.parse(read(dir, "package.json") || "{}").scripts || {}) as Record<
        string,
        string
      >;
      if (scripts.build) out.build = "npm run build";
      if (scripts["test:e2e"]) out["end-to-end"] = "npm run test:e2e";
    } catch {
      // No scripts to read.
    }
  } else if (exists(dir, "go.mod")) out.build = "go build ./...";
  else if (exists(dir, "Cargo.toml")) out.build = "cargo build";
  const test = detectTestCommand(dir);
  if (test) out.test = test;
  if (!out["end-to-end"]) {
    const layers = detectLayers(dir).filter((l) => l.layer === "end-to-end");
    if (layers.some((l) => l.technology === "Playwright"))
      out["end-to-end"] = "npx playwright test";
    else if (layers.some((l) => l.technology === "Cypress")) out["end-to-end"] = "npx cypress run";
  }
  return out;
}

/** The command the stack file states, when the project has one. */
export function stackFileCommand(dir: string, name: StackCommand): string {
  return stackCommands(read(dir, STACK_FILE))[name] || "";
}
