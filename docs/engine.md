# Engine

This document defines the harmonic engine as it exists in this repository. It takes canonical input, derives harmonic structure for each segment, and passes that structure to projection and rendering.

## Canonical input

In the current code, the harmonic engine consumes a simple canonical input:

- `PieceInput`
- ordered `SegmentInput[]`
- `EventInput[]` inside each segment
- optional `chordSymbol` string on each segment
- optional `timeSignature` on each segment

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
- optional segment-local meter declarations
- optional chord-symbol strings interpreted as local harmonic evidence

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
- Treat chord symbols as local harmonic evidence for the current segment. In the current baseline, a chord symbol contributes local pitch classes and optional root/ground grounding.
- Prefer clear local evidence boundaries even when the current implementation uses simple merged evidence for some decisions.
- Settle local harmonic structure into a stable canonical form in fifths-space before any downstream pitch-space projection.
- Derive harmonic structure rather than only a chord symbol.
- Use one fifths-space harmonic orientation for both `center` and `field`, while allowing local settlement and broader continuity to play different roles.
- Keep grounding explicit when it can be inferred, primarily at the `center` level.
- Fail gracefully: malformed chord symbols or weak harmonic evidence should not break the harmonic engine.

Projection is the next stage after the engine. It takes the analysis-native harmonic structure emitted here and organizes it into visible pitch-space for rendering.

## Current implementation

The current harmonic engine is local and deterministic. It derives each segment’s `center` from current-segment evidence, then uses adjacent locally settled centers when broadening `field`. This section describes the current implementation, not a permanent architectural guarantee.

The current implementation runs in two passes:

1. Collect event pitch-class evidence from notes and simultaneities.
2. Normalize the optional chord symbol into one committed chord-derived pitch-class set plus optional root and ground grounding.
3. Combine event evidence and chord-derived evidence into the local harmonic evidence for the current segment.
4. Derive a local `center` from that local evidence and apply conservative fifths-space filling when the local evidence is strong enough to justify filling short internal fifth-gaps.
5. Derive `grounding` for that `center` from trusted chord-symbol grounding when possible, otherwise use a simple center-based fallback.
6. Derive a broader `field` from continuity across adjacent locally settled centers.
7. Emit the segment’s canonical harmonic structure in fifths-space.

`center` is therefore the immediate local settlement for a segment: a fifths-space region derived from the local notes available at that moment, including notes provided by the chord symbol. In the current baseline, short internal fifth-gaps may be filled, but structurally invalid chromatic clustering is rejected. `field` is broader local context: it is widened mainly by continuity across neighboring centers rather than by direct pitch-space expansion. The engine still emits harmonic regions only; pitch-space spans remain projection responsibilities.

For the current baseline, chord-symbol normalization contributes a single committed set of local pitch classes. The engine does not yet model a second level of chord-implied support such as a probable but defeasible fifth separate from committed chord-symbol content.
