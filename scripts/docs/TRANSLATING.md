# Translating the documentation into Spanish

English is the source. A Spanish page is `docs/es/<slug>.md`, the same path as
`docs/<slug>.md` under `es/`. The site shows it at `es/<slug>.html`; a guide
with no Spanish page shows its English text there, with a note.

## The workflow

1. Translate `docs/<slug>.md` into `docs/es/<slug>.md`.
2. Stamp it with the English it translates:
   `npm run build && npm run docs:i18n:stamp -- docs/es/<slug>.md`.
   This writes `<!-- translation-of: <fingerprint> -->` as its first line.
3. When the English page changes later, the Spanish one is *stale*: the site
   says the English is newer and `npm run docs:i18n` lists it.
   Update the translation, then stamp it again.

The landing is `docs/es/index.html`, a translation of `docs/index.html`.

## Voice

- Neutral Spanish for any country: **tú**, never *vosotros* or *usted*.
- Short sentences, as in the English. Say what happens; no filler.
- Translate meaning, not word for word. If the English is a fragment, the
  Spanish may be one too.

## Never translate

- Code, commands, flags, file names, paths, YAML keys, environment variables.
- Fenced code blocks and terminal output: the CLI speaks English.
- Generated blocks between `<!-- specgate:… -->` markers, and the markers.
- Diagnostic codes (`check_tests_failed`), requirement and scenario ids.
- Status values: Draft, Approved, Implemented, Verified, Released, Deprecated.
- Product and tool names: Specgate, GitHub Actions, SonarQube, Cucumber…
- Link targets: keep every path as it is (`../quality.md`, `ci.md`).

## Glossary

| English | Spanish |
| --- | --- |
| gate | gate (el gate) |
| requirement | requisito |
| scenario | escenario |
| change | change (el change), the Specgate artifact; *cambio* for a change in general |
| delta | delta |
| brief | brief (el brief) |
| draft (a draft change) | borrador |
| traceability matrix | matriz de trazabilidad |
| baseline | baseline |
| harness | harness |
| finding | hallazgo |
| fix (noun) | corrección |
| pull request | pull request |
| merge | merge (hacer merge) |
| required check | check obligatorio |
| quality checks | checks de calidad |
| pipeline, workflow, job, step | pipeline, workflow, job, paso |
| agent | agente |
| actor | actor |
| module | módulo |
| stakeholder | stakeholder |
| debt | deuda |
| release | versión (a version), publicar (to release) |

## Headings and anchors

Translate headings. Their anchors change: `## What it runs` is `#what-it-runs`
in English and `## Qué ejecuta` is `#que-ejecuta` in Spanish (lower case,
accents dropped, anything else a hyphen).

- A link to a heading **in a page that is translated** uses its Spanish anchor.
- A link to a page **not translated yet** keeps its English anchor: that page
  shows the English text.

`npm run build && node dist/scripts/docs/build-site.js --out _site` builds the
site; `tests/unit/docs-i18n.test.ts` checks the Spanish pages.
