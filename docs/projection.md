# Projection

This document defines the projection stage after the harmony stage. It takes canonical input together with harmonic structure and emits a unified, render-ready projection in visible pitch-space.

## Inputs

This stage consumes two inputs:

- canonical input
- harmonic structure

`docs/harmony.md` is authoritative for the harmony-stage contract. This document only defines projection.

## Principles

The following aspects of projection appear stable in this repository:

- projection remains distinct from both the harmony stage and rendering
- harmonic structure and events stay together through projection
- projection produces one projected result
- durations, simultaneity, and rests survive through projection
- projection owns the musical pitch-space placement needed for rendering
- carried harmonic structure remains analysis-native while projected placement becomes pitch-space-native

Projection takes analysis-native harmonic structure from the harmony stage and turns it into visible pitch-space structure. Rendering is the next stage after projection and is responsible only for visual realization.

## Contract

Projection combines canonical input with harmonic structure into the render-ready result.

In the current code, that shape is `Projection`, which currently contains:

- `minPitch` and `maxPitch` for the visible pitch range
- ordered segments
- for each segment: preserved `events`, ordered `timePositions`, `segmentWidthUnits`, `totalDuration`, segment-level visible defaults, and render-ready `harmonicSlices`

Segment-level visible defaults currently contain:

- a rest anchor

`harmonicSlices` currently contains one or more variable-length projected harmonic slices per segment. Each slice currently contains:

- `startOffset`
- `duration`
- carried slice-local harmonic structure with `field`, `center`, and optional `grounding`
- projected `field` region span objects
- projected `center` region span objects
- optional projected grounding overlay data for projected `root` and `ground` marks

Projection derives those render-ready slices from the `harmonicSlices` already carried by harmony-stage output and preserves that slice timing when converting the analysis into segment-local x extents.

Harmony-stage `HarmonicSlice` currently contains:

- `startOffset`
- `duration`
- `harmonic`

Projected events currently also carry their resolved `layer`, preserved offset and duration timing, and a segment-local x-position derived from projection-owned time-position spacing. Ordered `timePositions` expose the shared onset structure that spacing is built from, and `segmentWidthUnits` carries the segment-level width demand derived from that spacing in projection-local layout units. Harmonic slices use segment-local timing together with those shared time positions to determine render-time horizontal extent inside the segment.

For pitched events, projection also carries explicit field-span ownership for each projected pitch. That ownership is resolved against the projected slice-local field spans and stored as plain owned span bounds, so rendering does not need to infer notehead attachment from slice timing and pitch content a second time.

Each projected harmonic region currently contains:

- ordered projected spans in visible pitch-space
- optional `prev` and `next` neighboring span geometry on each projected span when projection determines an adjacent join

Projected spans are render-facing geometry objects. In the current implementation they may extend beyond the nominal visible window because projection repeats whole spans rather than clipping spans partway through.

## Responsibilities

Projection is responsible for:

- preserving authored durations
- preserving explicit offsets when present
- inferring local offsets when they are not authored explicitly
- preserving simultaneity
- preserving rests
- carrying slice-local harmonic structure forward from harmony-stage output
- choosing render-ready pitch-space placements for harmonic spans and marks
- assigning explicit projected field-span ownership for pitched events
- choosing stable segment-level visible defaults for sparse material
- determining the visible pitch range used for rendering

Projection turns canonical input plus harmonic structure into the render-ready result. It is not rendering.

## Current implementation

This section describes the current projection implementation. It is an implementation note, not a permanent architectural guarantee.

In the current implementation, projection:

1. derives a visible pitch range from events
2. computes event offsets layer by layer when offsets are not explicitly authored
3. preserves durations, layer identity, and simultaneities in the resulting events
4. derives ordered shared time positions from event offsets inside each segment
5. computes simple segment-local x-positions for projected events from those shared time positions
6. derives a simple segment width from time-position spacing demand
7. chooses one shared visible window for the piece and a local rest anchor per segment
8. consumes harmony-stage segment-local harmonic slice analysis, including canonical harmonic lane spans
9. repeats those harmonic spans as whole spans across the visible window rather than clipping spans partway through
10. preserves projected harmonic spans as render-facing span objects, including degenerate zero-height spans
11. resolves adjacent-span joins inside projection and attaches neighboring span geometry directly to projected spans
12. allows those neighboring span geometries to extend beyond the nominal visible window when a full-span continuation falls just above or below it
13. derives projected `root` and `ground` marks from `grounding` within the segment's projected harmonic span extent when grounding is present
14. emits one or more variable-length `harmonicSlices` per segment from harmony-stage `HarmonicSlice` analysis, with one full-segment slice when no stronger local split is warranted
15. carries forward slice-local harmonic field, slice-local harmonic center, and optional grounding
16. assigns explicit owning field spans to pitched event notes from those projected harmonic slices
17. emits projection as the unified structure consumed by the renderer

In the current implementation, projection does not decide harmonic slice boundaries or baseline harmonic region shape itself. It consumes harmony-stage `HarmonicSlice` analysis, converts slice timing into segment-local x extents, repeats harmony-stage harmonic span classes into visible pitch-space, resolves visible join geometry between adjacent projected regions, and assigns projected event ownership against those already-projected harmonic spans.
