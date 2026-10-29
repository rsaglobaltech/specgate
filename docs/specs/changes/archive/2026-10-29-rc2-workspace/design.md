# Design: rc2-workspace

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- AC-1 — `workspace draft` reads the workspace's brief (`docs/brief.md`, or a
  root `brief.md` it copies there under a front matter) and lists the stories
  of its front matter: `stories: [{ id, title, repos: [..] }]`.
- AC-2 — `workspace draft <story> [--agent]` writes the story's `story.md`; with
  an agent, through `runConfinedAgent`, allowed to write only that story's folder.
- AC-3 — `status` in a folder holding `specgate.workspace.yaml` and no matrix
  prints the workspace's state and its next step instead of failing.
- AC-4 — `workspace propose` takes an already drafted story (its repos from the
  brief when `--repos` is absent) and copies its Intent and Acceptance criteria
  into each sub-change's `discover.md`, naming the story; no path to a file
  the repository cannot read.
- AC-5 — `workspace check` compares each open sub-change's `AC-n` lines with the
  story's and warns `workspace_story_diverged`.
- AC-6 — the sub-change's `discover.md` gets a section naming the story's other
  repositories, the contracts repository, and how to write `depends=` and
  `api=`; `workspace harness run` hands each harness a context file naming the
  other repositories' requirements (`SPECGATE_STORY_CONTEXT`), which the
  implementing prompt includes.
- AC-7 — `workspace harness run` groups the repositories in levels by the
  `depends=` between their parts, runs one level after another, and the dry run
  shows the levels.
- AC-8 — every JSON response of the studio says `charset=utf-8`.
- AC-9 — a story's part reads its archived change's deltas too, so the story's
  cost counts it.
- AC-10 — `workspace init` strips the prefix the sibling folders share
  (`truck-flote-fleet` → `fleet`, its path kept) and separates the columns.
- AC-11 — `workspace init` ignores `.specgate/workspace-runs/`.
