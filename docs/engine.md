# Engine

This document defines the harmonic engine as it exists in this repository. It takes canonical input, derives harmonic structure for each segment, and passes that structure to projection and rendering.

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

- `field`: a singular harmonic region in fifths-space that describes the broader local harmonic context
- `center`: a singular harmonic region in fifths-space that describes the immediate harmonic settlement
- `grounding`: optional grounding pair with `root` and `ground` that primarily orients the `center`

`field` and `center` are represented as ordered pitch-class collections in fifths-space. They are analysis-native harmonic objects rather than renderer-facing pitch-space spans.

`center` and `field` are the same kind of object inferred at different scopes. In the simplest cases they may be identical.

`grounding` orients the `center` without reducing the result to a single chord symbol. `root` names the harmonic orientation within the `center`; `ground` names the actual supporting ground or bass orientation when it differs.

## Engine principles

The harmonic engine follows these principles:

- Preserve authored input and derive harmonic structure later.
- Treat harmonic guidance as evidence, not authority.
- Prefer clear local evidence boundaries even when the current implementation uses simple merged evidence for some decisions.
- Settle local harmonic structure into a stable canonical form in fifths-space before any downstream pitch-space projection.
- Derive harmonic structure rather than only a chord symbol.
- Use one harmonic logic for both `center` and `field`, varying evidence scope rather than ontology.
- Keep grounding explicit when it can be inferred, primarily at the `center` level.
- Fail gracefully: malformed harmonic guidance or weak harmonic evidence should not break the harmonic engine.

## Current process

The current harmonic engine is local and deterministic. It processes segments independently. This section describes the current implementation flow, not a permanent algorithmic guarantee.

For each segment:

1. Collect event pitch-class evidence from notes and simultaneities.
2. Normalize the optional harmonic guidance into guidance pitch-class evidence plus optional root and ground grounding.
3. Derive `center` from event evidence when available, otherwise from guidance evidence.
4. Derive `grounding` for that `center` from trusted guidance grounding when possible, otherwise use a simple center-based fallback.
5. Derive a broader `field` from the combined local evidence available for that segment.
6. Emit the segment’s canonical harmonic structure in fifths-space.
