# Proposal: live-view-polish

## Intent

The live view listed every requirement the same way, by id alone, mixing what was running with what had finished, and its steps were a flat table. Watching a nineteen-requirement run, an adopter could not tell how far it had got, what the requirement at work was about, or which stage of the gate it was in.

## Scope

`/live` is laid out the way CI runs are read: a sidebar of the run's requirements by module with status and duration; the run summed up (started, duration, counts, agent time); its requirements drawn as a graph of jobs in the order they ran; and the selected requirement (the one at work, unless another is clicked) opened into its steps — Agent, each gate stage as it ran, the stages still to come — with the agent's stream as the log of the step in progress. The live model gives each requirement its title and module from the specification.

## Out of scope

Requirements the run has not reached yet: the events say nothing about them until they start.
