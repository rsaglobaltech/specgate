# Design: agent-flags-in-claude-segment

`withWritePermission` and `withOutsideDir` (`scripts/draft/confined-agent.ts`)
insert the flag right after `claude`, as `withAgentPermission`
(`scripts/lib/agent-permission.ts`, REQ-264) already does for the harness —
the same reasoning, now shared by the drafting commands. AC-1 → SCN-616a;
AC-2 → SCN-616b; AC-3 → the existing "left as it is" cases, kept.
