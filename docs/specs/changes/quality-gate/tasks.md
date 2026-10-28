# Tasks

Order: the mechanism first (it is useful with any tool), then the measures,
then the presets, then where results are shown. One requirement at a time,
its delta and test first.

## 1. Specification

- [x] 1.1 ADR-0040 (Proposed) and its row in the ADR index
- [x] 1.2 Proposal with the planned requirements REQ-218..REQ-231; range reserved
- [x] 1.3 Design: configuration, stages, baseline, measures, levels, Java and Node presets, code layout
- [x] 1.4 The person approved the scope on 2026-10-28: everything in Docker, no accounts (Snyk and Aikido deferred)
- [ ] 1.5 Delta `specs/quality/spec.md`, requirement by requirement, as each is started
- [ ] 1.6 `specgate change validate quality-gate`

## 2. Mechanism

- [x] 2.1 REQ-218 `checks:` model, validation, `quality list`
- [x] 2.2 REQ-219 stages in `check` and `done`
- [ ] 2.3 REQ-220 `attempt` checks in the harness gate, findings in the next prompt
- [ ] 2.4 REQ-221 `end` checks before merge and at the end of a chain
- [x] 2.5 REQ-222 SARIF reader, fingerprints, baseline, `quality baseline [--accept]`
- [ ] 2.6 REQ-231 the same for `arch_cmd`; ADR-0028 points 3 and 4 marked done

## 3. Measures

- [ ] 3.1 REQ-223 diff coverage: diff hunks, JaCoCo XML, LCOV, Cobertura
- [ ] 3.2 REQ-224 mutation score: PIT `mutations.xml`, Stryker `mutation.json`

## 4. Presets

- [ ] 4.1 REQ-225 levels and presets: Maven, then Gradle, then npm/pnpm; `quality init`, `harness init`, `adopt`
- [~] 4.1b REQ-232 every check in Docker (runner: docker in all presets), images by digest, caches in named volumes, `quality doctor [--pull]`
- [ ] 4.2 REQ-226 SonarQube Community in Docker (optional `end` check); Snyk and Aikido deferred: no account
- [ ] 4.3 REQ-227 review and adversary profiles as `end` checks
- [ ] 4.4 REQ-230 fixture projects and the e2e that runs every preset; every **(verify)** in design.md resolved

## 5. Results

- [ ] 5.1 REQ-228 run record, matrix, `harness report`
- [ ] 5.2 REQ-229 `/live`, studio Calidad card, studio report, quality level in the new-project step

## 6. Documentation (see docs-impact.md)

- [ ] 6.1 New guide `docs/quality.md`
- [ ] 6.2 Every page listed in docs-impact.md updated
- [ ] 6.3 ADR-0040 to Accepted; ADR-0028 status updated
- [ ] 6.4 CHANGELOG entry; release notes
