# Design: verified-build

`runGate` marks `unverified` without a test command; the attempt commits and ends `unverified`; `preflight` warns. `withoutMcp` in the permission helpers; `withTestPermission` takes the arch command. `wireForjaProject` adopts, sets test_cmd/arch_cmd and commits. AC-1 → SCN-649a; AC-2 → SCN-650a–b; AC-3 → SCN-651a.
