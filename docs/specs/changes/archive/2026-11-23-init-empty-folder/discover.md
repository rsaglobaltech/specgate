# Discover: init-empty-folder

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The command the tool recommends to start with behaves badly in an empty
folder. Asked for the specification only, for any technology, it goes on to
choose one. Run by an agent or a script, with nobody to answer, it stops with
an error, and the way out it suggests creates a project on a technology nobody
chose, in a folder other than the one it names. Issue #515. What that way out
creates is relied on by scripts and stays as it is.

## Use case

A person, or an agent on their behalf, starts in an empty folder and gets the
specification's skeleton there, with nothing chosen for them; a person who
wants a ready-made project still gets one, and is told what was chosen.

## Acceptance criteria

- AC-1: In an empty folder, a person is offered three starts: a generated application, the specification only in that folder, or a project from a template; the specification only is the default and chooses no technology.
- AC-2: With nobody to ask and nothing said about the project, the start is the specification only, in that folder, and the other two are named.
- AC-3: A project created with every default says where it was created, what was chosen for the person, and how to change it.
- AC-4: Every start that names the project to create does what it did.
