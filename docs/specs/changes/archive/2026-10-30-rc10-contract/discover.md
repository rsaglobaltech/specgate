# Discover: rc10-contract

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

In the eighth run of the 1.0 candidate over several repositories, the warnings of the seventh were there and
the parts still did not speak to each other. The web named an agreement file that does not exist; the service
named none, and offered none of the agreement's ways in; every requirement was accepted and built. A rule that
cites the driving-time regulation was refused at review without saying what to add, and one requirement was
left unbuilt because its builder wrote nothing once.

## Use case

Whoever writes a part of a story is given each agreement to name exactly as it is written, and a part that
names a wrong one, or none where the agreement is known, is not accepted for review. A rule that cites a law
names the law. A builder that wrote nothing once, after writing for the others, gets one more try. A
requirement that names an agreement is not accepted as built while its code neither offers nor uses it.

## Acceptance criteria

- AC-1: the story lists, for each requirement of the agreements, the exact line a part copies to name it.
- AC-2: review refuses a part that names an agreement that does not exist, listing the ones that do, and a
  part that waits for an agreements' requirement and names none of its agreements.
- AC-3: whoever writes the requirements is told that a rule citing a law names its source, and review, when
  it refuses one, says which requirement and what line to add.
- AC-4: a builder that wrote nothing for one requirement, after writing for another in the same run, is given
  one more try.
- AC-5: a requirement that names another repository's agreement does not pass the build while its code
  neither offers nor uses what the agreement describes.
