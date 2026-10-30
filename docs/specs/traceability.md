# Traceability Matrix — the Specgate CLI

> Links every CLI requirement to its scenario, feature file, implementation and
> test. All requirement IDs reference [`/spec.md`](../../spec.md).
>
> **This is the rich 10-column format the CLI generates for user projects** —
> the tool has to be able to operate on its own repository, and
> `specgate change archive` rewrites the table below. `tests/unit/docs-truth.test.ts`
> fails the build if any path named here stops existing.
>
> Columns the CLI's own domain does not use (`Use Case`, `Command/Query`,
> `Aggregate`, `Event`) carry `-`. Bounded contexts live in [`/spec.md`](../../spec.md) §7.
>
> **Supporting sections avoid 3-, 4- and 10-column pipe tables.** The matrix
> parser reads any table of that shape as matrix rows and takes its first column
> for Scenario IDs, which trips the duplicate-ID check. §2 is a 5-column table
> and coexists fine; §3 and §4 are lists because they would not.

---

## 1. Requirements

| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |
|---|---|---|---|---|---|---|---|---|---|
| REQ-001 | SCN-001 | `features/cli/init.feature` | - | - | - | - | `scripts/init_project.ts` | `tests/cli.test.ts` | Verified |
| REQ-002 | SCN-002 | `features/cli/validate.feature` | - | - | - | - | `scripts/validate_specs.ts` | `tests/unit/validate-remedies.test.ts` | Verified |
| REQ-003 | SCN-003 | `features/cli/expand.feature` | - | - | - | - | `scripts/expand_domain_pack.ts` | `tests/unit/common.test.ts` | Verified |
| REQ-004 | SCN-004 | `features/pack/expand-parking.feature` | - | - | - | - | `scripts/cli/commands/pack/ExpandDomainPackCommand.ts` | `tests/unit/init-engine-parity.test.ts` | Verified |
| REQ-005 | SCN-005 | - | - | - | - | - | `templates/base/docs/specs/runtime-environments.md.tpl` | `tests/cli.test.ts` | Verified |
| REQ-006 | SCN-006 | - | - | - | - | - | `scripts/init_pack.ts` | `tests/unit/pack-commands.test.ts` | Verified |
| REQ-007 | SCN-007 | - | - | - | - | - | `scripts/lint_pack.ts` | `tests/unit/pack-lint-quality.test.ts` | Verified |
| REQ-008 | SCN-008 | - | - | - | - | - | `actions/spec-driven-action/action.yml` | TBD | Draft |
| REQ-009 | SCN-009 | - | - | - | - | - | `scripts/init_project.ts` | `tests/snapshot/init-determinism.test.ts` | Verified |
| REQ-010 | SCN-010 | - | - | - | - | - | `scripts/change/cli.ts` | `tests/unit/change-cli.test.ts` | Verified |
| REQ-011 | SCN-011 | - | - | - | - | - | `scripts/specops/sync.ts` | `tests/unit/specops-f1b.test.ts` | Verified |
| REQ-012 | SCN-012 | - | - | - | - | - | `scripts/harness/run.ts` | `tests/unit/harness-run.test.ts` | Verified |
| REQ-013 | SCN-013 | - | - | - | - | - | `scripts/adopt_project.ts` | `tests/unit/adopt.test.ts` | Verified |
| REQ-014 | SCN-014 | - | - | - | - | - | `scripts/doctor.ts` | `tests/unit/doctor.test.ts` | Verified |
| REQ-015 | SCN-015 | - | - | - | - | - | `scripts/req.ts` | `tests/unit/req-commands.test.ts` | Verified |
| REQ-100 | SCN-100a | `features/change-lifecycle/REQ-100.feature` | - | - | - | - | - | tests/unit/change-layers.test.ts | Implemented |
| REQ-101 | SCN-101a | - | - | - | - | - | - | TBD | Draft |
| REQ-102 | SCN-102a | - | - | - | - | - | - | TBD | Draft |
| REQ-103 | SCN-103a | - | - | - | - | - | - | TBD | Draft |
| REQ-104 | SCN-104a | - | - | - | - | - | - | TBD | Draft |
| REQ-105 | SCN-105a | - | - | - | - | - | - | TBD | Draft |
| REQ-106 | SCN-106a | - | - | - | - | - | - | TBD | Draft |
| REQ-107 | SCN-107a | `features/daily-surface/REQ-107.feature` | - | - | - | - | - | tests/unit/compact-use.test.ts | Implemented |
| REQ-108 | SCN-108a | `features/daily-surface/REQ-108.feature` | - | - | - | - | - | tests/unit/compact-use.test.ts | Implemented |
| REQ-109 | SCN-109a | `features/daily-surface/REQ-109.feature` | - | - | - | - | - | tests/unit/compact-use.test.ts | Implemented |
| REQ-110 | SCN-110a | `features/daily-surface/REQ-110.feature` | - | - | - | - | - | tests/unit/compact-use.test.ts | Implemented |
| REQ-111 | SCN-111a | `features/daily-surface/REQ-111.feature` | - | - | - | - | - | tests/unit/compact-use.test.ts | Implemented |
| REQ-112 | SCN-112a | `features/daily-surface/REQ-112.feature` | - | - | - | - | - | tests/unit/compact-use.test.ts | Implemented |
| REQ-113 | SCN-113a | `features/daily-surface/REQ-113.feature` | - | - | - | - | - | tests/unit/compact-use.test.ts | Implemented |
| REQ-114 | SCN-114a | `features/daily-surface/REQ-114.feature` | - | - | - | - | - | tests/unit/compact-use.test.ts | Implemented |
| REQ-115 | SCN-115a | `features/daily-surface/REQ-115.feature` | - | - | - | - | - | tests/unit/compact-use.test.ts | Implemented |
| REQ-116 | SCN-116a | `features/daily-surface/REQ-116.feature` | - | - | - | - | - | tests/unit/compact-use.test.ts | Implemented |
| REQ-117 | SCN-117a | `features/trusted-gate/REQ-117.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-118 | SCN-118a | `features/trusted-gate/REQ-118.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-119 | SCN-119a | `features/trusted-gate/REQ-119.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-120 | SCN-120a | `features/trusted-gate/REQ-120.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-121 | SCN-121a | `features/trusted-gate/REQ-121.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-122 | SCN-122a | `features/trusted-gate/REQ-122.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-123 | SCN-123a | `features/trusted-gate/REQ-123.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-124 | SCN-124a | `features/trusted-gate/REQ-124.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-125 | SCN-125a | `features/trusted-gate/REQ-125.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-126 | SCN-126a | `features/trusted-gate/REQ-126.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-127 | SCN-127a | `features/trusted-gate/REQ-127.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-128 | SCN-128a | `features/live-harness/REQ-128.feature` | - | - | - | - | - | tests/unit/live-view.test.ts | Implemented |
| REQ-129 | SCN-129a | `features/live-harness/REQ-129.feature` | - | - | - | - | - | tests/unit/live-view.test.ts | Implemented |
| REQ-130 | SCN-130a | `features/live-harness/REQ-130.feature` | - | - | - | - | - | tests/unit/live-view.test.ts | Implemented |
| REQ-131 | SCN-131a | `features/live-harness/REQ-131.feature` | - | - | - | - | - | tests/unit/live-view.test.ts | Implemented |
| REQ-132 | SCN-132a | `features/live-harness/REQ-132.feature` | - | - | - | - | - | tests/unit/live-view.test.ts | Implemented |
| REQ-133 | SCN-133a | `features/live-harness/REQ-133.feature` | - | - | - | - | - | tests/unit/live-view.test.ts | Implemented |
| REQ-134 | SCN-134a | `features/live-harness/REQ-134.feature` | - | - | - | - | - | tests/unit/live-view.test.ts | Implemented |
| REQ-135 | SCN-135a | `features/brief-cards/REQ-135.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-136 | SCN-136a | `features/brief-cards/REQ-136.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-137 | SCN-137a | `features/brief-cards/REQ-137.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-138 | SCN-138a | `features/brief-cards/REQ-138.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-139 | SCN-139a | `features/brief-cards/REQ-139.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-140 | SCN-140a | `features/brief-cards/REQ-140.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-141 | SCN-141a | `features/brief-cards/REQ-141.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-142 | SCN-142a | `features/brief-cards/REQ-142.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-143 | SCN-143a | `features/ticket-source/REQ-143.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-144 | SCN-144a | `features/ticket-source/REQ-144.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-145 | SCN-145a | `features/ticket-source/REQ-145.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-146 | SCN-146a | `features/ticket-source/REQ-146.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-147 | SCN-147a | `features/ticket-source/REQ-147.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-148 | SCN-148a | `features/ticket-source/REQ-148.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-149 | SCN-149a | `features/ticket-source/REQ-149.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-150 | SCN-150a | `features/ticket-source/REQ-150.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-152 | SCN-152a | `features/trusted-gate/REQ-152.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-153 | SCN-153a | `features/ticket-source/REQ-153.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-154 | SCN-154a | `features/ticket-source/REQ-154.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-155 | SCN-155a | `features/ticket-source/REQ-155.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-156 | SCN-156a | `features/ticket-source/REQ-156.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-157 | SCN-157a | `features/ticket-source/REQ-157.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-158 | SCN-158a | `features/ticket-source/REQ-158.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-159 | SCN-159a | `features/ticket-source/REQ-159.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-160 | SCN-160a | `features/trusted-gate/REQ-160.feature` | - | - | - | - | - | tests/unit/change-overlap.test.ts | Implemented |
| REQ-161 | SCN-161a | `features/ticket-source/REQ-161.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-162 | SCN-162a | `features/ticket-source/REQ-162.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-163 | SCN-163a | `features/trusted-gate/REQ-163.feature` | - | - | - | - | - | tests/unit/change-overlap.test.ts | Implemented |
| REQ-164 | SCN-164a | `features/trusted-gate/REQ-164.feature` | - | - | - | - | - | tests/unit/change-overlap.test.ts | Implemented |
| REQ-165 | SCN-165a | `features/ticket-source/REQ-165.feature` | - | - | - | - | - | tests/unit/change-overlap.test.ts | Implemented |
| REQ-166 | SCN-166a | `features/trusted-gate/REQ-166.feature` | - | - | - | - | - | packages/core/test/unit/capability-spec-merge.test.ts | Implemented |
| REQ-168 | SCN-168a | `features/trusted-gate/REQ-168.feature` | - | - | - | - | - | tests/unit/change-base.test.ts | Implemented |
| REQ-169 | SCN-169a | `features/trusted-gate/REQ-169.feature` | - | - | - | - | - | tests/cli.test.ts | Implemented |
| REQ-173 | SCN-173a | `features/daily-surface/REQ-173.feature` | - | - | - | - | - | tests/unit/approved-needs-test.test.ts | Implemented |
| REQ-175 | SCN-175a | `features/live-harness/REQ-175.feature` | - | - | - | - | - | tests/cli.test.ts | Implemented |
| REQ-176 | SCN-176a | `features/brief-cards/REQ-176.feature` | - | - | - | - | - | tests/unit/draft-checklist.test.ts | Implemented |
| REQ-177 | SCN-177a | `features/change-lifecycle/REQ-177.feature` | - | - | - | - | - | tests/unit/draft-reserve-more.test.ts | Implemented |
| REQ-178 | SCN-178a | `features/daily-surface/REQ-178.feature` | - | - | - | - | - | tests/unit/adopter-papercuts.test.ts | Implemented |
| REQ-179 | SCN-179a | `features/live-harness/REQ-179.feature` | - | - | - | - | - | tests/unit/live-view-polish.test.ts | Implemented |
| REQ-180 | SCN-180a | `features/live-harness/REQ-180.feature` | - | - | - | - | - | tests/unit/live-detail.test.ts | Implemented |
| REQ-181 | SCN-181a | `features/live-harness/REQ-181.feature` | - | - | - | - | - | tests/unit/live-detail.test.ts | Implemented |
| REQ-182 | SCN-182a | `features/live-harness/REQ-182.feature` | - | - | - | - | - | tests/unit/live-agent.test.ts | Implemented |
| REQ-184 | SCN-184a | `features/harness/REQ-184.feature` | - | - | - | - | - | tests/unit/harness-hardening.test.ts | Implemented |
| REQ-185 | SCN-185a | `features/harness/REQ-185.feature` | - | - | - | - | - | tests/unit/harness-hardening.test.ts | Implemented |
| REQ-186 | SCN-186a | `features/harness/REQ-186.feature` | - | - | - | - | - | tests/unit/harness-hardening.test.ts | Implemented |
| REQ-183 | SCN-183a | `features/trusted-gate/REQ-183.feature` | - | - | - | - | - | packages/core/test/unit/done-verification.test.ts | Implemented |
| REQ-190 | SCN-190a | `features/change-lifecycle/REQ-190.feature` | - | - | - | - | - | tests/unit/change-evolution.test.ts | Implemented |
| REQ-191 | SCN-191a | `features/change-lifecycle/REQ-191.feature` | - | - | - | - | - | tests/unit/change-evolution.test.ts | Implemented |
| REQ-192 | SCN-192a | `features/change-lifecycle/REQ-192.feature` | - | - | - | - | - | tests/unit/change-evolution.test.ts | Implemented |
| REQ-187 | SCN-187a | `features/clarification/REQ-187.feature` | - | - | - | - | - | tests/unit/clarification-cli.test.ts | Implemented |
| REQ-188 | SCN-188a | `features/clarification/REQ-188.feature` | - | - | - | - | - | tests/unit/clarification-cli.test.ts | Implemented |
| REQ-189 | SCN-189a | `features/clarification/REQ-189.feature` | - | - | - | - | - | tests/unit/clarification-cli.test.ts | Implemented |
| REQ-202 | SCN-202a | `features/change-lifecycle/REQ-202.feature` | - | - | - | - | - | tests/unit/change-evolution.test.ts | Implemented |
| REQ-193 | SCN-193a | `features/daily-surface/REQ-193.feature` | - | - | - | - | - | tests/unit/forja-front-door.test.ts | Implemented |
| REQ-194 | SCN-194a | `features/daily-surface/REQ-194.feature` | - | - | - | - | - | tests/unit/forja-front-door.test.ts | Implemented |
| REQ-195 | SCN-195a | `features/daily-surface/REQ-195.feature` | - | - | - | - | - | tests/unit/changelog-format.test.ts | Implemented |
| REQ-197 | SCN-197a | `features/daily-surface/REQ-197.feature` | - | - | - | - | - | tests/unit/draft-from-brief.test.ts | Implemented |
| REQ-196 | SCN-196a | `features/harness/REQ-196.feature` | - | - | - | - | - | tests/unit/harness-run.test.ts | Implemented |
| REQ-198 | SCN-198a | `features/harness/REQ-198.feature` | - | - | - | - | - | packages/core/test/unit/rework.test.ts | Implemented |
| REQ-199 | SCN-199a | `features/harness/REQ-199.feature` | - | - | - | - | - | tests/unit/screen-requirements.test.ts | Implemented |
| REQ-200 | SCN-200a | `features/harness/REQ-200.feature` | - | - | - | - | - | tests/unit/harness-init.test.ts | Implemented |
| REQ-201 | SCN-201a | `features/live-harness/REQ-201.feature` | - | - | - | - | - | tests/unit/studio-answer.test.ts | Implemented |
| REQ-203 | SCN-203a | `features/live-harness/REQ-203.feature` | - | - | - | - | - | tests/unit/studio-answer.test.ts | Implemented |
| REQ-204 | SCN-204a | `features/studio/REQ-204.feature` | - | - | - | - | - | tests/unit/studio-app.test.ts | Implemented |
| REQ-205 | SCN-205a | `features/studio/REQ-205.feature` | - | - | - | - | - | tests/unit/studio-app.test.ts | Implemented |
| REQ-206 | SCN-206a | `features/studio/REQ-206.feature` | - | - | - | - | - | tests/unit/studio-app.test.ts | Implemented |
| REQ-207 | SCN-207a | `features/studio/REQ-207.feature` | - | - | - | - | - | tests/unit/studio-app.test.ts | Implemented |
| REQ-208 | SCN-208a | `features/studio/REQ-208.feature` | - | - | - | - | - | tests/unit/studio-app.test.ts | Implemented |
| REQ-209 | SCN-209a | `features/studio/REQ-209.feature` | - | - | - | - | - | tests/unit/harness-run.test.ts | Implemented |
| REQ-210 | SCN-210a | `features/studio/REQ-210.feature` | - | - | - | - | - | tests/unit/studio-app.test.ts | Implemented |
| REQ-211 | SCN-211a | `features/studio/REQ-211.feature` | - | - | - | - | - | tests/unit/studio-route.test.ts | Implemented |
| REQ-212 | SCN-212a | `features/studio/REQ-212.feature` | - | - | - | - | - | tests/unit/studio-route.test.ts | Implemented |
| REQ-213 | SCN-213a | `features/studio/REQ-213.feature` | - | - | - | - | - | tests/unit/studio-route.test.ts | Implemented |
| REQ-214 | SCN-214a | `features/studio/REQ-214.feature` | - | - | - | - | - | tests/unit/studio-route.test.ts | Implemented |
| REQ-215 | SCN-215a | `features/studio/REQ-215.feature` | - | - | - | - | - | tests/unit/studio-route.test.ts | Implemented |
| REQ-216 | SCN-216a | `features/studio/REQ-216.feature` | - | - | - | - | - | tests/unit/studio-route.test.ts | Implemented |
| REQ-217 | SCN-217a | `features/studio/REQ-217.feature` | - | - | - | - | - | tests/unit/studio-route.test.ts | Implemented |
| REQ-233 | SCN-233a | `features/studio/REQ-233.feature` | - | - | - | - | - | tests/unit/studio-commit.test.ts | Implemented |
| REQ-218 | SCN-218a | `features/quality/REQ-218.feature` | - | - | - | - | - | tests/unit/quality-checks.test.ts | Implemented |
| REQ-219 | SCN-219a | `features/quality/REQ-219.feature` | - | - | - | - | - | tests/unit/quality-checks.test.ts | Implemented |
| REQ-232 | SCN-232a | `features/quality/REQ-232.feature` | - | - | - | - | - | tests/unit/quality-checks.test.ts | Implemented |
| REQ-222 | SCN-222a | `features/quality/REQ-222.feature` | - | - | - | - | - | tests/unit/quality-baseline.test.ts | Implemented |
| REQ-223 | SCN-223a | `features/quality/REQ-223.feature` | - | - | - | - | - | tests/unit/quality-measures.test.ts | Implemented |
| REQ-224 | SCN-224a | `features/quality/REQ-224.feature` | - | - | - | - | - | tests/unit/quality-measures.test.ts | Implemented |
| REQ-225 | SCN-225a | `features/quality/REQ-225.feature` | - | - | - | - | - | tests/unit/quality-presets.test.ts | Implemented |
| REQ-230 | SCN-230a | `features/quality/REQ-230.feature` | - | - | - | - | - | tests/unit/quality-presets.test.ts | Implemented |
| REQ-234 | SCN-234a | `features/quality/REQ-234.feature` | - | - | - | - | - | tests/unit/quality-commits.test.ts | Implemented |
| REQ-220 | SCN-220a | `features/quality/REQ-220.feature` | - | - | - | - | - | tests/unit/quality-harness.test.ts | Implemented |
| REQ-221 | SCN-221a | `features/quality/REQ-221.feature` | - | - | - | - | - | tests/unit/quality-harness.test.ts | Implemented |
| REQ-228 | SCN-228a | `features/quality/REQ-228.feature` | - | - | - | - | - | tests/unit/quality-harness.test.ts | Implemented |
| REQ-229 | SCN-229a | `features/quality/REQ-229.feature` | - | - | - | - | - | tests/unit/quality-views.test.ts | Implemented |
| REQ-226 | SCN-226a | `features/quality/REQ-226.feature` | - | - | - | - | - | tests/unit/quality-sonar.test.ts | Implemented |
| REQ-227 | SCN-227a | `features/quality/REQ-227.feature` | - | - | - | - | - | tests/unit/quality-agents.test.ts | Implemented |
| REQ-231 | SCN-231a | `features/quality/REQ-231.feature` | - | - | - | - | - | tests/unit/quality-arch.test.ts | Implemented |
| REQ-236 | SCN-236a | `features/daily-surface/REQ-236.feature` | - | - | - | - | - | tests/unit/forja-front-door.test.ts | Implemented |
| REQ-235 | SCN-235a | `features/quality/REQ-235.feature` | - | - | - | - | - | tests/unit/quality-presets.test.ts | Implemented |
| REQ-237 | SCN-237a | `features/quality/REQ-237.feature` | - | - | - | - | - | tests/unit/quality-presets.test.ts | Implemented |
| REQ-238 | SCN-238a | `features/quality/REQ-238.feature` | - | - | - | - | - | tests/unit/quality-checks.test.ts | Implemented |
| REQ-239 | SCN-239a | `features/quality/REQ-239.feature` | - | - | - | - | - | tests/unit/quality-checks.test.ts | Implemented |
| REQ-240 | SCN-240a | `features/quality/REQ-240.feature` | - | - | - | - | - | tests/unit/quality-baseline.test.ts | Implemented |
| REQ-244 | SCN-244a | `features/brief-cards/REQ-244.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-245 | SCN-245a | `features/brief-cards/REQ-245.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-246 | SCN-246a | `features/brief-cards/REQ-246.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-247 | SCN-247a | `features/brief-cards/REQ-247.feature` | - | - | - | - | - | tests/unit/draft-checklist.test.ts | Implemented |
| REQ-248 | SCN-248a | `features/brief-cards/REQ-248.feature` | - | - | - | - | - | tests/unit/draft-from-brief.test.ts | Implemented |
| REQ-243 | SCN-243a | `features/daily-surface/REQ-243.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-249 | SCN-249a | `features/daily-surface/REQ-249.feature` | - | - | - | - | - | tests/unit/rc2-change.test.ts | Implemented |
| REQ-241 | SCN-241a | `features/quality/REQ-241.feature` | - | - | - | - | - | tests/unit/quality-baseline.test.ts | Implemented |
| REQ-250 | SCN-250a | `features/quality/REQ-250.feature` | - | - | - | - | - | tests/unit/quality-presets.test.ts | Implemented |
| REQ-251 | SCN-251a | `features/brief-cards/REQ-251.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-252 | SCN-252a | `features/brief-cards/REQ-252.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-253 | SCN-253a | `features/brief-cards/REQ-253.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-254 | SCN-254a | `features/quality/REQ-254.feature` | - | - | - | - | - | tests/unit/quality-checks.test.ts | Implemented |
| REQ-257 | SCN-257a | `features/brief-cards/REQ-257.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-255 | SCN-255a | `features/daily-surface/REQ-255.feature` | - | - | - | - | - | tests/unit/shell-command.test.ts | Implemented |
| REQ-256 | SCN-256a | `features/daily-surface/REQ-256.feature` | - | - | - | - | - | tests/unit/pet.test.ts | Implemented |
| REQ-258 | SCN-258a | `features/quality/REQ-258.feature` | - | - | - | - | - | tests/unit/quality-presets.test.ts | Implemented |
| REQ-259 | SCN-259a | `features/brief-cards/REQ-259.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-260 | SCN-260a | `features/brief-cards/REQ-260.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-261 | SCN-261a | `features/brief-cards/REQ-261.feature` | - | - | - | - | - | tests/unit/draft-checklist.test.ts | Implemented |
| REQ-262 | SCN-262a | `features/brief-cards/REQ-262.feature` | - | - | - | - | - | tests/unit/draft-checklist.test.ts | Implemented |
| REQ-263 | SCN-263a | `features/brief-cards/REQ-263.feature` | - | - | - | - | - | tests/unit/done-refuses-undeliverable.test.ts | Implemented |
| REQ-273 | SCN-273a | `features/live-harness/REQ-273.feature` | - | - | - | - | - | tests/unit/live-gate-steps.test.ts | Implemented |
| REQ-274 | SCN-274a | `features/live-harness/REQ-274.feature` | - | - | - | - | - | tests/unit/live-gate-steps.test.ts | Implemented |
| REQ-275 | SCN-275a | `features/studio/REQ-275.feature` | - | - | - | - | - | tests/unit/live-gate-steps.test.ts | Implemented |
| REQ-276 | SCN-276a | `features/quality/REQ-276.feature` | - | - | - | - | - | tests/unit/quality-presets.test.ts | Implemented |
| REQ-265 | SCN-265a | `features/daily-surface/REQ-265.feature` | - | - | - | - | - | tests/unit/shell-command.test.ts | Implemented |
| REQ-264 | SCN-264a | `features/harness/REQ-264.feature` | - | - | - | - | - | tests/unit/harness-run6.test.ts | Implemented |
| REQ-268 | SCN-268a | `features/harness/REQ-268.feature` | - | - | - | - | - | tests/unit/harness-run6.test.ts | Implemented |
| REQ-269 | SCN-269a | `features/harness/REQ-269.feature` | - | - | - | - | - | tests/unit/harness-run6.test.ts | Implemented |
| REQ-271 | SCN-271a | `features/harness/REQ-271.feature` | - | - | - | - | - | tests/unit/harness-run6.test.ts | Implemented |
| REQ-266 | SCN-266a | `features/quality/REQ-266.feature` | - | - | - | - | - | tests/unit/quality-worktree.test.ts | Implemented |
| REQ-267 | SCN-267a | `features/quality/REQ-267.feature` | - | - | - | - | - | tests/unit/quality-worktree.test.ts | Implemented |
| REQ-270 | SCN-270a | `features/studio/REQ-270.feature` | - | - | - | - | - | tests/unit/studio-inflight.test.ts | Implemented |
| REQ-277 | SCN-277a | `features/brief-cards/REQ-277.feature` | - | - | - | - | - | tests/unit/draft-checklist.test.ts | Implemented |
| REQ-278 | SCN-278a | `features/harness/REQ-278.feature` | - | - | - | - | - | tests/unit/agent-stream.test.ts | Implemented |
| REQ-279 | SCN-279a | `features/harness/REQ-279.feature` | - | - | - | - | - | tests/unit/harness-run7.test.ts | Implemented |
| REQ-280 | SCN-280a | `features/studio/REQ-280.feature` | - | - | - | - | - | tests/unit/harness-run7.test.ts | Implemented |
| REQ-281 | SCN-281a | `features/trusted-gate/REQ-281.feature` | - | - | - | - | - | tests/unit/release-workflows.test.ts | Implemented |
| REQ-300 | SCN-300a | `features/harness/REQ-300.feature` | - | - | - | - | - | tests/unit/harness-gaps.test.ts | Implemented |
| REQ-301 | SCN-301a | `features/harness/REQ-301.feature` | - | - | - | - | - | tests/unit/harness-gaps.test.ts | Implemented |
| REQ-302 | SCN-302a | `features/harness/REQ-302.feature` | - | - | - | - | - | tests/unit/harness-gaps.test.ts | Implemented |
| REQ-303 | SCN-303a | `features/harness/REQ-303.feature` | - | - | - | - | - | tests/unit/harness-gaps.test.ts | Implemented |
| REQ-304 | SCN-304a | `features/studio/REQ-304.feature` | - | - | - | - | - | tests/unit/harness-gaps.test.ts | Implemented |
| REQ-305 | SCN-305a | `features/ticket-source/REQ-305.feature` | - | - | - | - | - | tests/unit/alm-phases.test.ts | Implemented |
| REQ-306 | SCN-306a | `features/ticket-source/REQ-306.feature` | - | - | - | - | - | tests/unit/alm-phases.test.ts | Implemented |
| REQ-307 | SCN-307a | `features/ticket-source/REQ-307.feature` | - | - | - | - | - | tests/unit/alm-phases.test.ts | Implemented |
| REQ-308 | SCN-308a | `features/ticket-source/REQ-308.feature` | - | - | - | - | - | tests/unit/alm-conformance.test.ts | Implemented |
| REQ-309 | SCN-309a | `features/ticket-source/REQ-309.feature` | - | - | - | - | - | tests/unit/alm-phases.test.ts | Implemented |
| REQ-290 | SCN-290a | `features/workspace/REQ-290.feature` | - | - | - | - | - | tests/unit/workspace.test.ts | Implemented |
| REQ-291 | SCN-291a | `features/workspace/REQ-291.feature` | - | - | - | - | - | tests/unit/workspace.test.ts | Implemented |
| REQ-292 | SCN-292a | `features/workspace/REQ-292.feature` | - | - | - | - | - | tests/unit/workspace.test.ts | Implemented |
| REQ-293 | SCN-293a | `features/workspace/REQ-293.feature` | - | - | - | - | - | tests/unit/workspace.test.ts | Implemented |
| REQ-294 | SCN-294a | `features/workspace/REQ-294.feature` | - | - | - | - | - | tests/unit/workspace.test.ts | Implemented |
| REQ-295 | SCN-295a | `features/workspace/REQ-295.feature` | - | - | - | - | - | tests/unit/workspace.test.ts | Implemented |
| REQ-296 | SCN-296a | `features/workspace/REQ-296.feature` | - | - | - | - | - | tests/unit/workspace.test.ts | Implemented |
| REQ-297 | SCN-297a | `features/workspace/REQ-297.feature` | - | - | - | - | - | tests/unit/workspace.test.ts | Implemented |
| REQ-298 | SCN-298a | `features/workspace/REQ-298.feature` | - | - | - | - | - | tests/unit/workspace.test.ts | Implemented |
| REQ-282 | SCN-282a | `features/change-lifecycle/REQ-282.feature` | - | - | - | - | - | tests/unit/change-layers.test.ts | Implemented |
| REQ-283 | SCN-283a | `features/change-lifecycle/REQ-283.feature` | - | - | - | - | - | tests/unit/change-layers.test.ts | Implemented |
| REQ-284 | SCN-284a | `features/change-lifecycle/REQ-284.feature` | - | - | - | - | - | tests/unit/change-layers.test.ts | Implemented |
| REQ-285 | SCN-285a | `features/change-lifecycle/REQ-285.feature` | - | - | - | - | - | tests/unit/change-layers.test.ts | Implemented |
| REQ-286 | SCN-286a | `features/change-lifecycle/REQ-286.feature` | - | - | - | - | - | tests/unit/change-layers.test.ts | Implemented |
| REQ-287 | SCN-287a | `features/change-lifecycle/REQ-287.feature` | - | - | - | - | - | tests/unit/change-layers.test.ts | Implemented |
| REQ-288 | SCN-288a | `features/change-lifecycle/REQ-288.feature` | - | - | - | - | - | tests/unit/change-layers.test.ts | Implemented |
| REQ-289 | SCN-289a | `features/change-lifecycle/REQ-289.feature` | - | - | - | - | - | tests/unit/change-layers.test.ts | Implemented |
| REQ-325 | SCN-325a | `features/change-lifecycle/REQ-325.feature` | - | - | - | - | - | tests/unit/migrate.test.ts | Implemented |
| REQ-326 | SCN-326a | `features/change-lifecycle/REQ-326.feature` | - | - | - | - | - | tests/unit/migrate.test.ts | Implemented |
| REQ-327 | SCN-327a | `features/change-lifecycle/REQ-327.feature` | - | - | - | - | - | tests/unit/migrate.test.ts | Implemented |
| REQ-328 | SCN-328a | `features/change-lifecycle/REQ-328.feature` | - | - | - | - | - | tests/unit/migrate.test.ts | Implemented |
| REQ-329 | SCN-329a | `features/change-lifecycle/REQ-329.feature` | - | - | - | - | - | tests/unit/migrate.test.ts | Implemented |
| REQ-320 | SCN-320a | `features/workspace/REQ-320.feature` | - | - | - | - | - | tests/unit/workspace-live.test.ts | Implemented |
| REQ-321 | SCN-321a | `features/workspace/REQ-321.feature` | - | - | - | - | - | tests/unit/workspace-live.test.ts | Implemented |
| REQ-322 | SCN-322a | `features/workspace/REQ-322.feature` | - | - | - | - | - | tests/unit/workspace-live.test.ts | Implemented |
| REQ-323 | SCN-323a | `features/workspace/REQ-323.feature` | - | - | - | - | - | tests/unit/workspace-live.test.ts | Implemented |
| REQ-324 | SCN-324a | `features/workspace/REQ-324.feature` | - | - | - | - | - | tests/unit/workspace-live.test.ts | Implemented |
| REQ-335 | SCN-335a | `features/contracts/REQ-335.feature` | - | - | - | - | - | tests/unit/org-steering.test.ts | Implemented |
| REQ-336 | SCN-336a | `features/contracts/REQ-336.feature` | - | - | - | - | - | tests/unit/org-steering.test.ts | Implemented |
| REQ-337 | SCN-337a | `features/daily-surface/REQ-337.feature` | - | - | - | - | - | tests/unit/org-steering.test.ts | Implemented |
| REQ-338 | SCN-338a | `features/daily-surface/REQ-338.feature` | - | - | - | - | - | tests/unit/org-steering.test.ts | Implemented |
| REQ-330 | SCN-330a | `features/steering/REQ-330.feature` | - | - | - | - | - | tests/unit/org-steering.test.ts | Implemented |
| REQ-331 | SCN-331a | `features/steering/REQ-331.feature` | - | - | - | - | - | tests/unit/org-steering.test.ts | Implemented |
| REQ-332 | SCN-332a | `features/steering/REQ-332.feature` | - | - | - | - | - | tests/unit/org-steering.test.ts | Implemented |
| REQ-333 | SCN-333a | `features/steering/REQ-333.feature` | - | - | - | - | - | tests/unit/org-steering.test.ts | Implemented |
| REQ-334 | SCN-334a | `features/steering/REQ-334.feature` | - | - | - | - | - | tests/unit/org-steering.test.ts | Implemented |
| REQ-310 | SCN-310a | `features/change-lifecycle/REQ-310.feature` | - | - | - | - | - | tests/unit/approvals.test.ts | Implemented |
| REQ-311 | SCN-311a | `features/change-lifecycle/REQ-311.feature` | - | - | - | - | - | tests/unit/approvals.test.ts | Implemented |
| REQ-312 | SCN-312a | `features/change-lifecycle/REQ-312.feature` | - | - | - | - | - | tests/unit/approvals.test.ts | Implemented |
| REQ-313 | SCN-313a | `features/change-lifecycle/REQ-313.feature` | - | - | - | - | - | tests/unit/approvals.test.ts | Implemented |
| REQ-314 | SCN-314a | `features/change-lifecycle/REQ-314.feature` | - | - | - | - | - | tests/unit/approvals.test.ts | Implemented |
| REQ-315 | SCN-315a | `features/change-lifecycle/REQ-315.feature` | - | - | - | - | - | tests/unit/approvals.test.ts | Implemented |
| REQ-319 | SCN-319a | `features/change-lifecycle/REQ-319.feature` | - | - | - | - | - | tests/unit/approvals.test.ts | Implemented |
| REQ-316 | SCN-316a | `features/harness/REQ-316.feature` | - | - | - | - | - | tests/unit/role-packages.test.ts | Implemented |
| REQ-317 | SCN-317a | `features/harness/REQ-317.feature` | - | - | - | - | - | tests/unit/role-packages.test.ts | Implemented |
| REQ-318 | SCN-318a | `features/harness/REQ-318.feature` | - | - | - | - | - | tests/unit/role-packages.test.ts | Implemented |
| REQ-350 | SCN-350a | `features/change-lifecycle/REQ-350.feature` | - | - | - | - | - | tests/unit/rc2-change.test.ts | Implemented |
| REQ-351 | SCN-351a | `features/change-lifecycle/REQ-351.feature` | - | - | - | - | - | tests/unit/rc2-change.test.ts | Implemented |
| REQ-352 | SCN-352a | `features/change-lifecycle/REQ-352.feature` | - | - | - | - | - | tests/unit/rc2-change.test.ts | Implemented |
| REQ-353 | SCN-353a | `features/change-lifecycle/REQ-353.feature` | - | - | - | - | - | tests/unit/rc2-change.test.ts | Implemented |
| REQ-354 | SCN-354a | `features/change-lifecycle/REQ-354.feature` | - | - | - | - | - | tests/unit/rc2-change.test.ts | Implemented |
| REQ-339 | SCN-339a | `features/workspace/REQ-339.feature` | - | - | - | - | - | tests/unit/workspace-rc2.test.ts | Implemented |
| REQ-340 | SCN-340a | `features/workspace/REQ-340.feature` | - | - | - | - | - | tests/unit/workspace-rc2.test.ts | Implemented |
| REQ-341 | SCN-341a | `features/workspace/REQ-341.feature` | - | - | - | - | - | tests/unit/workspace-rc2.test.ts | Implemented |
| REQ-342 | SCN-342a | `features/workspace/REQ-342.feature` | - | - | - | - | - | tests/unit/workspace-rc2.test.ts | Implemented |
| REQ-343 | SCN-343a | `features/workspace/REQ-343.feature` | - | - | - | - | - | tests/unit/workspace-rc2.test.ts | Implemented |
| REQ-344 | SCN-344a | `features/workspace/REQ-344.feature` | - | - | - | - | - | tests/unit/workspace-rc2.test.ts | Implemented |
| REQ-345 | SCN-345a | `features/workspace/REQ-345.feature` | - | - | - | - | - | tests/unit/workspace-rc2.test.ts | Implemented |
| REQ-346 | SCN-346a | `features/workspace/REQ-346.feature` | - | - | - | - | - | tests/unit/workspace-rc2.test.ts | Implemented |
| REQ-347 | SCN-347a | `features/workspace/REQ-347.feature` | - | - | - | - | - | tests/unit/workspace-rc2.test.ts | Implemented |
| REQ-348 | SCN-348a | `features/workspace/REQ-348.feature` | - | - | - | - | - | tests/unit/workspace-rc2.test.ts | Implemented |
| REQ-349 | SCN-349a | `features/workspace/REQ-349.feature` | - | - | - | - | - | tests/unit/workspace-rc2.test.ts | Implemented |
| REQ-370 | SCN-370a | `features/change-lifecycle/REQ-370.feature` | - | - | - | - | - | tests/unit/rc3-approvals.test.ts | Implemented |
| REQ-371 | SCN-371a | `features/change-lifecycle/REQ-371.feature` | - | - | - | - | - | tests/unit/rc3-approvals.test.ts | Implemented |
| REQ-372 | SCN-372a | `features/harness/REQ-372.feature` | - | - | - | - | - | tests/unit/rc3-approvals.test.ts | Implemented |
| REQ-360 | SCN-360a | `features/workspace/REQ-360.feature` | - | - | - | - | - | tests/unit/workspace-rc3.test.ts | Implemented |
| REQ-361 | SCN-361a | `features/workspace/REQ-361.feature` | - | - | - | - | - | tests/unit/workspace-rc3.test.ts | Implemented |
| REQ-362 | SCN-362a | `features/workspace/REQ-362.feature` | - | - | - | - | - | tests/unit/workspace-rc3.test.ts | Implemented |
| REQ-363 | SCN-363a | `features/workspace/REQ-363.feature` | - | - | - | - | - | tests/unit/workspace-rc3.test.ts | Implemented |
| REQ-364 | SCN-364a | `features/workspace/REQ-364.feature` | - | - | - | - | - | tests/unit/workspace-rc3.test.ts | Implemented |
| REQ-365 | SCN-365a | `features/workspace/REQ-365.feature` | - | - | - | - | - | tests/unit/workspace-rc3.test.ts | Implemented |
| REQ-366 | SCN-366a | `features/workspace/REQ-366.feature` | - | - | - | - | - | tests/unit/workspace-rc3.test.ts | Implemented |
| REQ-367 | SCN-367a | `features/workspace/REQ-367.feature` | - | - | - | - | - | tests/unit/workspace-rc3.test.ts | Implemented |
| REQ-380 | SCN-380a | `features/change-lifecycle/REQ-380.feature` | - | - | - | - | - | tests/unit/rc4-deps.test.ts | Implemented |
| REQ-381 | SCN-381a | `features/change-lifecycle/REQ-381.feature` | - | - | - | - | - | tests/unit/rc4-deps.test.ts | Implemented |
| REQ-382 | SCN-382a | `features/workspace/REQ-382.feature` | - | - | - | - | - | tests/unit/rc4-deps.test.ts | Implemented |
| REQ-375 | SCN-375a | `features/harness/REQ-375.feature` | - | - | - | - | - | tests/unit/rc4-ticks.test.ts | Implemented |
| REQ-376 | SCN-376a | `features/workspace/REQ-376.feature` | - | - | - | - | - | tests/unit/rc4-ticks.test.ts | Implemented |
| REQ-385 | SCN-385a | `features/contracts/REQ-385.feature` | - | - | - | - | - | tests/unit/org-steering.test.ts | Implemented |
| REQ-386 | SCN-386a | `features/workspace/REQ-386.feature` | - | - | - | - | - | tests/unit/rc4-deps.test.ts | Implemented |
| REQ-390 | SCN-390a | `features/change-lifecycle/REQ-390.feature` | - | - | - | - | - | tests/unit/rc6-deps.test.ts | Implemented |
| REQ-391 | SCN-391a | `features/change-lifecycle/REQ-391.feature` | - | - | - | - | - | tests/unit/rc6-deps.test.ts | Implemented |
| REQ-395 | SCN-395a | `features/workspace/REQ-395.feature` | - | - | - | - | - | tests/unit/rc7-order.test.ts | Implemented |
| REQ-396 | SCN-396a | `features/workspace/REQ-396.feature` | - | - | - | - | - | tests/unit/rc7-order.test.ts | Implemented |
| REQ-400 | SCN-400a | `features/docs-site/REQ-400.feature` | - | - | - | - | - | tests/unit/rc8-site.test.ts | Implemented |
| REQ-401 | SCN-401a | `features/docs-site/REQ-401.feature` | - | - | - | - | - | tests/unit/rc8-site.test.ts | Implemented |
| REQ-402 | SCN-402a | `features/docs-site/REQ-402.feature` | - | - | - | - | - | tests/unit/rc8-site.test.ts | Implemented |
| REQ-405 | SCN-405a | `features/contracts/REQ-405.feature` | - | - | - | - | - | tests/unit/rc9-contract.test.ts | Implemented |
| REQ-406 | SCN-406a | `features/contracts/REQ-406.feature` | - | - | - | - | - | tests/unit/rc9-contract.test.ts | Implemented |
| REQ-407 | SCN-407a | `features/contracts/REQ-407.feature` | - | - | - | - | - | tests/unit/rc9-contract.test.ts | Implemented |
| REQ-408 | SCN-408a | `features/contracts/REQ-408.feature` | - | - | - | - | - | tests/unit/rc9-contract.test.ts | Implemented |

**REQ-008 is the one row that is honest about being unfinished.** The composite
action in `actions/spec-driven-action/` is exercised by nothing — a broken step
would ship unnoticed. It stays `Draft` with a `TBD` test until C6-08 covers it,
which is exactly what `--strict-tdd` is designed to tolerate: an acknowledged
gap, not a hidden one.

---

## 2. Non-functional requirements

| NFR | Requirement | Quality attribute | Measured by | Status |
|---|---|---|---|---|
| NFR-001 | `init` to green `validate` ≤ 60 s on clean env | Performance | Not measured automatically; `npm run smoke:init` is manual and not run by CI | Draft |
| NFR-002 | Unit coverage ≥ 80 % lines / ≥ 70 % branches | Reliability | `c8 --check-coverage` in CI. **Today: 74.8 % lines · 71.1 % branches · 80.4 % functions**, gated at 74/70/80. Branches and functions meet the target; lines does not | In Dev |
| NFR-003 | Zero ESLint errors and zero Prettier diffs on `main` | Maintainability | CI `lint` job: `npm run typecheck && npm run lint && npm run format:check` | Verified |
| NFR-004 | CLI emits structured JSON for agents via `--json` | Usability | `change --json` and `plan --format json` only. Whole-surface coverage is C3-02 | In Dev |
| NFR-005 | Every shipped `pack.yaml` passes schema and lint checks in CI | Reliability | `npm run registry:build` lints every pack in `packs/` and exits 1 on failure | Verified |

> **NFR-003 changed meaning.** It used to promise "zero ShellCheck warnings".
> ADR-0008 removed every shell script from the CLI, so there is nothing for
> ShellCheck to lint but the demo recording scripts. Adding that step is C6-05.

---

## 3. Test inventory

- **`tests/cli.test.ts`** — E2E / integration, `node:test`. Covers REQ-001,
  REQ-005 and REQ-012: dispatch, dry-run, the runtime contract, harness CI mode.
- **`tests/unit/`** — unit, `node:test` via `scripts/run-tests.cjs`. Covers
  REQ-002, REQ-003, REQ-006, REQ-007 and REQ-010 through REQ-015.
- **`tests/snapshot/init-determinism.test.ts`** — snapshot, `node:test`. Covers REQ-009.
- **`features/cli/` and `features/pack/`** — BDD, 22 Cucumber scenarios. Covers REQ-001 to REQ-004.
- **`packages/*/test/unit/`** — unit, `node:test`. VS Code extension, MCP server,
  pack registry and LSP server.
- **`tests/unit/docs-truth.test.ts`** — guard. Every path named in this file must exist.

---

## 4. Coverage gaps (open work)

- **P0 — REQ-008 has no test at all.** The composite action in
  `actions/spec-driven-action/` is exercised by nothing. _(C6-08)_
- **P0 — `--json` covers 2 commands of ~20.** _(C3-02)_
- **P1 — NFR-002 target not met.** Lines at 74.8 % against a target of 80 %. The
  gate is real, but ratcheted at 74. _(C6-01)_
- **P2 — NFR-001 is unmeasured.** No automated timing of `init` → green
  `validate`. _(C6-08)_
- **P2 — ShellCheck is not in CI**, though `CONTRIBUTING.md` used to claim it
  was. _(C6-05)_
