# Projection

This document defines the projection stage after the harmonic engine. It takes canonical input together with harmonic structure and emits a unified, render-ready projection in visible pitch-space.

## Inputs

This stage consumes two inputs:

- canonical input
- harmonic structure

`docs/engine.md` is authoritative for the harmonic-engine contract. This document only defines projection.

## Principles

The following aspects of projection appear stable in this repository:

- projection remains distinct from both the harmonic engine and rendering
- harmonic structure and events stay together through projection
- projection produces one projected result
- durations, simultaneity, and rests survive through projection
- projection owns the musical pitch-space placement needed for rendering
- carried harmonic structure remains analysis-native while projected placement becomes pitch-space-native

Projection takes analysis-native harmonic structure from the engine and turns it into visible pitch-space structure. Rendering is the next stage after projection and is responsible only for visual realization.

## Contract

Projection combines canonical input with harmonic structure into the render-ready result.

In the current code, that shape is `Projection`, which currently contains:

- `minPitch` and `maxPitch` for the visible pitch range
- ordered segments
- for each segment: preserved `events`, `totalDuration`, carried harmonic structure, and a render-ready `placement`

The carried harmonic structure remains analysis-native and currently contains:

- singular harmonic `field`
- singular harmonic `center`
- optional `grounding`

`placement` currently contains:

- a shared visible window carried on each segment placement
- a rest anchor
- projected field spans
- projected center spans
- projected grounding marks that still distinguish `root` and `ground`

## Responsibilities

Projection is responsible for:

- preserving authored durations
- preserving explicit offsets when present
- inferring local offsets when they are not authored explicitly
- preserving simultaneity
- preserving rests
- carrying field, center, and grounding forward as analysis-native harmonic structure
- choosing render-ready pitch-space placements for harmonic spans and marks
- choosing stable segment-level visible defaults for sparse material
- determining the visible pitch range used for rendering

Projection turns canonical input plus harmonic structure into the render-ready result. It is not rendering.

## Current implementation

This section describes the current projection implementation. It is an implementation note, not a permanent architectural guarantee.

In the current implementation, projection:

1. derives a visible pitch range from events
2. computes event offsets layer by layer when offsets are not explicitly authored
3. preserves durations and simultaneities in the resulting events
4. chooses one shared visible window for the piece and a local rest anchor per segment
5. projects harmonic field spans, center spans, and grounding marks into visible pitch-space
6. carries forward singular harmonic field, singular harmonic center, and optional grounding
7. emits projection as the unified structure consumed by the renderer
