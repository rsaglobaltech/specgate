# 🎬 Tutorial video — Specgate day to day, from an empty directory

A real session, recorded with [VHS](https://github.com/charmbracelet/vhs):
an empty folder, `npm init`, the **published** npm package, a requirement
written by hand (the obligation edited in `vim`, the scenario, the test, the
code), `done` refusing a failing suite, `check`, CI and the commit. Nothing is
copied in off camera; only the shell prompt is set up. In Spanish.

```bash
bash scripts/demo/tutorial/build.sh
# → out/specgate-tutorial-16x9.mp4   1920×1080  YouTube, LinkedIn
#   out/specgate-tutorial-9x16.mp4   1080×1920  Shorts, Reels, TikTok
#   (and a .gif of each)
```

Requires `vhs` (`brew install vhs`), Node ≥ 22, npm, git and vim. It installs
`@rsaglobaltech/specgate@latest` from npm, so the video shows what a team gets
today; re-run it after a release.

## Chapters (≈2 min)

| Chapter              | Commands                                                                                                                           | What the viewer learns                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 0. A new project     | `mkdir`, `git init`, `npm init`, `npm pkg set scripts.test`                                                                        | It starts from nothing                           |
| 1. Install and adopt | `npm i -D @rsaglobaltech/specgate`, `npx specgate init --no-capabilities`, `config set test_cmd 'npm test'` (once), `done REQ-001` | Setup is three commands                          |
| 2. A requirement     | `npx specgate new '…'`, the obligation in `vim`, the scenario with concrete values, `status`                                       | A requirement is prose + a scenario              |
| 3. Test first        | the test naming `REQ-002 SCN-002`, `done` → **refused**: the suite is red; the code; `done` → **Implemented**                      | Naming the id is the link; nothing is "done" red |
| 4. Before the PR     | `check`, `ci init --provider github`, `git commit`                                                                                 | The same gate runs in CI                         |

## Text for the post

> **Specgate en el día a día, desde cero (2 min).**
> Un proyecto vacío, un requisito escrito a mano, el test que lo nombra —y
> `done` negándose a cerrarlo mientras la suite está en rojo. Después, el
> mismo gate en CI.
>
> Requisitos, escenarios y trazabilidad que el CI hace cumplir.
> `npm i -D @rsaglobaltech/specgate && npx specgate init`
>
> #SpecDrivenDevelopment #TDD #DevOps #CI #SoftwareEngineering

For YouTube, the chapter table above gives the timestamps for the description.

## Changing it

Every step is a line in `tutorial.tape`; `build.sh` substitutes the size and
font per format. To make it slower, raise `TypingSpeed` or the `Sleep`s. For an
English version, translate the `#` captions and the Gherkin (`Feature` /
`Scenario` / `Given`, without `# language: es`).
