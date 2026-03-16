# Engine

This document defines the harmonic engine as it exists in this repository. It takes canonical input, derives harmonic structure for each segment, and passes that structure to placement and rendering.

## Canonical input

In the current code, the harmonic engine consumes a simple canonical input:

- `PieceInput`
- ordered `SegmentInput[]`
- `EventInput[]` inside each segment
- optional `harmonicGuidance` string on each segment

`EventInput` currently covers:

- `note`
- `chord`
- `rest`

The canonical input contains authored input only:

- notes
- simultaneities
- rests
- durations
- optional local timing and layer organization
- optional harmonic-guidance strings

The canonical input does not contain harmonic structure. Harmonic structure is derived by the harmonic engine.

## Output contract

The harmonic engine emits harmonic structure. In the current code, that shape is `HarmonicStructure`, with one harmonic structure per input segment.

Each harmonic segment contains:

- `regions`: zero or more non-wrapping principal harmonic regions for the segment
- `center`: structurally central pitch classes
- `grounding`: optional grounding pair with `root` and `ground`

`regions` are simple non-wrapping spans with `start <= end`.

`center` names the structurally central pitch classes within that harmonic structure.

`grounding` orients that harmonic structure without reducing the result to a single chord symbol.

## Engine principles

The harmonic engine follows these principles:

- Preserve authored input and derive harmonic structure later.
- Treat harmonic guidance as evidence, not authority.
- Keep event evidence and guidance evidence distinct internally for as long as practical.
- Settle local harmonic structure into a stable canonical form.
- Derive harmonic structure rather than only a chord symbol.
- Distinguish regions from center material within that harmonic structure.
- Distinguish central from peripheral harmonic material.
- Keep grounding explicit when it can be inferred.
- Fail gracefully: malformed harmonic guidance or weak harmonic evidence should not break the harmonic engine.

## Current process

The current harmonic engine is local and deterministic. It processes segments independently. This section describes the current implementation flow, not a permanent algorithmic guarantee.

For each segment:

1. Collect event pitch-class evidence from notes and simultaneities.
2. Normalize the optional harmonic guidance into guidance pitch-class evidence plus optional root and ground grounding.
3. Choose region evidence, preferring event evidence when events are present and falling back to guidance evidence otherwise.
4. Derive a small set of non-wrapping harmonic regions from the chosen evidence.
5. Derive `center` material from event evidence first, using guidance evidence as support.
6. Derive `grounding` from trusted guidance grounding when possible, otherwise use a simple region-based fallback.
7. Emit the segment’s canonical harmonic structure.
