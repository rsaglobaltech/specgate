# Delta — brief-cards

## ADDED Requirements

### Requirement: REQ-655 — A DDD workshop's boards become the brief's modules

<!-- specgate:trace status=Implemented feature=features/brief-cards/REQ-655.feature actor=Developer kind=functional -->

The system SHALL, on `specgate brief import <file>…` with boards exported by DDD Toolbox — Domain Storytelling, Event Storming, Bounded Context Canvas, its files only and none of its code — write the workshop's domain model as one readable file per bounded context, `docs/brief/models/<context>.yaml`, with its purpose, classification, integrations, terms, rules, flows, stories and questions; and SHALL add to `docs/brief.md` — writing it when there is none — each context as a module in the front matter, the stories' people and systems as actors (a system on `api`, a person on `web`), and a section "From the DDD workshop" naming each context's purpose, open questions and the file of its model — its rules kept in the model, a workshop giving no example for a module card's rules; it SHALL keep every line the brief already had, leave a module already there as it is, set the project's `language` to the workshop's when none is set, and with `--json` answer the contexts, the files written, the language and the flows it placed by assumption.

> Issue #59 of the studio: enterprise teams model the domain in DDD workshops; their boards become the brief instead of being typed again. The license respected: the exported files only.

#### Scenario: SCN-655a — The claims workshop imported into an empty project

- GIVEN a project with no brief, and the motor-claims workshop exported from dddtoolbox.com: its story, its Event Storming and the canvases Siniestros, Pólizas and Pagos
- WHEN the Developer runs `specgate brief import` with the five files
- THEN `docs/brief/models/siniestros.yaml`, `polizas.yaml` and `pagos.yaml` are written, the project's language is set to Spanish, the brief's front matter lists the modules siniestros, polizas and pagos and the actor Tramitador on web and Sistema de pagos on api, and the brief's workshop section names Siniestros with `docs/brief/models/siniestros.yaml`; and `propose --from-brief --check` finds the brief ready

#### Scenario: SCN-655b — An existing brief kept

- GIVEN a project whose brief has the module catalogo and its own text
- WHEN the Developer imports the claims workshop
- THEN the brief still has catalogo and every line it had, and also the three modules of the workshop

### Requirement: REQ-656 — A module from a workshop is drafted from its model

<!-- specgate:trace status=Implemented feature=features/brief-cards/REQ-656.feature actor=Developer kind=functional -->

The system SHALL, when `specgate propose --from-brief <module>` drafts a module that has `docs/brief/models/<module>.yaml`, name that file in the drafting guide as a source beside the brief — its flows, rules, terms and questions to be worded in the brief's language, a flow placed by assumption to be confirmed or questioned — and SHALL say in the guide the language to write in — the project's `language`, its technical words (SHALL, GIVEN/WHEN/THEN, ids) kept in English — and how many flows the model holds against the requirement ids the draft has, the flows left out listed in `discover.md` for a next draft rather than dropped; and SHALL accept, in the draft's check (D6), a value stated in the workshop's models as stated in the brief.

#### Scenario: SCN-656a — The siniestros module drafted

- GIVEN the claims workshop imported
- WHEN the Developer runs `specgate propose --from-brief siniestros`
- THEN the draft's DRAFTING.md names `docs/brief/models/siniestros.yaml` as a source, says to write in Spanish and that the model holds 24 flows for 10 requirement ids, the rest listed in discover.md; and a scenario stating "75 %" passes D6 because the model says it

### Requirement: REQ-657 — From a workshop to a draft in one command

<!-- specgate:trace status=Implemented feature=features/brief-cards/REQ-657.feature actor=Developer kind=functional -->

The system SHALL, on `specgate propose --from-model <file>…`, import the boards as `brief import` does and then draft the first module the import added, as `propose --from-brief <module>` does, saying the other modules to draft next.

#### Scenario: SCN-657a — Imported and drafted

- GIVEN a project with no brief and the claims workshop's five files
- WHEN the Developer runs `specgate propose --from-model` with them
- THEN the models and the brief are written, the draft change of siniestros is opened, and the answer names polizas and pagos as next
