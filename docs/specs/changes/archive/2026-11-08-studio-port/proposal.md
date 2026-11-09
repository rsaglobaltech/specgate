# Proposal: studio-port

## Intent

`specgate studio` failed with `EADDRINUSE` when its port was taken — most
often by a studio of the same project left running in another terminal or
session — and said nothing about who held it. The person was left with a
second terminal that would not start and a studio they did not know about.

## Scope

In scope:

- Port taken by a studio of the same project: say it is already running, its
  address and its process id to stop it, and end without an error.
- Port taken by anything else, and no `--port` given: serve on the next free
  port, and say which.
- `--port` given and taken: refuse, naming what holds it when it is a studio.

Out of scope:

- Stopping another studio from this one.

## Approach

On `EADDRINUSE` the studio asks what answers on that port: a studio answers
`/api/ping` with its project folder and process id. The same project ends
this run with the address to open; anything else moves to the next port, up
to ten, unless `--port` named the port.
