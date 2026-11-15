/**
 * What the checks say, in the viewer's language (REQ-434). The server writes
 * its findings in English with their code; each code's sentence is matched
 * and said again in Spanish with the same ids and names. A sentence that does
 * not match is shown as written — never guessed.
 */
import type { Lang } from "./i18n";

type Rule = [code: string, english: RegExp, spanish: string];

const ES: Rule[] = [
  ["approve_question_open", /^(Q\d+) is open: (.*)$/s, "$1 sin responder: $2"],
  [
    "apply_no_test",
    /^(REQ-\d+) has no test that names it yet \(TDD-1\)\.$/,
    "$1 todavía no tiene una prueba que lo nombre (TDD-1).",
  ],
  [
    "ticket_no_capability",
    /^No capability for ([A-Z][A-Z0-9_]*-\d+): it has no epic\.$/,
    "Sin capacidad para $1: no tiene épica.",
  ],
  [
    "ticket_no_capability",
    /^No capability for ([A-Z][A-Z0-9_]*-\d+): its epic (\S+) is not mapped\.$/,
    "Sin capacidad para $1: su épica $2 no está asignada a ninguna.",
  ],
  ["done_validate_failed", /^validation failed$/, "la validación de la spec falló"],
  ["done_arch_failed", /^the architecture check failed$/, "la comprobación de arquitectura falló"],
  ["done_tests_failed", /^the project's tests failed$/, "las pruebas del proyecto fallaron"],
  [
    "change_invalid",
    /^(REQ-\d+)'s change '(.+)' does not validate\.$/,
    "El cambio «$2» de $1 no valida.",
  ],
  [
    "D1_no_scenario",
    /^(\S+) has no scenario: nothing would verify it\.$/,
    "$1 no tiene escenario: nada lo comprobaría.",
  ],
  [
    "D2_no_kind",
    /^(\S+) has no kind \(functional, non-functional or business-rule\)\.$/,
    "$1 no dice de qué tipo es (funcional, no funcional o regla de negocio).",
  ],
  [
    "D3_surface_missing",
    /^(\S+) is driven by (.+), who uses (.+), and no scenario exercises it\.$/,
    "$1 lo usa $2 desde $3, y ningún escenario lo prueba ahí.",
  ],
  [
    "D4_unmeasured_nfr",
    /^(\S+) promises a quantity \(speed, load, availability\) and states no number with a unit\.$/,
    "$1 promete una cantidad (velocidad, carga, disponibilidad) sin un número con su unidad.",
  ],
  [
    "D5_unsourced_rule",
    /^(\S+) cites a law, standard or contract and names no source\.$/,
    "$1 cita una ley, norma o contrato sin decir cuál.",
  ],
  [
    "D6_unlisted_value",
    /^(\S+) states "(.*)", which is not in the brief and not listed as an assumption for (\S+) or (\S+)\.$/s,
    "$1 dice «$2», que no está en el brief ni anotado como supuesto de $3 o $4.",
  ],
  [
    "D7_answered_still_blocked",
    /^Question (Q\d+) is answered, and (\S+) is still Needs Clarification\.$/,
    "$1 está respondida y $2 sigue en «Needs Clarification»: confirma que la spec ya lo dice.",
  ],
  [
    "D7_question_blocks_nothing",
    /^Question (Q\d+) blocks no requirement: nothing in this draft waits for its answer\.$/,
    "$1 no bloquea ningún requisito: nada en este borrador espera su respuesta.",
  ],
  [
    "D7_floating_question",
    /^Question (Q\d+) blocks no requirement\.$/,
    "$1 no bloquea ningún requisito.",
  ],
  [
    "D7_floating_question",
    /^Question (Q\d+) blocks (\S+); its answer puts the decision off, so it is still open, and \2 is not Needs Clarification\.$/,
    "$1 bloquea $2; su respuesta aplaza la decisión, así que sigue abierta, y $2 no está en «Needs Clarification».",
  ],
  [
    "D13_assumption_to_review",
    /^Assumption (A\d+) comes from an answer to (Q\d+) the specification may not reflect yet\.$/,
    "El supuesto $1 sale de la respuesta a $2: puede que la spec aún no lo diga.",
  ],
  [
    "D13_assumption_to_review",
    /^Assumption (A\d+) comes from an answer the specification may not reflect yet\.$/,
    "El supuesto $1 sale de una respuesta: puede que la spec aún no lo diga.",
  ],
  ["D10_id_in_use", /^(\S+) already exists in this project\.$/, "$1 ya existe en este proyecto."],
  ["D10_id_in_use", /^(\S+) is already a scenario of (\S+)\.$/, "$1 ya es un escenario de $2."],
  [
    "D8_too_large",
    /^The draft holds (\d+) requirements; the review limit is (\d+)\.$/,
    "El borrador tiene $1 requisitos; el límite para revisarlo es $2.",
  ],
  [
    "B2_empty_brief",
    /^The brief below the front matter says nothing yet\.$/,
    "El brief, debajo de la cabecera, todavía no dice nada.",
  ],
  [
    "B3_no_sections",
    /^The brief has no `## Module:` sections: each draft reads the whole brief\.$/,
    "El brief no tiene secciones `## Module:`: cada borrador lee el brief entero.",
  ],
  ["B3_no_section", /^The module (.+) has no section\.$/, "El módulo $1 no tiene sección."],
  ["B2_empty_module", /^The (.+) section is still empty\.$/, "La sección $1 sigue vacía."],
  ["B4_no_rule", /^The (.+) section has no rule\.$/, "La sección $1 no tiene ninguna regla."],
  [
    "B4_no_example",
    /^The (.+) section has rules and no example\.$/,
    "La sección $1 tiene reglas y ningún ejemplo.",
  ],
  [
    "B8_too_big",
    /^The (.+) section has (\d+) rules and (\d+) questions\.$/,
    "La sección $1 tiene $2 reglas y $3 dudas.",
  ],
  [
    "B5_vague",
    /^"(.*)" says "(.*)", which no test can check\.$/s,
    "«$1» dice «$2», y ninguna prueba puede comprobarlo.",
  ],
  [
    "B6_unmeasured",
    /^"(.*)" promises a quantity and states no number\.$/s,
    "«$1» promete una cantidad sin dar un número.",
  ],
  [
    "B7_technical",
    /^"(.*)" names (.+): how, not what\.$/s,
    "«$1» nombra $2: es el cómo, no el qué.",
  ],
  [
    "B11_condition_last",
    /^"(.*)" puts its condition after what must happen\.$/s,
    "«$1» pone la condición después de lo que debe pasar.",
  ],
  [
    "B10_non_goal",
    /^"(.*)" names (.+), which non_goals rules out\.$/s,
    "«$1» nombra $2, que non_goals deja fuera.",
  ],
  [
    "B9_actor_unnamed",
    /^The actor (.+) is declared and the brief never mentions them\.$/,
    "El usuario $1 está declarado y el brief nunca lo menciona.",
  ],
  [
    "B12_too_many_modules",
    /^The brief lists (\d+) modules; a delivery is three to (\d+)\.$/,
    "El brief lista $1 módulos; una entrega son de tres a $2.",
  ],
  [
    "B13_surface_missing",
    /^(.+) uses mobile, and the project has no mobile app\.$/,
    "$1 usa el móvil y el proyecto no tiene app móvil.",
  ],
];

/** A finding's message in the viewer's language, or as written when it is not known. */
export function sayFinding(lang: Lang, code: string, message: string): string {
  if (lang !== "es") return message;
  for (const [c, english, spanish] of ES) {
    if (c !== code) continue;
    if (english.test(message)) return message.replace(english, spanish);
  }
  return message;
}
