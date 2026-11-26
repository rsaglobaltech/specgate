# Discover: quoted-actor-names

## Context

Importing a client's brief in Specgate Studio, the agent wrote the actor
`{ name: "Padre, madre o tutor", surfaces: [web] }`. Every place specgate reads
actors stopped the name at the first comma and ignored quotes, so the brief
was refused (#541).

## Acceptance criteria

- AC-1: a name in quotes is read whole, without its quotes.
- AC-2: the form writes such a name back in quotes.
