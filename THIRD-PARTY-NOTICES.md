# Third-party notices

Code and data from other projects that ships **inside** this repository rather
than arriving as a dependency. Dependencies are covered by
`specgate license-check`, which reads the SBOM; this file exists for the things an
SBOM cannot see because they were copied in.

---

## Gherkin keyword table — `packages/core/src/domain/GherkinDialects.ts`

The keyword table for the `en`, `es` and `pt` dialects is copied verbatim from
`gherkin-languages.json` in [`@cucumber/gherkin`](https://github.com/cucumber/gherkin),
and generated from the installed package rather than transcribed.

**Why it is vendored rather than depended on:** `package.json` declares no
runtime dependencies. The CLI runs through `npx` on other people's machines, so
that is a structural promise, and `AI_RULES.md` requires an ADR to add a runtime
dependency. Reading three dialects did not justify one.

**How it is kept honest:** `packages/core/test/unit/gherkin-dialects.test.ts`
compares every vendored entry against the installed official table and fails on
any divergence, and `tests/unit/gherkin-differential.test.ts` compares this
repository's parser against `@cucumber/gherkin` itself over every Gherkin file
shipped here. `@cucumber/gherkin` remains a devDependency so both can run.

### Licence

    MIT License
    
    Copyright (c) 2017 Cucumber Ltd, Gaspar Nagy, Björn Rasmusson, Peter Sergeant, and contributors
    
    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:
    
    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.
    
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.

---

## Preact — bundled into `dist/studio/app.js`

The studio's app (change studio-redesign) is written with [Preact](https://preactjs.com)
and bundled by esbuild at build time into `dist/studio/app.js`.

**Why it is bundled rather than depended on:** `package.json` declares no runtime
dependencies; Preact and esbuild are devDependencies, and the built file is what
ships. The SBOM sees them as devDependencies; this entry says the bundled copy ships.

### Licence

    The MIT License (MIT)
    
    Copyright (c) 2015-present Jason Miller
    
    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:
    
    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.
    
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.

---

## Syne and IBM Plex — `studio/fonts/`, shipped in `dist/studio/fonts/`

The studio uses the Specgate site's type: Syne for headings, IBM Plex Sans and
IBM Plex Mono for text and identifiers. The Latin woff2 files are copied into the
repository so the studio loads nothing from another host (REQ-432). Each family's
licence ships beside its files: `OFL-Syne.txt`, `OFL-IBMPlex.txt`.

### Licence

    SIL Open Font License, Version 1.1 — Copyright 2017 The Syne Project Authors;
    Copyright © 2017 IBM Corp. with Reserved Font Name "Plex".
