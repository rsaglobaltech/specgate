/**
 * The shape of the documentation site, decided once.
 *
 * Ordered by the question a reader is asking, not alphabetically and not by
 * the order the files happened to be written. Someone who has just run
 * `npx @rsaglobaltech/specgate` needs a different page from someone deciding whether
 * to adopt the tool at all, and the sidebar should make that obvious without
 * being read end to end.
 *
 * A document missing from this list is still rendered — it simply does not
 * appear in the sidebar. `tests/unit/docs-site.test.ts` fails when a shipped
 * document is orphaned that way, because a page nobody can navigate to is a
 * page nobody reads.
 */

export interface NavEntry {
  /** Path relative to `docs/`, without the extension. */
  readonly slug: string;
  /** What the sidebar calls it — often shorter than the document's own title. */
  readonly label: string;
  /** One line under the label on section index pages. */
  readonly blurb: string;
  /** Optional key into `icons.ts`. Decoration: an unknown name renders nothing. */
  readonly icon?: string;
  /**
   * A subsection inside the section: the sidebar draws it as a small heading,
   * and Previous/Next stay inside it — the last phase of one journey does not
   * lead into the first phase of the other.
   */
  readonly group?: string;
  /** Its number in a journey; pages that have one get the step indicator. */
  readonly step?: number;
  /** How long the step takes, shown in the step indicator. */
  readonly time?: string;
  /** The Spanish sidebar's label, blurb and group; English where absent. */
  readonly es?: { readonly label?: string; readonly blurb?: string; readonly group?: string };
}

export interface NavSection {
  readonly title: string;
  /** Shown at the top of the section on the docs home page. */
  readonly summary: string;
  /** Optional key into `icons.ts`, drawn beside the group heading. */
  readonly icon?: string;
  readonly entries: readonly NavEntry[];
  /** The Spanish section title and summary; English where absent. */
  readonly es?: { readonly title?: string; readonly summary?: string };
}

/**
 * The places a reader goes, in the order they need them: start, where the
 * work comes from, every day, the gate, existing code, reference, extensions;
 * then forja, a companion tool, and everything else under "Advanced". Every
 * shipped document is still in exactly one section.
 */
