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
| REQ-170 | SCN-170a | `features/ticket-source/REQ-170.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-171 | SCN-171a | `features/ticket-source/REQ-171.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-172 | SCN-172a | `features/trusted-gate/REQ-172.feature` | - | - | - | - | - | tests/cli.test.ts | Implemented |
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
| REQ-204 | SCN-204a | `features/studio/REQ-204.feature` | - | - | - | - | - | tests/unit/studio-app.test.ts, tests/unit/studio-redesign.test.ts | Implemented |
| REQ-205 | SCN-205a | `features/studio/REQ-205.feature` | - | - | - | - | - | tests/unit/studio-app.test.ts | Implemented |
| REQ-206 | SCN-206a | `features/studio/REQ-206.feature` | - | - | - | - | - | tests/unit/studio-app.test.ts, tests/unit/studio-unblock.test.ts | Implemented |
| REQ-207 | SCN-207a | `features/studio/REQ-207.feature` | - | - | - | - | - | tests/unit/studio-app.test.ts | Implemented |
| REQ-208 | SCN-208a | `features/studio/REQ-208.feature` | - | - | - | - | - | tests/unit/studio-app.test.ts, tests/unit/studio-unblock.test.ts | Implemented |
| REQ-209 | SCN-209a | `features/studio/REQ-209.feature` | - | - | - | - | - | tests/unit/harness-run.test.ts | Implemented |
| REQ-210 | SCN-210a | `features/studio/REQ-210.feature` | - | - | - | - | - | tests/unit/studio-app.test.ts, tests/unit/studio-unblock.test.ts | Implemented |
| REQ-211 | SCN-211a | `features/studio/REQ-211.feature` | - | - | - | - | - | tests/unit/studio-route.test.ts | Implemented |
| REQ-212 | SCN-212a | `features/studio/REQ-212.feature` | - | - | - | - | - | tests/unit/studio-route.test.ts, tests/unit/studio-redesign.test.ts | Implemented |
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
| REQ-410 | SCN-410a | `features/workspace/REQ-410.feature` | - | - | - | - | - | tests/unit/rc9-live.test.ts | Implemented |
| REQ-411 | SCN-411a | `features/workspace/REQ-411.feature` | - | - | - | - | - | tests/unit/rc9-live.test.ts | Implemented |
| REQ-412 | SCN-412a | `features/workspace/REQ-412.feature` | - | - | - | - | - | tests/unit/rc9-live.test.ts | Implemented |
| REQ-416 | SCN-416a | `features/change-lifecycle/REQ-416.feature` | - | - | - | - | - | tests/unit/rc10-contract.test.ts | Implemented |
| REQ-415 | SCN-415a | `features/contracts/REQ-415.feature` | - | - | - | - | - | tests/unit/rc10-contract.test.ts | Implemented |
| REQ-418 | SCN-418a | `features/contracts/REQ-418.feature` | - | - | - | - | - | tests/unit/rc10-contract.test.ts | Implemented |
| REQ-417 | SCN-417a | `features/harness/REQ-417.feature` | - | - | - | - | - | tests/unit/harness-run.test.ts | Implemented |
| REQ-419 | SCN-419a | `features/contracts/REQ-419.feature` | - | - | - | - | - | tests/unit/rc9-contract.test.ts | Implemented |
| REQ-420 | SCN-420a | `features/agent-integration/REQ-420.feature` | - | - | - | - | - | tests/unit/agent-guards.test.ts | Implemented |
| REQ-421 | SCN-421a | `features/agent-integration/REQ-421.feature` | - | - | - | - | - | tests/unit/agent-guards.test.ts | Implemented |
| REQ-422 | SCN-422a | `features/agent-integration/REQ-422.feature` | - | - | - | - | - | tests/unit/agent-guards.test.ts | Implemented |
| REQ-423 | SCN-423a | `features/agent-integration/REQ-423.feature` | - | - | - | - | - | tests/unit/agent-guards.test.ts | Implemented |
| REQ-424 | SCN-424a | `features/agent-integration/REQ-424.feature` | - | - | - | - | - | tests/unit/agent-guards.test.ts | Implemented |
| REQ-425 | SCN-425a | `features/agent-integration/REQ-425.feature` | - | - | - | - | - | tests/unit/agent-guards.test.ts | Implemented |
| REQ-426 | SCN-426a | `features/agent-integration/REQ-426.feature` | - | - | - | - | - | tests/unit/guard-next-requirement.test.ts | Implemented |
| REQ-427 | SCN-427a | `features/agent-integration/REQ-427.feature` | - | - | - | - | - | tests/unit/guard-next-requirement.test.ts | Implemented |
| REQ-429 | SCN-429a | `features/studio/REQ-429.feature` | - | - | - | - | - | tests/unit/studio-unblock.test.ts | Implemented |
| REQ-430 | SCN-430a | `features/studio/REQ-430.feature` | - | - | - | - | - | tests/unit/studio-unblock.test.ts | Implemented |
| REQ-431 | SCN-431a | `features/studio/REQ-431.feature` | - | - | - | - | - | tests/unit/studio-unblock.test.ts | Implemented |
| REQ-432 | SCN-432a | `features/studio/REQ-432.feature` | - | - | - | - | - | tests/unit/studio-redesign.test.ts | Implemented |
| REQ-433 | SCN-433a | `features/studio/REQ-433.feature` | - | - | - | - | - | tests/unit/studio-redesign.test.ts | Implemented |
| REQ-434 | SCN-434a | `features/studio/REQ-434.feature` | - | - | - | - | - | tests/unit/studio-redesign.test.ts | Implemented |
| REQ-435 | SCN-435a | `features/studio/REQ-435.feature` | - | - | - | - | - | tests/unit/studio-redesign.test.ts | Implemented |
| REQ-436 | SCN-436a | `features/studio/REQ-436.feature` | - | - | - | - | - | tests/unit/studio-redesign.test.ts, e2e/studio/studio.spec.mjs | Implemented |
| REQ-437 | SCN-437a | `features/studio/REQ-437.feature` | - | - | - | - | - | tests/unit/brief-plain-sections.test.ts | Implemented |
| REQ-438 | SCN-438a | `features/studio/REQ-438.feature` | - | - | - | - | - | tests/unit/studio-cli-parity.test.ts | Implemented |
| REQ-439 | SCN-439a | `features/studio/REQ-439.feature` | - | - | - | - | - | tests/unit/studio-cli-parity.test.ts | Implemented |
| REQ-440 | SCN-440a | `features/studio/REQ-440.feature` | - | - | - | - | - | tests/unit/studio-cli-parity.test.ts | Implemented |
| REQ-441 | SCN-441a | `features/studio/REQ-441.feature` | - | - | - | - | - | tests/unit/studio-cli-parity.test.ts | Implemented |
| REQ-442 | SCN-442a | `features/studio/REQ-442.feature` | - | - | - | - | - | tests/unit/studio-cli-parity.test.ts | Implemented |
| REQ-443 | SCN-443a | `features/studio/REQ-443.feature` | - | - | - | - | - | tests/unit/studio-cli-parity.test.ts | Implemented |
| REQ-444 | SCN-444a | `features/studio/REQ-444.feature` | - | - | - | - | - | tests/unit/studio-cli-parity.test.ts | Implemented |
| REQ-445 | SCN-445a | `features/studio/REQ-445.feature` | - | - | - | - | - | tests/unit/studio-port.test.ts | Implemented |
| REQ-446 | SCN-446a | `features/studio/REQ-446.feature` | - | - | - | - | - | tests/unit/studio-ticket.test.ts | Implemented |
| REQ-447 | SCN-447a | `features/studio/REQ-447.feature` | - | - | - | - | - | tests/unit/studio-ticket.test.ts | Implemented |
| REQ-448 | SCN-448a | `features/studio/REQ-448.feature` | - | - | - | - | - | tests/unit/studio-ticket.test.ts | Implemented |
| REQ-455 | SCN-455a | `features/project-setup/REQ-455.feature` | - | - | - | - | - | tests/unit/init-ready-for-ci.test.ts | Implemented |
| REQ-456 | SCN-456a | `features/project-setup/REQ-456.feature` | - | - | - | - | - | tests/unit/init-ready-for-ci.test.ts | Implemented |
| REQ-457 | SCN-457a | `features/project-setup/REQ-457.feature` | - | - | - | - | - | tests/unit/init-ready-for-ci.test.ts | Implemented |
| REQ-458 | SCN-458a | `features/project-setup/REQ-458.feature` | - | - | - | - | - | tests/unit/init-ready-for-ci.test.ts | Implemented |
| REQ-459 | SCN-459a | `features/project-setup/REQ-459.feature` | - | - | - | - | - | tests/unit/init-ready-for-ci.test.ts | Implemented |
| REQ-460 | SCN-460a | `features/project-setup/REQ-460.feature` | - | - | - | - | - | tests/unit/init-ready-for-ci.test.ts | Implemented |
| REQ-461 | SCN-461a | `features/project-setup/REQ-461.feature` | - | - | - | - | - | tests/unit/init-ready-for-ci.test.ts | Implemented |
| REQ-462 | SCN-462a | `features/project-setup/REQ-462.feature` | - | - | - | - | - | tests/unit/init-ready-for-ci.test.ts | Implemented |
| REQ-463 | SCN-463a | `features/project-setup/REQ-463.feature` | - | - | - | - | - | tests/unit/init-ready-for-ci.test.ts | Implemented |
| REQ-464 | SCN-464a | `features/project-setup/REQ-464.feature` | - | - | - | - | - | tests/unit/init-ready-for-ci.test.ts | Implemented |
| REQ-465 | SCN-465a, SCN-465b | `features/daily-surface/REQ-465.feature` | - | - | - | - | - | tests/unit/apply-next-in-change.test.ts | Approved |
| REQ-466 | SCN-466a | `features/api/REQ-466.feature` | - | - | - | - | - | tests/unit/specgate-api.test.ts | Approved |
| REQ-467 | SCN-467a | `features/api/REQ-467.feature` | - | - | - | - | - | tests/unit/specgate-api.test.ts | Approved |
| REQ-468 | SCN-468a | `features/api/REQ-468.feature` | - | - | - | - | - | tests/unit/specgate-api.test.ts | Approved |
| REQ-469 | SCN-469a | `features/api/REQ-469.feature` | - | - | - | - | - | tests/unit/specgate-api.test.ts | Approved |
| REQ-470 | SCN-470a | `features/project-setup/REQ-470.feature` | - | - | - | - | - | tests/unit/onboarding-fixes.test.ts | Approved |
| REQ-471 | SCN-471a | `features/project-setup/REQ-471.feature` | - | - | - | - | - | tests/unit/onboarding-fixes.test.ts | Approved |
| REQ-472 | SCN-472a | `features/project-setup/REQ-472.feature` | - | - | - | - | - | tests/unit/onboarding-fixes.test.ts | Approved |
| REQ-473 | SCN-473a | `features/project-setup/REQ-473.feature` | - | - | - | - | - | tests/unit/onboarding-fixes.test.ts | Approved |
| REQ-474 | SCN-474a | `features/studio/REQ-474.feature` | - | - | - | - | - | tests/unit/onboarding-fixes.test.ts | Approved |
| REQ-475 | SCN-475a | `features/project-setup/REQ-475.feature` | - | - | - | - | - | tests/unit/onboarding-docs.test.ts | Approved |
| REQ-476 | SCN-476a, SCN-476b | `features/project-setup/REQ-476.feature` | - | - | - | - | - | tests/unit/technical-folders.test.ts | Approved |
| REQ-477 | SCN-477a | `features/project-setup/REQ-477.feature` | - | - | - | - | - | tests/unit/technical-folders.test.ts | Approved |
| REQ-478 | SCN-478a | `features/project-setup/REQ-478.feature` | - | - | - | - | - | tests/unit/technical-folders.test.ts | Approved |
| REQ-479 | SCN-479a | `features/clarification/REQ-479.feature` | - | - | - | - | - | tests/unit/questions-options.test.ts | Approved |
| REQ-480 | SCN-480a | `features/clarification/REQ-480.feature` | - | - | - | - | - | tests/unit/questions-options.test.ts | Approved |
| REQ-481 | SCN-481a | `features/clarification/REQ-481.feature` | - | - | - | - | - | tests/unit/questions-asked.test.ts | Approved |
| REQ-482 | SCN-482a | `features/clarification/REQ-482.feature` | - | - | - | - | - | tests/unit/questions-asked.test.ts | Approved |
| REQ-483 | SCN-483a | `features/trusted-gate/REQ-483.feature` | - | - | - | - | - | tests/unit/scenario-heading-ids.test.ts | Approved |
| REQ-484 | SCN-484a | `features/change-lifecycle/REQ-484.feature` | - | - | - | - | - | tests/unit/studio-review-notes.test.ts | Approved |
| REQ-485 | SCN-485a | `features/change-lifecycle/REQ-485.feature` | - | - | - | - | - | tests/unit/studio-review-notes.test.ts | Approved |
| REQ-486 | SCN-486a | `features/brief-cards/REQ-486.feature` | - | - | - | - | - | tests/unit/brief-form.test.ts | Approved |
| REQ-487 | SCN-487a | `features/brief-cards/REQ-487.feature` | - | - | - | - | - | tests/unit/brief-form.test.ts | Approved |
| REQ-488 | SCN-488a | `features/brief-cards/REQ-488.feature` | - | - | - | - | - | tests/unit/brief-form.test.ts | Approved |
| REQ-489 | SCN-489a | `features/project-setup/REQ-489.feature` | - | - | - | - | - | tests/unit/adopt-dry-run.test.ts | Approved |
| REQ-490 | SCN-490a, SCN-490b | `features/harness/REQ-490.feature` | - | - | - | - | - | tests/unit/harness-control.test.ts | Approved |
| REQ-491 | SCN-491a, SCN-491b | `features/harness/REQ-491.feature` | - | - | - | - | - | tests/unit/harness-control.test.ts | Approved |
| REQ-492 | SCN-492a | `features/harness/REQ-492.feature` | - | - | - | - | - | tests/unit/harness-control.test.ts | Approved |
| REQ-493 | SCN-493a | `features/harness/REQ-493.feature` | - | - | - | - | - | tests/unit/harness-control.test.ts | Approved |
| REQ-494 | SCN-494a | `features/harness/REQ-494.feature` | - | - | - | - | - | tests/unit/harness-control.test.ts | Approved |
| REQ-495 | SCN-495a | `features/harness/REQ-495.feature` | - | - | - | - | - | tests/unit/harness-control.test.ts | Approved |
| REQ-496 | SCN-496a | `features/harness/REQ-496.feature` | - | - | - | - | - | tests/unit/harness-control.test.ts | Approved |
| REQ-497 | SCN-497a | `features/harness/REQ-497.feature` | - | - | - | - | - | tests/unit/harness-control.test.ts | Approved |
| REQ-498 | SCN-498a, SCN-498b | `features/daily-surface/REQ-498.feature` | - | - | - | - | - | tests/unit/matrix-scenarios.test.ts | Approved |
| REQ-499 | SCN-499a | `features/quality/REQ-499.feature` | - | - | - | - | - | tests/unit/line-coverage.test.ts | Approved |
| REQ-500 | SCN-500a | `features/daily-surface/REQ-500.feature` | - | - | - | - | - | tests/unit/capability-filter.test.ts | Approved |
| REQ-501 | SCN-501a | `features/quality/REQ-501.feature` | - | - | - | - | - | tests/unit/capability-filter.test.ts | Approved |
| REQ-502 | SCN-502a | `features/harness/REQ-502.feature` | - | - | - | - | - | tests/unit/capability-filter.test.ts | Approved |
| REQ-503 | SCN-503a | `features/trusted-gate/REQ-503.feature` | - | - | - | - | - | tests/unit/gate-stages.test.ts | Approved |
| REQ-504 | SCN-504a | `features/trusted-gate/REQ-504.feature` | - | - | - | - | - | tests/unit/gate-stages.test.ts | Approved |
| REQ-505 | SCN-505a | `features/project-setup/REQ-505.feature` | - | - | - | - | - | tests/unit/config-catalog.test.ts | Approved |
| REQ-506 | SCN-506a | `features/project-setup/REQ-506.feature` | - | - | - | - | - | tests/unit/config-catalog.test.ts | Approved |
| REQ-507 | SCN-507a | `features/project-setup/REQ-507.feature` | - | - | - | - | - | tests/unit/config-catalog.test.ts | Approved |
| REQ-508 | SCN-508a | `features/project-setup/REQ-508.feature` | - | - | - | - | - | tests/unit/config-catalog.test.ts | Approved |
| REQ-509 | SCN-509a | `features/harness/REQ-509.feature` | - | - | - | - | - | tests/unit/measured-cost.test.ts | Approved |
| REQ-510 | SCN-510a | `features/trusted-gate/REQ-510.feature` | - | - | - | - | - | tests/unit/affected-check.test.ts | Approved |
| REQ-511 | SCN-511a | `features/trusted-gate/REQ-511.feature` | - | - | - | - | - | tests/unit/affected-check.test.ts | Approved |
| REQ-512 | SCN-512a | `features/trusted-gate/REQ-512.feature` | - | - | - | - | - | tests/unit/affected-check.test.ts | Approved |
| REQ-513 | SCN-513a | `features/trusted-gate/REQ-513.feature` | - | - | - | - | - | tests/unit/affected-check.test.ts | Approved |
| REQ-514 | SCN-514a | `features/trusted-gate/REQ-514.feature` | - | - | - | - | - | tests/unit/affected-check.test.ts | Approved |
| REQ-515 | SCN-515a | `features/trusted-gate/REQ-515.feature` | - | - | - | - | - | tests/unit/affected-check.test.ts | Approved |
| REQ-516 | SCN-516a | `features/trusted-gate/REQ-516.feature` | - | - | - | - | - | tests/unit/test-cache.test.ts | Approved |
| REQ-517 | SCN-517a | `features/trusted-gate/REQ-517.feature` | - | - | - | - | - | tests/unit/gate-scaling.test.ts | Approved |
| REQ-518 | SCN-518a | `features/trusted-gate/REQ-518.feature` | - | - | - | - | - | tests/unit/gate-parallel.test.ts | Approved |
| REQ-519 | SCN-519a | `features/trusted-gate/REQ-519.feature` | - | - | - | - | - | tests/unit/gate-parallel.test.ts | Approved |
| REQ-520 | SCN-520a | `features/agent-integration/REQ-520.feature` | - | - | - | - | - | tests/unit/agent-ask.test.ts | Approved |
| REQ-521 | SCN-521a | `features/agent-integration/REQ-521.feature` | - | - | - | - | - | tests/unit/agent-ask.test.ts | Approved |
| REQ-522 | SCN-522a | `features/agent-integration/REQ-522.feature` | - | - | - | - | - | tests/unit/agent-ask.test.ts | Approved |
| REQ-523 | SCN-523a | `features/agent-integration/REQ-523.feature` | - | - | - | - | - | tests/unit/agent-ask.test.ts | Approved |
| REQ-524 | SCN-524a | `features/agent-integration/REQ-524.feature` | - | - | - | - | - | tests/unit/agent-apply.test.ts | Approved |
| REQ-525 | SCN-525a | `features/agent-integration/REQ-525.feature` | - | - | - | - | - | tests/unit/agent-apply.test.ts | Approved |
| REQ-526 | SCN-526a | `features/agent-integration/REQ-526.feature` | - | - | - | - | - | tests/unit/agent-ask.test.ts | Approved |
| REQ-527 | SCN-527a | `features/agent-integration/REQ-527.feature` | - | - | - | - | - | tests/unit/agent-api.test.ts | Approved |
| REQ-528 | SCN-528a | `features/project-setup/REQ-528.feature` | - | - | - | - | - | tests/unit/brownfield-reverse.test.ts | Implemented |
| REQ-529 | SCN-529a | `features/project-setup/REQ-529.feature` | - | - | - | - | - | tests/unit/brownfield-reverse.test.ts | Implemented |
| REQ-530 | SCN-530a | `features/project-setup/REQ-530.feature` | - | - | - | - | - | tests/unit/brownfield-reverse.test.ts | Implemented |
| REQ-531 | SCN-531a | `features/project-setup/REQ-531.feature` | - | - | - | - | - | tests/unit/brownfield-reverse.test.ts | Implemented |
| REQ-532 | SCN-532a | `features/harness/REQ-532.feature` | - | - | - | - | - | tests/unit/harness-roles.test.ts | Implemented |
| REQ-533 | SCN-533a | `features/harness/REQ-533.feature` | - | - | - | - | - | tests/unit/harness-roles.test.ts | Implemented |
| REQ-534 | SCN-534a | `features/harness/REQ-534.feature` | - | - | - | - | - | tests/unit/harness-roles.test.ts | Implemented |
| REQ-535 | SCN-535a | `features/harness/REQ-535.feature` | - | - | - | - | - | tests/unit/harness-roles.test.ts | Implemented |
| REQ-538 | SCN-538a | `features/domain-language/REQ-538.feature` | - | - | - | - | - | tests/unit/domain-language.test.ts | Implemented |
| REQ-539 | SCN-539a | `features/domain-language/REQ-539.feature` | - | - | - | - | - | tests/unit/domain-language.test.ts | Implemented |
| REQ-540 | SCN-540a | `features/domain-language/REQ-540.feature` | - | - | - | - | - | tests/unit/domain-language.test.ts | Implemented |
| REQ-541 | SCN-541a | `features/domain-language/REQ-541.feature` | - | - | - | - | - | tests/unit/domain-language.test.ts | Implemented |
| REQ-542 | SCN-542a | `features/transition/REQ-542.feature` | - | - | - | - | - | tests/unit/transition-outputs.test.ts | Implemented |
| REQ-543 | SCN-543a | `features/transition/REQ-543.feature` | - | - | - | - | - | tests/unit/transition-outputs.test.ts | Implemented |
| REQ-544 | SCN-544a | `features/transition/REQ-544.feature` | - | - | - | - | - | tests/unit/transition-outputs.test.ts | Implemented |
| REQ-545 | SCN-545a | `features/transition/REQ-545.feature` | - | - | - | - | - | tests/unit/transition-outputs.test.ts | Implemented |
| REQ-546 | SCN-546a | `features/architecture/REQ-546.feature` | - | - | - | - | - | tests/unit/architecture-decisions.test.ts | Implemented |
| REQ-547 | SCN-547a | `features/architecture/REQ-547.feature` | - | - | - | - | - | tests/unit/architecture-decisions.test.ts | Implemented |
| REQ-548 | SCN-548a | `features/architecture/REQ-548.feature` | - | - | - | - | - | tests/unit/architecture-decisions.test.ts | Implemented |
| REQ-549 | SCN-549a | `features/agent-integration/REQ-549.feature` | - | - | - | - | - | tests/unit/agent-skills.test.ts | Implemented |
| REQ-550 | SCN-550a | `features/agent-integration/REQ-550.feature` | - | - | - | - | - | tests/unit/agent-skills.test.ts | Implemented |
| REQ-551 | SCN-551a | `features/studio/REQ-551.feature` | - | - | - | - | - | tests/unit/business-review.test.ts | Implemented |
| REQ-552 | SCN-552a | `features/studio/REQ-552.feature` | - | - | - | - | - | tests/unit/business-review.test.ts | Implemented |
| REQ-553 | SCN-553a | `features/studio/REQ-553.feature` | - | - | - | - | - | tests/unit/studio-team.test.ts | Implemented |
| REQ-554 | SCN-554a | `features/studio/REQ-554.feature` | - | - | - | - | - | tests/unit/studio-team.test.ts | Implemented |
| REQ-555 | SCN-555a | `features/daily-surface/REQ-555.feature` | - | - | - | - | - | tests/unit/sgate-alias.test.ts | Implemented |
| REQ-556 | SCN-556a | `features/trusted-gate/REQ-556.feature` | - | - | - | - | - | tests/unit/release-workflows.test.ts | Implemented |
| REQ-557 | SCN-557a | `features/daily-surface/REQ-557.feature` | - | - | - | - | - | tests/unit/removed-in-flight.test.ts | Implemented |
| REQ-558 | SCN-558a | `features/daily-surface/REQ-558.feature` | - | - | - | - | - | tests/unit/removed-in-flight.test.ts | Implemented |
| REQ-559 | SCN-559a | `features/harness/REQ-559.feature` | - | - | - | - | - | tests/unit/migrate.test.ts | Implemented |
| REQ-560 | SCN-560a | `features/transition/REQ-560.feature` | - | - | - | - | - | tests/unit/layered-outputs.test.ts | Implemented |
| REQ-561 | SCN-561a | `features/project-setup/REQ-561.feature` | - | - | - | - | - | tests/unit/brownfield-reverse.test.ts | Implemented |
| REQ-562 | SCN-562a | `features/studio/REQ-562.feature` | - | - | - | - | - | tests/unit/studio-layers.test.ts | Implemented |
| REQ-563 | SCN-563a | `features/daily-surface/REQ-563.feature` | - | - | - | - | - | tests/unit/contract-fixes.test.ts | Implemented |
| REQ-564 | SCN-564a | `features/change-lifecycle/REQ-564.feature` | - | - | - | - | - | tests/unit/contract-fixes.test.ts | Implemented |
| REQ-565 | SCN-565a | `features/daily-surface/REQ-565.feature` | - | - | - | - | - | tests/unit/contract-fixes.test.ts | Implemented |
| REQ-566 | SCN-566a | `features/workspace/REQ-566.feature` | - | - | - | - | - | tests/unit/studio-workspace-live.test.ts | Implemented |
| REQ-567 | SCN-567a | `features/change-lifecycle/REQ-567.feature` | - | - | - | - | - | tests/unit/migrate.test.ts | Implemented |
| REQ-568 | SCN-568a | `features/trusted-gate/REQ-568.feature` | - | - | - | - | - | tests/unit/semver-contract.test.ts | Implemented |
| REQ-569 | SCN-569a | `features/trusted-gate/REQ-569.feature` | - | - | - | - | - | tests/unit/semver-contract.test.ts | Implemented |
| REQ-570 | SCN-570a | `features/trusted-gate/REQ-570.feature` | - | - | - | - | - | tests/unit/compat.test.ts | Implemented |
| REQ-571 | SCN-571a | `features/trusted-gate/REQ-571.feature` | - | - | - | - | - | tests/unit/release-workflows.test.ts | Implemented |
| REQ-572 | SCN-572a | `features/trusted-gate/REQ-572.feature` | - | - | - | - | - | tests/unit/release-workflows.test.ts | Implemented |
| REQ-573 | SCN-573a | `features/harness/REQ-573.feature` | - | - | - | - | - | tests/unit/harness-safety.test.ts | Approved |
| REQ-574 | SCN-574a | `features/harness/REQ-574.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Approved |
| REQ-575 | SCN-575a | `features/harness/REQ-575.feature` | - | - | - | - | - | tests/unit/harness-safety.test.ts | Approved |
| REQ-576 | SCN-576a | `features/harness/REQ-576.feature` | - | - | - | - | - | tests/unit/harness-safety.test.ts | Approved |
| REQ-577 | SCN-577a | `features/harness/REQ-577.feature` | - | - | - | - | - | tests/unit/harness-safety.test.ts | Approved |
| REQ-578 | SCN-578a | `features/harness/REQ-578.feature` | - | - | - | - | - | tests/unit/harness-safety.test.ts | Approved |
| REQ-579 | SCN-579a | `features/harness/REQ-579.feature` | - | - | - | - | - | tests/unit/harness-safety.test.ts | Approved |
| REQ-580 | SCN-580a | `features/harness/REQ-580.feature` | - | - | - | - | - | tests/unit/harness-safety.test.ts | Approved |
| REQ-581 | SCN-581a | `features/harness/REQ-581.feature` | - | - | - | - | - | tests/unit/quality-agents.test.ts | Approved |
| REQ-582 | SCN-582a | `features/harness/REQ-582.feature` | - | - | - | - | - | tests/unit/harness-safety.test.ts | Approved |
| REQ-583 | SCN-583a | `features/harness/REQ-583.feature` | - | - | - | - | - | tests/unit/harness-capabilities.test.ts | Approved |
| REQ-584 | SCN-584a | `features/harness/REQ-584.feature` | - | - | - | - | - | tests/unit/harness-capabilities.test.ts | Approved |
| REQ-585 | SCN-585a | `features/harness/REQ-585.feature` | - | - | - | - | - | tests/unit/harness-capabilities.test.ts | Approved |
| REQ-586 | SCN-586a | `features/harness/REQ-586.feature` | - | - | - | - | - | tests/unit/harness-capabilities.test.ts | Approved |
| REQ-587 | SCN-587a | `features/harness/REQ-587.feature` | - | - | - | - | - | tests/unit/harness-capabilities.test.ts | Approved |
| REQ-588 | SCN-588a | `features/harness/REQ-588.feature` | - | - | - | - | - | tests/unit/harness-extras.test.ts | Approved |
| REQ-589 | SCN-589a | `features/harness/REQ-589.feature` | - | - | - | - | - | tests/unit/harness-extras.test.ts | Approved |
| REQ-590 | SCN-590a | `features/harness/REQ-590.feature` | - | - | - | - | - | tests/unit/harness-extras.test.ts | Approved |
| REQ-591 | SCN-591a | `features/harness/REQ-591.feature` | - | - | - | - | - | tests/unit/harness-extras.test.ts | Approved |
| REQ-592 | SCN-592a | `features/harness/REQ-592.feature` | - | - | - | - | - | tests/unit/harness-safety.test.ts | Approved |
| REQ-593 | SCN-593a | `features/harness/REQ-593.feature` | - | - | - | - | - | tests/unit/harness-safety.test.ts | Approved |
| REQ-594 | SCN-594a | `features/domain-language/REQ-594.feature` | - | - | - | - | - | tests/unit/domain-language.test.ts | Approved |
| REQ-595 | SCN-595a | `features/domain-language/REQ-595.feature` | - | - | - | - | - | tests/unit/domain-language.test.ts | Approved |
| REQ-596 | SCN-596a | `features/agent-integration/REQ-596.feature` | - | - | - | - | - | tests/unit/agent-choice.test.ts | Approved |
| REQ-597 | SCN-597a | `features/agent-integration/REQ-597.feature` | - | - | - | - | - | tests/unit/agent-choice.test.ts | Approved |
| REQ-598 | SCN-598a | `features/agent-integration/REQ-598.feature` | - | - | - | - | - | tests/unit/agent-choice.test.ts | Approved |
| REQ-599 | SCN-599a | `features/change-lifecycle/REQ-599.feature` | - | - | - | - | - | tests/unit/change-layers.test.ts | Approved |
| REQ-600 | SCN-600a | `features/harness/REQ-600.feature` | - | - | - | - | - | tests/unit/build-order.test.ts | Approved |
| REQ-601 | SCN-601a | `features/brief-cards/REQ-601.feature` | - | - | - | - | - | tests/unit/brief-quality.test.ts | Approved |
| REQ-602 | SCN-602a | `features/brief-cards/REQ-602.feature` | - | - | - | - | - | tests/unit/brief-quality.test.ts | Approved |
| REQ-603 | SCN-603a | `features/brief-cards/REQ-603.feature` | - | - | - | - | - | tests/unit/brief-quality.test.ts | Approved |
| REQ-604 | SCN-604a | `features/trusted-gate/REQ-604.feature` | - | - | - | - | - | tests/unit/gate-policy.test.ts, packages/core/test/unit/use-case-coverage.test.ts | Approved |
| REQ-605 | SCN-605a | `features/trusted-gate/REQ-605.feature` | - | - | - | - | - | tests/unit/gate-policy.test.ts, packages/core/test/unit/use-case-coverage.test.ts | Approved |
| REQ-606 | SCN-606a | `features/trusted-gate/REQ-606.feature` | - | - | - | - | - | tests/unit/gate-policy.test.ts, packages/core/test/unit/use-case-coverage.test.ts | Approved |
| REQ-607 | SCN-607a | `features/project-setup/REQ-607.feature` | - | - | - | - | - | tests/unit/undecided-stack.test.ts | Approved |
| REQ-608 | SCN-608a | `features/project-setup/REQ-608.feature` | - | - | - | - | - | tests/unit/adopt-no-code.test.ts | Approved |
| REQ-609 | SCN-609a | `features/project-setup/REQ-609.feature` | - | - | - | - | - | tests/unit/init-wizard.test.ts | Approved |
| REQ-610 | SCN-610a | `features/trusted-gate/REQ-610.feature` | - | - | - | - | - | tests/unit/first-green-gate.test.ts | Approved |
| REQ-611 | SCN-611a | `features/trusted-gate/REQ-611.feature` | - | - | - | - | - | tests/unit/first-green-gate.test.ts | Approved |
| REQ-612 | SCN-612a | `features/daily-surface/REQ-612.feature` | - | - | - | - | - | tests/unit/first-green-gate.test.ts | Approved |
| REQ-613 | SCN-613a | `features/trusted-gate/REQ-613.feature` | - | - | - | - | - | tests/unit/ci-matches-local.test.ts | Approved |
| REQ-614 | SCN-614a | `features/harness/REQ-614.feature` | - | - | - | - | - | tests/unit/agent-runs-tests.test.ts | Approved |
| REQ-615 | SCN-615a | `features/daily-surface/REQ-615.feature` | - | - | - | - | - | tests/unit/status-counts-requirements.test.ts | Approved |
| REQ-616 | SCN-616a | `features/harness/REQ-616.feature` | - | - | - | - | `scripts/draft/confined-agent.ts` | tests/unit/draft-from-brief.test.ts | Approved |
| REQ-619 | SCN-619a | `features/change-lifecycle/REQ-619.feature` | - | - | - | - | `scripts/cli/commands/change/ChangeCommand.ts` | tests/unit/show-approval-blockers.test.ts | Approved |
| REQ-622 | SCN-622a | `features/brief-cards/REQ-622.feature` | - | - | - | - | `packages/core/src/domain/DraftChecklist.ts` | tests/unit/quoted-actor-names.test.ts | Approved |
| REQ-625 | SCN-625a | `features/change-lifecycle/REQ-625.feature` | - | - | - | - | `packages/core/src/domain/UseCaseDelta.ts` | tests/unit/use-cases-archive.test.ts, packages/core/test/unit/use-case-delta.test.ts | Approved |
| REQ-626 | SCN-626a | `features/change-lifecycle/REQ-626.feature` | - | - | - | - | `scripts/cli/commands/spec/DraftCommand.ts` | tests/unit/draft-from-brief.test.ts | Approved |
| REQ-627 | SCN-627a | `features/change-lifecycle/REQ-627.feature` | - | - | - | - | `scripts/lib/gate-policy.ts` | tests/unit/gate-policy.test.ts, packages/core/test/unit/use-case-coverage.test.ts | Approved |
| REQ-628 | SCN-628a | `features/change-lifecycle/REQ-628.feature` | - | - | - | - | `scripts/cli/commands/change/ChangeCommand.ts` | tests/unit/show-approval-blockers.test.ts | Approved |
| REQ-631 | SCN-631a | `features/change-lifecycle/REQ-631.feature` | - | - | - | - | `packages/core/src/domain/UseCaseSpec.ts` | packages/core/test/unit/use-case-spec.test.ts, tests/unit/use-cases-archive.test.ts | Approved |
| REQ-632 | SCN-632a | `features/change-lifecycle/REQ-632.feature` | - | - | - | - | `packages/core/src/domain/DraftChecklist.ts` | tests/unit/draft-from-brief.test.ts | Approved |
| REQ-633 | SCN-633a | `features/change-lifecycle/REQ-633.feature` | - | - | - | - | `packages/core/src/domain/UseCaseDelta.ts` | packages/core/test/unit/use-case-coverage.test.ts | Approved |
| REQ-634 | SCN-634a | `features/change-lifecycle/REQ-634.feature` | - | - | - | - | `packages/core/src/domain/UseCaseDiagrams.ts` | packages/core/test/unit/use-case-diagrams.test.ts, tests/unit/use-case-diagrams-files.test.ts | Approved |
| REQ-635 | SCN-635a | `features/change-lifecycle/REQ-635.feature` | - | - | - | - | `scripts/lib/domain-docs.ts` | tests/unit/use-case-diagrams-files.test.ts | Approved |
| REQ-636 | SCN-636a | `features/change-lifecycle/REQ-636.feature` | - | - | - | - | `scripts/cli/commands/spec/UseCasesCommand.ts` | tests/unit/propose-use-cases.test.ts | Approved |
| REQ-637 | SCN-637a | `features/change-lifecycle/REQ-637.feature` | - | - | - | - | `packages/core/src/domain/StateMachine.ts` | packages/core/test/unit/state-machine.test.ts, tests/unit/state-machines-check.test.ts | Approved |
| REQ-638 | SCN-638a | `features/change-lifecycle/REQ-638.feature` | - | - | - | - | `packages/core/src/application/ArchiveChangeUseCase.ts` | packages/core/test/unit/state-machine.test.ts, tests/unit/state-machines-archive.test.ts | Approved |
| REQ-639 | SCN-639a | `features/change-lifecycle/REQ-639.feature` | - | - | - | - | `scripts/lib/domain-docs.ts` | packages/core/test/unit/state-machine.test.ts, tests/unit/state-machines-check.test.ts, tests/unit/draft-from-brief.test.ts | Approved |
| REQ-640 | SCN-640a | `features/change-lifecycle/REQ-640.feature` | - | - | - | - | `packages/core/src/domain/UseCaseSpec.ts` | packages/core/test/unit/use-case-lanes.test.ts | Approved |
| REQ-641 | SCN-641a | `features/change-lifecycle/REQ-641.feature` | - | - | - | - | `packages/core/src/domain/UseCaseDiagrams.ts` | packages/core/test/unit/use-case-lanes.test.ts | Approved |
| REQ-642 | SCN-642a | `features/change-lifecycle/REQ-642.feature` | - | - | - | - | `scripts/draft/drafting-guide.ts` | tests/unit/draft-from-brief.test.ts, tests/unit/use-case-diagrams-files.test.ts | Approved |
| REQ-643 | SCN-643a | `features/harness/REQ-643.feature` | - | - | - | - | `scripts/harness/run/prepare.ts` | tests/unit/harness-control.test.ts | Approved |
| REQ-646 | SCN-646a | `features/change-lifecycle/REQ-646.feature` | - | - | - | - | `scripts/lib/domain-docs.ts` | tests/unit/proposed-in-status.test.ts | Approved |
| REQ-649 | SCN-649a | `features/harness/REQ-649.feature` | - | - | - | - | `scripts/harness/run/attempt.ts` | tests/unit/harness-control.test.ts | Approved |
| REQ-650 | SCN-650a | `features/harness/REQ-650.feature` | - | - | - | - | `scripts/lib/agent-permission.ts` | tests/unit/agent-no-mcp.test.ts, tests/unit/draft-from-brief.test.ts | Approved |
| REQ-651 | SCN-651a | `features/project-setup/REQ-651.feature` | - | - | - | - | `scripts/cli/commands/project/Forja.ts` | tests/unit/forja-front-door.test.ts | Approved |

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
