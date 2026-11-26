# Start

Two paths, a few commands each. Pick the one that matches your folder.

**You need:** Node.js 22 or later, git, and the test runner your project already uses.

## An existing project

A local repository whose code already works.

1. Install Specgate in the project: `npm i -D @rsaglobaltech/specgate`
2. Adopt it, touching no code: `npx specgate adopt` — it saves the test command it detects, sets your agent when one is installed (asking first), writes the areas it found to `docs/specs/adoption.md` instead of inventing requirements, and ends with a list of what is ready. Prefer an app? `npx specgate studio` and press **Adopt** on its start screen.
3. Set up your agent with one command, its commands and Build's agent: `npx specgate agents init --tool claude`
4. Write down one behaviour you rely on, picked from `docs/specs/adoption.md` when adoption wrote one: `npx specgate new "<a behaviour you rely on>"` — then replace the sentence it wrote in `spec.md` and the `<placeholders>` of its scenario under `features/` with the real ones
5. Name the new id (`REQ-002`) in a test that proves it — one you already have will do — then deliver it through the gate: `npx specgate apply REQ-002`
6. Before each pull request, run the gate CI runs too: `npx specgate check`

## A new project

An empty folder, maybe with a client's brief.

1. Create the project, answering a few questions — `npx @rsaglobaltech/specgate@latest init` — then, in its folder, set up your agent: `npx specgate agents init --tool claude`
2. Save the plan as `docs/brief.md` and turn one module into a draft a person reviews: `npx specgate propose --from-brief`
3. Once you have read the draft, approve it yourself, at your terminal — an agent cannot, and `apply` waits for it: `npx specgate change approve <change-id>`
4. Write a test that names a requirement of the draft — its ids start at `REQ-002`; `REQ-001` is the baseline `init` wrote — write the code, and deliver it: `npx specgate apply REQ-002`
5. Once every requirement of the change is applied, merge it into the specification: `npx specgate archive <change-id>`
6. Before each pull request, run the gate CI runs too: `npx specgate check`

## Next

- [Concepts](concepts.md) — the words: change, delta, gate, matrix
- [Command reference](commands.md) — every command
- [The studio](studio.md) — the same paths in an app
- [Specify a system that already runs](reverse.md) — requirements drafted from the code itself
- [Joining a project](quickstart.md) — someone else set it up
- Step by step, with recorded output: [existing code](start/existing-1-adopt.md) · [a new project](start/scratch-1-install.md)