export const NAV: readonly NavSection[] = [
  {
    title: "Start",
    icon: "rocket",
    summary:
      "Install it, learn the ideas behind it, and follow one of two journeys of five short steps — a new project, or code you already have.",
    es: {
      title: "Empezar",
      summary:
        "Instálalo, conoce las ideas que hay detrás y sigue uno de dos recorridos de cinco pasos cortos: un proyecto nuevo o código que ya tienes.",
    },
    entries: [
      {
        slug: "start",
        group: "Begin",
        label: "Start here",
        blurb: "Two paths, six commands each: an existing project, or a new one.",
        es: {
          label: "Empieza aquí",
          blurb: "Dos caminos, seis comandos cada uno: un proyecto existente o uno nuevo.",
          group: "Para empezar",
        },
      },
      {
        slug: "getting-started",
        group: "Begin",
        label: "Getting started",
        blurb: "Installing it, and where to read more.",
        es: {
          label: "Primeros pasos",
          blurb: "Cómo instalarlo y dónde leer más.",
          group: "Para empezar",
        },
      },
      {
        slug: "agent-kickoff",
        group: "Begin",
        label: "What to tell your agent",
        blurb: "The prompt for Codex, OpenCode or Claude Code — or `specgate status --prompt`.",
        es: {
          label: "Qué decirle a tu agente",
          blurb: "El prompt para Codex, OpenCode o Claude Code, o `specgate status --prompt`.",
          group: "Para empezar",
        },
      },
      {
        slug: "concepts",
        group: "Begin",
        label: "Concepts",
        blurb:
          "The six ideas behind every command, and the vocabulary: change, delta, draft, gate, matrix.",
        es: {
          label: "Conceptos",
          blurb:
            "Las seis ideas detrás de cada comando y el vocabulario: change, delta, borrador, gate, matriz.",
          group: "Para empezar",
        },
      },
      {
        slug: "methodology",
        group: "Begin",
        label: "The method",
        blurb:
          "The way of working the tool encodes: six principles, four phases, two ways in, who does what, and where each artefact lives.",
        es: {
          label: "El método",
          blurb:
            "La forma de trabajar que la herramienta codifica: seis principios, cuatro fases, dos formas de entrar, quién hace qué y dónde vive cada artefacto.",
          group: "Para empezar",
        },
      },
      {
        slug: "studio",
        group: "Begin",
        label: "The studio — no terminal",
        blurb:
          "Specgate as an app: from an empty folder to the report, step by step, without the commands.",
        es: {
          label: "El studio, sin terminal",
          blurb: "Specgate como app: de una carpeta vacía al informe, paso a paso, sin comandos.",
          group: "Para empezar",
        },
      },
      {
        slug: "studio-team",
        label: "The studio for a team",
        blurb:
          "Behind your sign-in proxy: readers, editors and admins, and every edit a pull request.",
        es: {
          label: "El studio para un equipo",
          blurb:
            "Detrás de tu proxy de inicio de sesión: lectores, editores y administradores, y cada edición un pull request.",
        },
      },
      {
        slug: "start/scratch-1-install",
        group: "From scratch",
        step: 1,
        time: "5 min",
        label: "Install and set up",
        blurb: "Create the project with your own tools, set Specgate up, run the gate once.",
        es: {
          label: "Instalar y configurar",
          blurb:
            "Crea el proyecto con tus propias herramientas, configura Specgate y ejecuta el gate una vez.",
          group: "Desde cero",
        },
      },
      {
        slug: "start/scratch-2-specify",
        group: "From scratch",
        step: 2,
        time: "20–60 min a module",
        label: "Specify",
        blurb:
          "The brief becomes a draft change per module, checked against the brief, then reviewed by a person.",
        es: {
          label: "Especificar",
          blurb:
            "El brief se convierte en un change borrador por módulo, verificado contra el brief y luego revisado por una persona.",
          group: "Desde cero",
        },
      },
      {
        slug: "start/scratch-3-build",
        group: "From scratch",
        step: 3,
        time: "as long as the code",
        label: "Build",
        blurb: "The first requirement, test first — by hand or handed to the harness.",
        es: {
          label: "Construir",
          blurb: "El primer requisito, con el test primero: a mano o delegado al harness.",
          group: "Desde cero",
        },
      },
      {
        slug: "start/scratch-4-prove",
        group: "From scratch",
        step: 4,
        time: "2 min",
        label: "Prove",
        blurb:
          "`apply` marks a requirement Implemented only through the gate; `check` and `report` show where it stands.",
        es: {
          label: "Demostrar",
          blurb:
            "`apply` marca un requisito como Implemented solo a través del gate; `check` y `report` muestran en qué punto está.",
          group: "Desde cero",
        },
      },
      {
        slug: "start/scratch-5-every-day",
        group: "From scratch",
        step: 5,
        time: "10 min, once",
        label: "Every day",
        blurb: "The gate in CI, and the four verbs every day.",
        es: {
          label: "Día a día",
          blurb: "El gate en CI y los cuatro verbos de cada día.",
          group: "Desde cero",
        },
      },
      {
        slug: "start/existing-1-adopt",
        group: "Existing project",
        step: 1,
        time: "5 min",
        label: "Adopt",
        blurb: "`onboard` and `init` on a working codebase, touching no code.",
        es: {
          label: "Adoptar",
          blurb: "`onboard` e `init` sobre un código que ya funciona, sin tocar código.",
          group: "Proyecto existente",
        },
      },
      {
        slug: "start/existing-2-specify",
        group: "Existing project",
        step: 2,
        time: "10 min",
        label: "Specify",
        blurb: "One behaviour you rely on, written as a requirement with a real example.",
        es: {
          label: "Especificar",
          blurb: "Un comportamiento del que dependes, escrito como requisito con un ejemplo real.",
          group: "Proyecto existente",
        },
      },
      {
        slug: "start/existing-3-first-requirement",
        group: "Existing project",
        step: 3,
        time: "5 min",
        label: "First requirement",
        blurb: "The test you already have names it; `apply` marks it Implemented.",
        es: {
          label: "Primer requisito",
          blurb: "El test que ya tienes lo nombra; `apply` lo marca como Implemented.",
          group: "Proyecto existente",
        },
      },
      {
        slug: "start/existing-4-ci",
        group: "Existing project",
        step: 4,
        time: "10 min",
        label: "CI",
        blurb: "The gate on every pull request, without fixing the past first.",
        es: {
          label: "CI",
          blurb: "El gate en cada pull request, sin tener que arreglar el pasado primero.",
          group: "Proyecto existente",
        },
      },
      {
        slug: "start/existing-5-every-day",
        group: "Existing project",
        step: 5,
        label: "Every day",
        blurb: "One behaviour per bug fix, one module at a time.",
        es: {
          label: "Día a día",
          blurb: "Un comportamiento por cada corrección de bug, un módulo a la vez.",
          group: "Proyecto existente",
        },
      },
      {
        slug: "quickstart",
        group: "Someone else set it up",
        label: "Joining a project",
        blurb:
          "The repository already uses Specgate: see where it stands and deliver your first requirement.",
        es: {
          label: "Unirse a un proyecto",
          blurb:
            "El repositorio ya usa Specgate: mira en qué punto está y entrega tu primer requisito.",
          group: "Alguien más lo configuró",
        },
      },
    ],
  },
  {
    title: "Where work comes from",
    icon: "compass",
    summary:
      "Three entries into the same lifecycle: a change you describe, a client brief, or a Jira ticket.",
    es: {
      title: "De dónde llega el trabajo",
      summary:
        "Tres entradas al mismo ciclo de vida: un change que describes, el brief de un cliente o un ticket de Jira.",
    },
    entries: [
      {
        slug: "start/write-the-brief",
        label: "Write the brief",
        blurb:
          "Your plan as docs/brief.md, the four fields on top — or let your agent propose them.",
        es: {
          label: "Escribir el brief",
          blurb:
            "Tu plan como docs/brief.md, con los cuatro campos arriba, o deja que tu agente los proponga.",
        },
      },
      {
        slug: "from-a-brief",
        label: "From a client brief",
        blurb: "A brief to a reviewed draft: assumptions, open questions and the draft checklist.",
        es: {
          label: "Desde el brief de un cliente",
          blurb:
            "De un brief a un borrador revisado: supuestos, preguntas abiertas y la checklist del borrador.",
        },
      },
      {
        slug: "from-a-ticket",
        label: "From a Jira ticket",
        blurb:
          "A story with acceptance criteria to a change checked against it, a branch and a pull request.",
        es: {
          label: "Desde un ticket de Jira",
          blurb:
            "De una historia con criterios de aceptación a un change verificado contra ella, una rama y un pull request.",
        },
      },
      {
        slug: "existing-project-with-jira",
        label: "An existing codebase, with Jira",
        blurb:
          "Adopt a years-old codebase whose work arrives as Jira tickets: the spec grows ticket by ticket.",
        es: {
          label: "Código existente, con Jira",
          blurb:
            "Adopta un código con años cuyo trabajo llega como tickets de Jira: la spec crece ticket a ticket.",
        },
      },
      {
        slug: "reverse",
        label: "Specify a system that already runs",
        blurb:
          "Existing code to Draft requirements citing their lines, one module at a time, and a gate baseline.",
        es: {
          label: "Especificar un sistema en marcha",
          blurb:
            "Del código existente a requisitos Draft que citan sus líneas, un módulo a la vez, y un baseline del gate.",
        },
      },
    ],
  },
  {
    title: "Every day",
    icon: "file",
    summary: "The loop a team runs on every pull request.",
    es: { title: "Día a día", summary: "El ciclo que un equipo sigue en cada pull request." },
    entries: [
      {
        slug: "first-pr",
        label: "Your team's first PR",
        blurb: "What the author writes, what the reviewer reads, and what to do when check fails.",
        es: {
          label: "El primer PR de tu equipo",
          blurb: "Qué escribe el autor, qué lee el revisor y qué hacer cuando check falla.",
        },
      },
      {
        slug: "reviewing-changes",
        label: "Change a shipped requirement",
        blurb: "Propose, review and archive a change to specs that already shipped.",
        es: {
          label: "Cambiar un requisito publicado",
          blurb: "Propón, revisa y archiva un change sobre specs ya publicadas.",
        },
      },
      {
        slug: "sealed-acceptance",
        label: "Sealed acceptance tests",
        blurb: "Tests another hand writes and a person seals, which the agent cannot change.",
        es: {
          label: "Tests de aceptación sellados",
          blurb:
            "Tests que escribe otra mano y sella una persona, y que el agente no puede cambiar.",
        },
      },
      {
        slug: "writing-specs",
        label: "Writing specs",
        blurb: "Requirements, scenarios and the traceability matrix.",
        es: {
          label: "Escribir specs",
          blurb: "Requisitos, escenarios y la matriz de trazabilidad.",
        },
      },
      {
        slug: "business-review",
        label: "Review with the business",
        blurb:
          "A change as one HTML page to send, and journeys across requirements tested end to end.",
        es: {
          label: "Revisar con negocio",
          blurb:
            "Un change como una sola página HTML para enviar, y recorridos entre requisitos probados de extremo a extremo.",
        },
      },
      {
        slug: "transition",
        label: "Release notes, acceptance, user guides",
        blurb:
          "Release notes from archived changes, a checklist a person signs, and a guide per actor.",
        es: {
          label: "Notas de versión, aceptación, guías",
          blurb:
            "Notas de versión a partir de changes archivados, una checklist que firma una persona y una guía por actor.",
        },
      },
      {
        slug: "domain-language",
        label: "Glossary, rules and diagrams",
        blurb:
          "One word for one thing, numbered business rules each tested, and the entity and actor diagrams generated.",
        es: {
          label: "Glosario, reglas y diagramas",
          blurb:
            "Una palabra para cada cosa, reglas de negocio numeradas y probadas, y los diagramas de entidades y actores generados.",
        },
      },
      {
        slug: "new-project",
        label: "A new product, step by step",
        blurb: "The twelve steps six pilots took, from a client's brief to a running product.",
        es: {
          label: "Un producto nuevo, paso a paso",
          blurb:
            "Los doce pasos que siguieron seis pilotos, del brief de un cliente a un producto en marcha.",
        },
      },
    ],
  },
  {
    title: "The gate and quality checks",
    icon: "server",
    summary:
      "What fails a pull request — tests, coverage, mutation, SonarQube, SpotBugs, secrets — and how to wire it in.",
    es: {
      title: "El gate y los checks de calidad",
      summary:
        "Qué hace fallar un pull request (tests, cobertura, mutación, SonarQube, SpotBugs, secretos) y cómo integrarlo.",
    },
    entries: [
      {
        slug: "gate/index",
        group: "The gate, step by step",
        step: 1,
        label: "The gate",
        blurb: "What it proves, its stages in order, exit codes, and which command to run when.",
        es: {
          label: "El gate",
          blurb:
            "Qué demuestra, sus etapas en orden, los códigos de salida y qué comando ejecutar en cada momento.",
          group: "El gate, paso a paso",
        },
      },
      {
        slug: "gate/local",
        group: "The gate, step by step",
        step: 2,
        label: "On your machine",
        blurb: "check before you push: your tests, the base branch, only what changed, a hook.",
        es: {
          label: "En tu máquina",
          blurb: "check antes de hacer push: tus tests, la rama base, solo lo que cambió, un hook.",
          group: "El gate, paso a paso",
        },
      },
      {
        slug: "gate/ci",
        group: "The gate, step by step",
        step: 3,
        label: "In CI",
        blurb:
          "The job for GitHub, GitLab, Azure or Jenkins, line by line, made a required check and pinned.",
        es: {
          label: "En CI",
          blurb:
            "El job para GitHub, GitLab, Azure o Jenkins, línea a línea, convertido en check obligatorio y fijado.",
          group: "El gate, paso a paso",
        },
      },
      {
        slug: "gate/baselines",
        group: "The gate, step by step",
        step: 4,
        label: "Adopt it without a red build",
        blurb:
          "Today's findings recorded as debt — the gate's and the quality checks' — so only new ones fail.",
        es: {
          label: "Adoptarlo sin un build en rojo",
          blurb:
            "Los hallazgos de hoy registrados como deuda, los del gate y los de los checks de calidad, para que solo fallen los nuevos.",
          group: "El gate, paso a paso",
        },
      },
      {
        slug: "gate/failures",
        group: "The gate, step by step",
        step: 5,
        label: "Read a failure",
        blurb:
          "Every code the gate fails with, what it means, and why CI is red when your machine is green.",
        es: {
          label: "Leer un fallo",
          blurb:
            "Cada código con el que falla el gate, qué significa y por qué CI está en rojo cuando tu máquina está en verde.",
          group: "El gate, paso a paso",
        },
      },
      {
        slug: "gate/policy",
        group: "The gate, step by step",
        step: 6,
        label: "Configure the gate",
        blurb:
          "What fails, what is reported, what is skipped: a preset, a level per rule, and a date from which errors count.",
        es: {
          label: "Configurar el gate",
          blurb:
            "Qué falla, qué se reporta, qué se omite: un preset, un nivel por regla y una fecha desde la que cuentan los errores.",
          group: "El gate, paso a paso",
        },
      },
      {
        slug: "validating",
        label: "Validating",
        blurb: "Every check the gate runs, what each status owes, and the flags behind check.",
        es: {
          label: "Validación",
          blurb: "Cada check que ejecuta el gate, lo que exige cada estado y los flags de check.",
        },
      },
      {
        slug: "fast-gate",
        label: "A fast gate",
        blurb:
          "Run only the tests a change touches, reuse the ones that passed, arch and tests side by side.",
        es: {
          label: "Un gate rápido",
          blurb:
            "Ejecuta solo los tests que toca un change, reutiliza los que pasaron, arch y tests en paralelo.",
        },
      },
      {
        slug: "quality",
        label: "Quality: Sonar, SpotBugs, coverage",
        blurb:
          "Coverage and mutation of what a change adds, SonarQube, SpotBugs, PMD, Semgrep, secrets, dependencies — all in Docker, no account.",
        es: {
          label: "Calidad: Sonar, SpotBugs, cobertura",
          blurb:
            "Cobertura y mutación de lo que añade un change, SonarQube, SpotBugs, PMD, Semgrep, secretos, dependencias: todo en Docker, sin cuenta.",
        },
      },
      {
        slug: "whats-new-1.0",
        label: "What is new in 1.0",
        blurb:
          "The 1.0 candidate, feature by feature: layers and approvals, a workspace of repositories, stories built in order, contracts, the live view — and each candidate.",
        es: {
          label: "Novedades de 1.0",
          blurb:
            "El candidato a 1.0, función por función: capas y aprobaciones, un workspace de repositorios, historias construidas en orden, contratos, la vista en vivo, y cada candidato.",
        },
      },
      {
        slug: "migrating-to-1.0",
        label: "Migrating to 1.0",
        blurb:
          "What breaks in 1.0, what specgate migrate 1.0 does about it, and how to try the candidate or stay on 0.27.",
        es: {
          label: "Migrar a 1.0",
          blurb:
            "Qué se rompe en 1.0, qué hace specgate migrate 1.0 al respecto y cómo probar el candidato o quedarte en 0.27.",
        },
      },
      {
        slug: "workspace",
        label: "Workspace: several repositories",
        blurb:
          "The repositories of one product: where it stands, one gate across them, ids like tracking:REQ-012, a story split per repository.",
        es: {
          label: "Workspace: varios repositorios",
          blurb:
            "Los repositorios de un producto: en qué punto está, un gate para todos, ids como tracking:REQ-012, una historia repartida por repositorio.",
        },
      },
      {
        slug: "automation",
        label: "Automation",
        blurb: "Generate the gate for GitHub, GitLab, Azure or Jenkins.",
        es: {
          label: "Automatización",
          blurb: "Genera el gate para GitHub, GitLab, Azure o Jenkins.",
        },
      },
    ],
  },
  {
    title: "Existing code",
    icon: "compass",
    summary: "Adopting Specgate on a repository that already ships.",
    es: {
      title: "Código existente",
      summary: "Adoptar Specgate en un repositorio que ya está en producción.",
    },
    entries: [
      {
        slug: "case-studies/case-1",
        label: "Worked example: brownfield adoption",
        blurb:
          "One existing service adopted end to end — invented company, every command and output real.",
        es: {
          label: "Ejemplo: adopción brownfield",
          blurb:
            "Un servicio existente adoptado de principio a fin: empresa inventada, cada comando y salida reales.",
        },
      },
      {
        slug: "vs-openspec",
        label: "Specgate or OpenSpec",
        blurb: "Where they differ, where OpenSpec is ahead, and how to use both.",
        es: {
          label: "Specgate u OpenSpec",
          blurb: "En qué se diferencian, en qué va por delante OpenSpec y cómo usar ambos.",
        },
      },
      {
        slug: "openspec",
        label: "Already on OpenSpec",
        blurb: "Keep your OpenSpec specs; verify proves that what they call done is done.",
        es: {
          label: "Ya usas OpenSpec",
          blurb:
            "Conserva tus specs de OpenSpec; verify demuestra que lo que dan por hecho está hecho.",
        },
      },
      {
        slug: "comparisons",
        label: "Comparisons",
        blurb: "How this differs from OpenSpec, Spec Kit and writing it yourself.",
        es: {
          label: "Comparaciones",
          blurb: "En qué se diferencia de OpenSpec, Spec Kit y de escribirlo tú mismo.",
        },
      },
    ],
  },
  {
    title: "Proven on real products",
    icon: "check",
    summary:
      "Six products built from real client briefs — what worked, and what Specgate got wrong.",
    es: {
      title: "Probado en productos reales",
      summary:
        "Seis productos construidos a partir de briefs reales de clientes: qué funcionó y en qué se equivocó Specgate.",
    },
    entries: [
      {
        slug: "projects/index",
        label: "All six, compared",
        blurb: "Brief, stack, requirements and tests for each pilot, side by side.",
        es: {
          label: "Los seis, comparados",
          blurb: "Brief, stack, requisitos y tests de cada piloto, lado a lado.",
        },
      },
      {
        slug: "projects/rebar-crew",
        label: "Rebar Crew — field app",
        blurb: "Expo + Next.js: 47 of 47, after a first round that was done and unusable.",
        es: {
          label: "Rebar Crew: app de campo",
          blurb: "Expo + Next.js: 47 de 47, tras una primera ronda terminada e inutilizable.",
        },
      },
      {
        slug: "projects/bookings",
        label: "Bookings — appointments",
        blurb: "Next.js from a detailed brief: 38 of 38 in five cycles.",
        es: {
          label: "Bookings: citas",
          blurb: "Next.js a partir de un brief detallado: 38 de 38 en cinco ciclos.",
        },
      },
      {
        slug: "projects/credit-shop",
        label: "Credit shop — e-commerce",
        blurb: "A five-line brief became 24 requirements, nearly every value an assumption.",
        es: {
          label: "Credit shop: e-commerce",
          blurb:
            "Un brief de cinco líneas se convirtió en 24 requisitos, casi cada valor un supuesto.",
        },
      },
      {
        slug: "projects/fincore",
        label: "FinCore — core banking",
        blurb: "Spring Boot: 59 of 60, one legal question left to the client.",
        es: {
          label: "FinCore: core bancario",
          blurb: "Spring Boot: 59 de 60, una pregunta legal pendiente para el cliente.",
        },
      },
      {
        slug: "projects/eventtech",
        label: "EventTech — event operations",
        blurb: "Quarkus with event sourcing and real time: 38 of 38.",
        es: {
          label: "EventTech: operación de eventos",
          blurb: "Quarkus con event sourcing y tiempo real: 38 de 38.",
        },
      },
      {
        slug: "projects/healthtech",
        label: "HealthTech — clinical cases",
        blurb: "Quarkus in a regulated domain: 23 of 24, no clinical rule invented.",
        es: {
          label: "HealthTech: casos clínicos",
          blurb: "Quarkus en un dominio regulado: 23 de 24, sin inventar ninguna regla clínica.",
        },
      },
    ],
  },
  {
    title: "Reference",
    icon: "book",
    summary: "Every command, a router to the right guide, and what to do when something fails.",
    es: {
      title: "Referencia",
      summary:
        "Cada comando, una guía para encontrar la guía correcta y qué hacer cuando algo falla.",
    },
    entries: [
      {
        slug: "commands",
        label: "Command reference",
        blurb: "Every command, its flags and its JSON shape.",
        es: { label: "Referencia de comandos", blurb: "Cada comando, sus flags y su forma JSON." },
      },
      {
        slug: "how-to",
        label: "How-to guides",
        blurb: "I want to… — the guide for each task.",
        es: { label: "Guías prácticas", blurb: "Quiero…: la guía para cada tarea." },
      },
      {
        slug: "faq",
        label: "FAQ",
        blurb: "The questions a team asks in its first week, answered in two lines each.",
        es: {
          label: "Preguntas frecuentes",
          blurb:
            "Las preguntas que un equipo hace en su primera semana, respondidas en dos líneas cada una.",
        },
      },
      {
        slug: "troubleshooting",
        label: "Troubleshooting",
        blurb: "When the gate says no and you disagree.",
        es: {
          label: "Solución de problemas",
          blurb: "Cuando el gate dice que no y no estás de acuerdo.",
        },
      },
    ],
  },
  {
    title: "Extensions",
    icon: "robot",
    summary: "Agents, MCP, the harness, domain packs and your issue tracker.",
    es: {
      title: "Extensiones",
      summary: "Agentes, MCP, el harness, domain packs y tu gestor de incidencias.",
    },
    entries: [
      {
        slug: "agents",
        label: "Agent tools",
        blurb: "Wire Claude Code, Cursor, Copilot and six others into the same loop.",
        es: {
          label: "Herramientas de agentes",
          blurb: "Conecta Claude Code, Cursor, Copilot y otros seis al mismo ciclo.",
        },
      },
      {
        slug: "mcp",
        label: "The MCP server",
        blurb:
          "The daily loop as tools for Claude Desktop, Cursor and other MCP clients, and the guard on the spec.",
        es: {
          label: "El servidor MCP",
          blurb:
            "El ciclo diario como herramientas para Claude Desktop, Cursor y otros clientes MCP, y la protección de la spec.",
        },
      },
      {
        slug: "harness",
        label: "The harness",
        blurb: "Unattended delivery: plan → agent → gate → apply, one worktree per requirement.",
        es: {
          label: "El harness",
          blurb: "Entrega desatendida: plan → agente → gate → apply, un worktree por requisito.",
        },
      },
      {
        slug: "harness-control",
        label: "Drive the harness from a tool",
        blurb:
          "The JSON stream, stop after the current requirement, a dirty tree, questions with ids.",
        es: {
          label: "Controlar el harness desde una herramienta",
          blurb:
            "El stream JSON, parar tras el requisito actual, un árbol con cambios, preguntas con ids.",
        },
      },
      {
        slug: "agent-ask",
        label: "Ask your agent",
        blurb:
          "A plan with its diff before anything is written: apply it, or discard it. What the studio's agent panel runs.",
        es: {
          label: "Pregúntale a tu agente",
          blurb:
            "Un plan con su diff antes de escribir nada: aplícalo o descártalo. Lo que ejecuta el panel del agente del studio.",
        },
      },
      {
        slug: "harness-report",
        label: "What the harness has cost",
        blurb: "First-attempt rate and cost per delivered requirement, from the run ledger.",
        es: {
          label: "Lo que ha costado el harness",
          blurb:
            "Tasa de acierto al primer intento y costo por requisito entregado, a partir del registro de ejecuciones.",
        },
      },
      {
        slug: "compatibility",
        label: "What 1.0 promises",
        blurb:
          "Semantic versioning, enforced: what never breaks within 1.x, how it is checked, deprecation before removal.",
        es: {
          label: "Lo que promete 1.0",
          blurb:
            "Versionado semántico, garantizado: qué nunca se rompe dentro de 1.x, cómo se comprueba, deprecación antes de eliminar.",
        },
      },
      {
        slug: "steering",
        label: "Drift and API contracts",
        blurb:
          "Behaviour changed without a requirement, and requirements that name an API operation that is not there.",
        es: {
          label: "Deriva y contratos de API",
          blurb:
            "Comportamiento que cambió sin un requisito, y requisitos que nombran una operación de API que no existe.",
        },
      },
      {
        slug: "harness-roles",
        label: "Lanes, roles and limits",
        blurb:
          "A tester and an implementer in their lanes, a cost ceiling, the files no agent may change, and approvals by role.",
        es: {
          label: "Carriles, roles y límites",
          blurb:
            "Un tester y un implementador en sus carriles, un tope de costo, los archivos que ningún agente puede cambiar y aprobaciones por rol.",
        },
      },
      {
        slug: "decisions",
        label: "Decisions, rights and the stack",
        blurb:
          "ADRs replaced, never rewritten; what the agent may decide on its own; the stack written down once.",
        es: {
          label: "Decisiones, permisos y el stack",
          blurb:
            "ADRs reemplazados, nunca reescritos; qué puede decidir el agente por su cuenta; el stack escrito una sola vez.",
        },
      },
      {
        slug: "domain-packs",
        label: "Domain packs",
        blurb: "Install requirements a pilot already proved, or package your own.",
        es: {
          label: "Domain packs",
          blurb: "Instala requisitos que un piloto ya demostró, o empaqueta los tuyos.",
        },
      },
      {
        slug: "packs-end-to-end",
        label: "Domain packs, end to end",
        blurb: "Install a pack, upgrade it to a new version, and take it off again.",
        es: {
          label: "Domain packs, de principio a fin",
          blurb: "Instala un pack, actualízalo a una nueva versión y vuelve a quitarlo.",
        },
      },
      {
        slug: "alm",
        label: "Jira, Azure Boards, GitHub, Linear",
        blurb: "Mirror requirements onto a board without letting the board define them.",
        es: {
          label: "Jira, Azure Boards, GitHub, Linear",
          blurb: "Refleja los requisitos en un tablero sin dejar que el tablero los defina.",
        },
      },
      {
        slug: "alm-phases",
        label: "The board follows the change",
        blurb:
          "Tickets move with their change, comments come back as notes, one sub-issue per repository.",
        es: {
          label: "El tablero sigue al change",
          blurb:
            "Los tickets se mueven con su change, los comentarios vuelven como notas, un sub-issue por repositorio.",
        },
      },
    ],
  },
  {
    // ADR-0033: forja's documentation lives here, one site for both tools.
    title: "New project (forja)",
    icon: "package",
    summary:
      "forja, a companion tool, generates a whole application with the architecture in place, sign-in working and Specgate adopted.",
    es: {
      title: "Proyecto nuevo (forja)",
      summary:
        "forja, una herramienta complementaria, genera una aplicación completa con la arquitectura en su sitio, el inicio de sesión funcionando y Specgate adoptado.",
    },
    entries: [
      {
        slug: "forja/getting-started",
        group: "Generate",
        label: "Getting started",
        blurb: "Generate a Next.js + Expo monorepo in TypeScript, with the hexagon in place.",
        es: {
          label: "Primeros pasos",
          blurb: "Genera un monorepo Next.js + Expo en TypeScript, con el hexágono en su sitio.",
          group: "Generar",
        },
      },
      {
        slug: "forja/java",
        group: "Generate",
        label: "Java backends",
        blurb: "A Spring Boot or Quarkus API, a Next.js web app and Keycloak sign-in.",
        es: {
          label: "Backends en Java",
          blurb:
            "Una API en Spring Boot o Quarkus, una app web Next.js e inicio de sesión con Keycloak.",
          group: "Generar",
        },
      },
      {
        slug: "forja/daily-use",
        group: "Grow it",
        label: "Daily use",
        blurb:
          "Add use cases, entities and ports where the architecture expects them; check the setup.",
        es: {
          label: "Uso diario",
          blurb:
            "Añade casos de uso, entidades y puertos donde la arquitectura los espera; verifica la configuración.",
          group: "Hacerlo crecer",
        },
      },
      {
        slug: "forja/specgate",
        group: "Grow it",
        label: "With Specgate",
        blurb: "How a generated project adopts Specgate, and how a use case names its requirement.",
        es: {
          label: "Con Specgate",
          blurb:
            "Cómo un proyecto generado adopta Specgate y cómo un caso de uso nombra su requisito.",
          group: "Hacerlo crecer",
        },
      },
      {
        slug: "forja/e2e",
        group: "Grow it",
        label: "End-to-end tests",
        blurb: "Playwright drives the sign-in flow in a real browser.",
        es: {
          label: "Tests de extremo a extremo",
          blurb: "Playwright recorre el flujo de inicio de sesión en un navegador real.",
          group: "Hacerlo crecer",
        },
      },
      {
        slug: "forja/cli",
        group: "Reference",
        label: "forja command line",
        blurb: "init, add, doctor: every flag and the values it accepts.",
        es: {
          label: "Línea de comandos de forja",
          blurb: "init, add, doctor: cada flag y los valores que acepta.",
          group: "Referencia",
        },
      },
      {
        slug: "forja/config",
        group: "Reference",
        label: "forja.config.json",
        blurb: "Every field, its values and its defaults.",
        es: {
          label: "forja.config.json",
          blurb: "Cada campo, sus valores y sus valores por defecto.",
          group: "Referencia",
        },
      },
      {
        slug: "forja/generated-project",
        group: "Reference",
        label: "What it generates",
        blurb: "Recipe by recipe: the folders, the files, the versions.",
        es: {
          label: "Lo que genera",
          blurb: "Receta por receta: las carpetas, los archivos, las versiones.",
          group: "Referencia",
        },
      },
      {
        slug: "forja/architecture",
        group: "Reference",
        label: "The generated architecture",
        blurb: "The hexagon forja generates and the rules that keep it.",
        es: {
          label: "La arquitectura generada",
          blurb: "El hexágono que genera forja y las reglas que lo mantienen.",
          group: "Referencia",
        },
      },
      {
        slug: "forja/contributing",
        group: "Reference",
        label: "Contributing to forja",
        blurb: "Develop forja, write a recipe, verify what it generates.",
        es: {
          label: "Contribuir a forja",
          blurb: "Desarrolla forja, escribe una receta, verifica lo que genera.",
          group: "Referencia",
        },
      },
    ],
  },
  {
    title: "Advanced",
    icon: "book",
    summary: "Longer reads, setups and the reasons behind the design.",
    es: {
      title: "Avanzado",
      summary: "Lecturas más largas, configuraciones y las razones detrás del diseño.",
    },
    entries: [
      {
        slug: "tutorial",
        label: "Tutorial: Smart Parking",
        blurb:
          "A complete worked example on a domain pack, from a blank folder to a delivered requirement.",
        es: {
          label: "Tutorial: Smart Parking",
          blurb:
            "Un ejemplo completo sobre un domain pack, de una carpeta vacía a un requisito entregado.",
        },
      },
      {
        slug: "agent-setup",
        label: "Choosing your agent",
        blurb: "Claude, Aider, Cursor or a three-line wrapper — and the two things that bite.",
        es: {
          label: "Elegir tu agente",
          blurb:
            "Claude, Aider, Cursor o un wrapper de tres líneas, y las dos cosas que dan problemas.",
        },
      },
      {
        slug: "supply-chain",
        label: "Supply chain",
        blurb: "SBOM, licences, provenance and what ships in the tarball.",
        es: {
          label: "Cadena de suministro",
          blurb: "SBOM, licencias, procedencia y lo que se incluye en el tarball.",
        },
      },
      {
        slug: "release-process",
        label: "Releases & deployment",
        blurb: "How a version is cut and published to npm, Docker and the docs site.",
        es: {
          label: "Versiones y despliegue",
          blurb:
            "Cómo se corta una versión y se publica en npm, Docker y el sitio de la documentación.",
        },
      },
      {
        slug: "articles/specs-that-cannot-lie",
        label: "Specs that cannot lie",
        blurb: "The argument the tool is built on, and the defects that shaped it.",
        es: {
          label: "Specs que no pueden mentir",
          blurb:
            "El argumento sobre el que se construye la herramienta y los defectos que le dieron forma.",
        },
      },
    ],
  },
];

