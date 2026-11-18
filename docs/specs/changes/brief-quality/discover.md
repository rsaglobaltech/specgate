# Discover: brief-quality

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A brief says what each module must do, and nothing says how well the product
must do it: how fast, how available, how secure. Those needs end up in the
notes, or nowhere, and no draft turns them into requirements a test can check.
The `## Why` asks for a success you can measure and nothing checks that it
gives one. Issue #485 compares the brief with ISO/IEC/IEEE 29148:2018 and
ISO/IEC 25010:2023; this change is its first slice.

## Use case

A person writes, in the brief, the product's quality requirements under the
ISO/IEC 25010 characteristics, each with a number a test can check, and the
problem and objectives with a success they can measure. Specgate checks both
before any agent drafts, and each quality requirement reaches the draft that
must turn it into a non-functional requirement.

## Acceptance criteria

- AC-1: A `## Quality` section lists entries as `<characteristic>: <statement>`, optionally scoped to modules; an entry that cannot be tested stops the draft, a characteristic outside ISO/IEC 25010 or an entry without one is a warning.
- AC-2: A `## Why` that states the problem and no measurable success gets a warning; a brief without one keeps working.
- AC-3: Each quality entry reaches the draft of the module it names, and a product-wide one the draft of the brief's first module, as a non-functional requirement to write.
- AC-4: The new brief's template, the guide an agent follows to propose sections, and the explanation for a person with no brief teach both sections.
- AC-5: A brief without `## Quality` and without `## Why` gets no new finding.
