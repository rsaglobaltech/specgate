# Proposal: brief-plain-sections

## Intent

A brief written by hand often names a module with a plain heading — `## orders`
followed by its prose — instead of `## Module: orders`. The studio's form did
not see that section as the module's: saving the form added a second section,
`## Module: orders`, below it, and the hand-written prose stayed outside the
module. A draft of `orders` reads its own `## Module:` section, so what the
person wrote about the module ("shipping is free above some amount") never
reached it. Found in the forja trial, where the brief was written by hand.

## Scope

In scope:

- Saving the brief form turns a plain `## <module>` section into that module's
  `## Module: <module>` section, its prose kept inside it, in the same place.
- Only a heading whose name is a module the front matter lists: `## Context`
  and other headings are left as they are.

Out of scope:

- Editing a module's prose in the form (the form keeps it; it does not show it).
- Changing how a draft reads the brief.

## Approach

`saveBriefForm` looks, for each module of the form with no `## Module:` section,
for a plain `## ` heading whose key is the module's, and writes the module's
section in its place with that heading's text as its prose. The front matter
and every other line are kept, as REQ-214 asks.
