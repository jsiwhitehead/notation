# Projection

This document defines the projection stage. Projection combines canonical authored input with harmonic structure and emits a unified render-ready musical representation in visible pitch-space. It is the bridge between analysis-native musical structure and visual realization.

## Inputs

Projection consumes two inputs:

- canonical authored input
- harmonic structure

`docs/harmony.md` defines the harmony-stage contract consumed here.

Projection keeps authored events and derived harmonic structure together, chooses visible pitch-space placement, preserves shared temporal structure, and emits one unified representation for rendering.

## Projection contract

Projection emits `Projection`.

`Projection` contains:

- `minPitch` and `maxPitch` for the visible pitch range
- ordered projected segments

Each projected segment contains:

- preserved `events`
- ordered `timePositions`
- `segmentWidthUnits`
- `totalDuration`
- optional `timeSignature`
- optional `globalHighlightPitch`
- segment-level visible defaults
- projected `harmonicSlices`

Segment-level visible defaults include:

- a rest anchor

Projected `harmonicSlices` contain one or more segment-local projected harmonic slices. Each slice carries:

- `startOffset`
- `duration`
- `startX`
- `endX`
- `touchesSegmentStart`
- `touchesSegmentEnd`
- the slice-local harmonic structure with `field`, `center`, and optional `grounding`
- projected `field` region span objects
- projected `center` region span objects
- optional projected grounding overlay data for projected `root` and `ground` marks

Projection derives those slices from the `harmonicSlices` produced by harmony and preserves that slice timing when converting analysis into segment-local horizontal extent.

Projected events carry:

- resolved `layer`
- preserved offset and duration timing
- a segment-local x-position derived from projection-owned time-position spacing
- explicit projected pitch ownership data for pitched events

Ordered `timePositions` expose the shared onset structure that spacing is built from. `segmentWidthUnits` carries the segment-level width demand derived from that timing structure in projection-local layout units.

`globalHighlightPitch`, when present, is a piece-level projected emphasis pitch repeated on projected segments for downstream rendering use.

`timeSignature`, when present, is carried forward from canonical authored input for downstream rendering and rhythmic grouping.

## Projection principles

Projection follows these principles:

- projection remains distinct from both harmony and rendering
- harmonic structure and authored events stay together through projection
- durations, simultaneity, rests, and layer identity survive through projection
- projection owns visible pitch-space placement needed by rendering
- projection carries analysis-native harmonic structure forward while converting placement into render-facing pitch-space terms
- ownership and attachment decisions that rendering should not rediscover are made explicit in projection

## Time structure

Projection owns shared segment-local time structure for rendering.

It:

- preserves explicit offsets when they are authored
- infers local offsets when they are not authored explicitly
- derives ordered shared time positions from event timing
- derives segment-level width demand from those shared time positions
- uses slice timing together with shared time positions to determine horizontal extent within the segment

Projection therefore turns authored and inferred timing into a stable layout-facing musical time model without becoming a renderer.

## Pitch-space and harmonic placement

Projection owns visible pitch-space placement.

It:

- determines the visible pitch range used for rendering
- chooses render-ready pitch-space placements for harmonic spans and marks
- carries forward slice-local harmonic structure from harmony-stage output
- converts harmony-stage harmonic regions into projected span objects in visible pitch-space
- preserves projected joins between adjacent spans where harmonic continuation should remain explicit

Projected spans are render-facing geometry objects. They are the pitch-space realization of analysis-native harmonic regions, not new harmonic inferences.

Projection also owns several stable defaulting policies used by downstream rendering:

- one visible pitch window for the projected piece, with fallback defaults when material is sparse
- segment- and layer-local rest anchors derived from projected pitch material
- minimum vertical separation between rest anchors in different layers
- one optional piece-level projected emphasis pitch carried as `globalHighlightPitch`

## Ownership and attachment

Projection makes note-to-harmony ownership explicit.

For pitched events, projection carries explicit field-span ownership for each projected pitch. That ownership is resolved against projected slice-local field spans and stored directly on the projected event so rendering does not need to infer note attachment from timing and pitch content a second time.

This explicit ownership contract is part of projection’s architectural role: it is where analysis and event structure are unified into render-ready musical relationships.

## Stage boundary

Projection preserves authored durations, preserves or infers event offsets, preserves simultaneity, rests, and layers, carries slice-local harmonic structure forward from harmony, carries piece-level projected emphasis data needed by rendering, chooses stable segment-level visible defaults for sparse material, and emits one unified render-ready representation for rendering.

Projection does not derive harmonic structure from authored input, redefine harmonic slice boundaries already established by harmony, or turn projected structures directly into screen geometry. Renderer-specific drawing, styling, and paint-order decisions remain downstream.

Projection is therefore the last musical representation in the pipeline before visual realization. In code, that representation is `Projection`.

Future downstream work may introduce richer graphic or layout-side representations without changing that role or blurring the harmony, projection, and rendering boundaries.
