# Proposal: run6-drafting

## Intent

The sixth truck-flote run, with Specgate 0.27.6, drafted the brief's first
module and found four places where the person had to do by hand what the
tool knew how to do, or was told the wrong thing:

- S46: with the client's `brief.md` at the root, `draft --agent` wrote the
  front matter and left forja's placeholder below it; the person pasted the
  client's text.
- S47: `docs/specs/BRIEF-SETUP.md` stayed untracked once the front matter was
  done, and the harness wants a clean tree.
- S48: D6 reported "1234-BCD › Ejes" and "Lucía Martín — E000001234567890" as
  unlisted, although every part was listed.
- S49: answers written in `questions.md` changed nothing: `propose` said Ready
  to review and `status` kept the requirements "Waiting for an answer".

## Scope

- `draft` puts a root brief's text below the front matter when the body is
  still a template's (REQ-259).
- `draft` removes the guide once the front matter is complete (REQ-260).
- D6 reads a value made of listed parts (REQ-261).
- An answered question whose requirement is still Needs Clarification is a
  finding (REQ-262), and `status` says the spec needs the answer (REQ-263).