/** Every slug the sidebar links to, in reading order. */
export function navSlugs(): string[] {
  return NAV.flatMap((section) => section.entries.map((entry) => entry.slug));
}

/** The entry for a slug, or `null` when the document is not in the sidebar. */
export function navEntry(slug: string): NavEntry | null {
  for (const section of NAV) {
    const found = section.entries.find((entry) => entry.slug === slug);
    if (found) return found;
  }
  return null;
}

/**
 * What comes before and after this page, for the footer links. A page in a
 * group stays inside it: Next on a journey's last phase is nothing, not the
 * other journey's first.
 */
export function neighbours(slug: string): { prev: NavEntry | null; next: NavEntry | null } {
  const all = NAV.flatMap((section) => section.entries);
  const entry = all.find((e) => e.slug === slug);
  if (!entry) return { prev: null, next: null };
  const scope = entry.group ? all.filter((e) => e.group === entry.group) : all;
  const at = scope.indexOf(entry);
  return { prev: scope[at - 1] ?? null, next: scope[at + 1] ?? null };
}

/** The numbered steps of the journey this page belongs to, or [] when it is in none. */
export function journeyOf(slug: string): NavEntry[] {
  const entry = navEntry(slug);
  if (!entry || !entry.group || !entry.step) return [];
  return NAV.flatMap((s) => s.entries).filter((e) => e.group === entry.group && e.step);
}
