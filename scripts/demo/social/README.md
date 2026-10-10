# 🎬 Social-media demo — console only, Spanish, vertical

A 55-second vertical video (1080 × 1920, 9:16) for LinkedIn, Instagram,
TikTok, YouTube Shorts or X. No avatar, no voice-over: the terminal tells the
story, with the captions typed as shell comments.

```bash
bash scripts/demo/social/build.sh
# → scripts/demo/social/out/specgate-social.mp4  (≈1.2 MB)
#   scripts/demo/social/out/specgate-social.gif  (≈1.3 MB)
```

Requires `vhs` (`brew install vhs`), Node ≥ 22, git and python3. The CLI is
built from this checkout, so the video always shows the current behaviour;
`init` runs off camera in a throwaway project.

## The story (≈55 s)

| Time    | On screen                                                          | The point                    |
| ------- | ------------------------------------------------------------------ | ---------------------------- |
| 0–5 s   | `# ¿Tu PR dice «hecho»? ¿Y lo está?`                               | The hook                     |
| 5–10 s  | `specgate new 'El carrito suma el total'`                          | A requirement is one command |
| 10–15 s | `cat` of the scenario, in Spanish Gherkin                          | The spec is readable         |
| 15–22 s | `specgate done REQ-002` → **refused**: no test names it            | Nothing is "done" untested   |
| 22–28 s | the test, with `REQ-002 SCN-002` in its name                       | Naming it is the link        |
| 28–37 s | `specgate done REQ-002` → **refused**: the test fails              | Nothing is "done" red        |
| 37–44 s | the code, then `done` → **Implemented**                            |                              |
| 44–55 s | `specgate check` → **Gate passed**; `# El mismo gate corre en CI.` | Same gate locally and in CI  |

## Files

| File            | Role                                                       |
| --------------- | ---------------------------------------------------------- |
| `demo.tape`     | VHS script: keystrokes, pacing, captions                   |
| `build.sh`      | Builds the CLI, prepares the adopted project, records      |
| `files/`        | The scenario, test and code copied in off camera           |
| `obligation.py` | Replaces the obligation `new` seeds with the real sentence |

## Text for the post

> ¿Tu PR dice «hecho»… y lo está?
>
> Con Specgate, un requisito no se cierra sin un test que lo nombre y una suite
> en verde. En este vídeo `done` se niega dos veces —sin test y con el test
> fallando— antes de marcarlo como implementado. El mismo gate corre en CI.
>
> Specs ejecutables: requisitos, escenarios y trazabilidad que el CI hace cumplir.
> `npx @rsaglobaltech/specgate init`
>
> #SpecDrivenDevelopment #TDD #DevOps #CI #SoftwareEngineering #IA

Subtitles are not needed — every caption is already on screen. For a platform
that autoplays muted, the first frame already carries the hook.

## Variations

- **Square (1:1)** for a feed: `Set Height 1080`, `Set FontSize 26`.
- **English**: translate the comments in `demo.tape` and the Gherkin in
  `files/carrito.feature` (use `Feature` / `Scenario` / `Given`, without
  `# language: es`).
- **Slower**: raise `TypingSpeed` and the `Sleep`s; every step is a separate
  line in the tape.
