# Harmony

This document defines the harmony stage of the system. It takes canonical authored input, derives harmonic structure for each segment, and passes analysis-native harmonic objects downstream to projection.

## Inputs

The harmony stage consumes canonical authored input:

- `PieceInput`
- ordered `SegmentInput[]`
- `EventInput[]` inside each segment
- optional timed `chordSymbols` entries on each segment, each with `offset` and `symbol`
- optional `timeSignature` on each segment

`EventInput` covers:

- `note`
- `chord`
- `rest`

Canonical authored input contains authored musical material only:

- notes
- chord events
- rests
- durations
- optional local timing and layer organization
- optional segment-local meter declarations
- optional chord symbol strings interpreted as local harmonic evidence
- optional timed chord symbol changes interpreted as local harmonic evidence

Canonical authored input does not contain derived harmonic structure.

## Harmonic structure

The harmony stage emits `HarmonicStructure`, with one harmonic structure per input segment.

Each harmonic segment contains:

- `field`: a harmonic region in fifths-space describing the broader local harmonic context
- `center`: a harmonic region in fifths-space describing the immediate local harmonic settlement
- `grounding`: an optional grounding pair with `root` and `ground` that orients the `center`
- `harmonicSlices`: one or more segment-local slice analyses, each carrying `startOffset`, `duration`, and a slice-local harmonic segment

`field` and `center` are represented as harmonic spans. They remain analysis-native harmonic objects rather than render-facing pitch-space spans. Pitch-class collections may be derived from those spans for scoring, comparison, and coloring.

`center` and `field` are the same kind of object inferred at different scopes. In the present system they often coincide exactly, but they are not conceptually interchangeable.

`grounding` orients the `center` without reducing the result to a single chord symbol. `root` names the harmonic orientation within the `center`; `ground` names the actual supporting ground or bass orientation when it differs.

`HarmonicSlice` is a segment-local timing object:

- `startOffset`
- `duration`
- `harmonic`

Projection is the next stage after harmony. It consumes the analysis-native harmonic structure defined here and organizes it into visible pitch-space for rendering.

## Harmony principles

The harmony stage follows these principles:

- preserve authored input and derive harmonic structure later
- derive harmonic structure rather than only a chord label
- treat chord symbols as local harmonic evidence rather than as replacements for sounded evidence
- settle local harmonic structure into canonical fifths-space before downstream pitch-space projection
- keep baseline region-shape validity and harmonic-lane interpretation in the harmony stage rather than rediscovering them downstream
- use one fifths-space harmonic language for both `center` and `field`, while allowing local settlement and broader continuity to play different roles
- keep grounding explicit when it can be inferred, primarily at the `center` level
- prefer clear local evidence boundaries
- fail gracefully when evidence is weak or chord symbol input is malformed

## Evidence and derivation

Harmony is derived from local segment evidence.

The evidence model combines:

- pitch-class evidence from notes and chord events
- optional pitch-class evidence implied by active chord symbols
- optional grounding implied by trusted chord symbol interpretation
- authored durations, which weight local evidence over time

Chord symbols contribute committed local pitch-class content for the duration they govern. They may also contribute `root` and `ground` orientation when that grounding is unambiguous.

The harmony stage derives a local `center` from weighted local evidence and expresses that result as a span-based harmonic region in fifths-space. The stage also emits `field`, using the same harmonic object type at a broader interpretive scope even when `field` and `center` coincide.

## Region finding

Harmony derives span-based regions from duration-weighted local evidence.

That process:

- weights local pitch classes by authored duration
- combines sounded pitch-class evidence with active chord symbol evidence
- evaluates candidate harmonic regions against that weighted evidence
- prefers valid span-based regions in fifths-space rather than arbitrary pitch-class collections

The harmony stage therefore does not merely collect pitch classes and wrap them in spans. It selects a harmonic region shape that fits weighted local evidence while preserving the region rules used by the system.

When direct local evidence does not strongly support one ideal region, the stage still aims to emit a valid span-based harmonic result rather than failing the analysis entirely.

`field` currently uses the same region content as `center`, while remaining conceptually distinct in role.

## Slice analysis

Harmony is allowed to vary within a segment.

`harmonicSlices` represent segment-local harmonic timing. Each slice carries its own local harmonic segment together with the segment-local time interval that it governs.

Slice boundaries come from one of two sources:

- authored timed chord symbol changes
- inferred local contrast strong enough to justify an intra-segment split

When no stronger local split is warranted, one full-segment slice is used.

When slice boundaries are inferred rather than authored, the stage evaluates candidate split points from local event timing and accepts a split only when the resulting slice analyses improve harmonic fit enough to justify the extra segmentation.

## Grounding

`grounding` is part of harmonic analysis, not a late rendering annotation.

It primarily orients `center`:

- `root` identifies the harmonic orientation named within the center
- `ground` identifies the actual supporting ground or bass orientation when it differs

Grounding may be present at the segment level, the slice level, or both, depending on where the evidence is unambiguous.

## Weak evidence behavior

The harmony stage is conservative under weak evidence.

It does not require every segment to arrive through one ideal evidence path, and it does not let malformed chord symbols break the stage. When direct local evidence is weak or incomplete, the stage still aims to emit a valid harmonic region rather than failing the entire analysis.

This contract matters more than any particular fallback search or scoring heuristic.

## Locality

Harmony is derived locally from segment material and segment-local slice windows.

This keeps the harmony-stage contract focused:

- the stage reasons from local evidence
- it emits local harmonic structure
- downstream stages inherit that structure rather than recomputing it

Broader cross-segment tonal interpretation, alternate policies, and richer ambiguity handling belong to future refinement of the harmony stage without changing its role in the architecture.
