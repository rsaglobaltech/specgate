# Tasks

> Owner: developer — each task is verifiable and names the requirement it
> delivers (REQ-NNN).

## 1. Specification

- [x] 1.1 Write the delta spec for each affected capability
- [x] 1.2 Run `specgate change validate`

## 2. Implementation

- [x] 2.1 REQ-310 — roles read from harness.config.yaml, matched to the git identity
- [x] 2.2 REQ-311 — a layer approved only by its owning role
- [x] 2.3 REQ-312 — quorum per layer
- [x] 2.4 REQ-313 — approvals.json records who approved which version
- [x] 2.5 REQ-314 — a changed layer re-opens its approval
- [x] 2.6 REQ-315 — the harness refuses an unapproved 1.0 change; approvals.required
- [x] 2.7 REQ-316 — role packages composed into the implementing prompt
- [x] 2.8 REQ-317 — the prompt event, the run record and the report name them
- [x] 2.9 REQ-318 — the review check advises per package
- [x] 2.10 REQ-319 — the studio's Review shows and records layer approvals
