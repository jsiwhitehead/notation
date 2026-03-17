# Render

This document defines the downstream stages after the harmonic engine. It takes canonical input together with harmonic structure, builds projection, and renders it.

## Inputs

This stage consumes two inputs:

- canonical input
- harmonic structure

`docs/engine.md` is authoritative for the harmonic-engine contract. This document only defines projection and rendering.

## Principles

The following aspects of projection and rendering appear stable in this repository:

- projection and rendering remain distinct stages
- harmonic structure and events stay together through projection and rendering
- projection produces one projected result
- durations, simultaneity, and rests survive through projection into rendering
- harmonic structure and events should appear together, not as two diagrams
- rendering is not the harmonic engine
- rendering may expand harmonic structure visually without changing projection
- rendering may vary widely in style while still showing the same projection

## Projection

Projection combines canonical input with harmonic structure into the render-ready result.

In the current code, that shape is `Projection`, which currently contains:

- `minPitch` and `maxPitch` for the visible pitch range
- ordered segments
- for each segment: singular harmonic `field`, singular harmonic `center`, optional `grounding`, `events`, and `totalDuration`

Projection is responsible for:

- preserving authored durations
- preserving explicit offsets when present
- inferring local offsets when they are not authored explicitly
- preserving simultaneity
- preserving rests
- carrying field, center, and grounding forward for rendering
- determining the visible pitch range used for rendering

Projection turns canonical input plus harmonic structure into the render-ready result. It is not rendering.

The current projection stage:

1. derives a visible pitch range from events
2. computes event offsets layer by layer when offsets are not explicitly authored
3. preserves durations and simultaneities in the resulting events
4. assigns a local rest pitch from the middle of the visible range
5. carries forward singular harmonic field, singular harmonic center, and optional grounding
6. emits projection as the unified structure consumed by the renderer

## Rendering

Rendering takes projection and renders it.

The current renderer emits a simple SVG score view.

Rendering is responsible for:

- drawing harmonic structure and events as one object
- turning projection into screen geometry
- making duration, silence, and harmonic orientation legible
- choosing a visible notation language without changing projection

Rendering is the final stage. It is not the harmonic engine.

It currently:

1. establishes score geometry from the projection pitch range and segment count
2. draws a background grid and segment boundaries
3. projects each singular harmonic field back into visible pitch-space spans and renders them as background blocks across the visible pitch range
4. renders center material as horizontal marks across the visible pitch range
5. renders grounding as distinct root and ground marks
6. renders events from projected offsets and durations
7. emits a simple SVG score view

In the current implementation, visible octave-range repetition and visible field-span expansion are handled in rendering rather than in projection.

The current field-span expansion is intentionally simple. It approximates visible pitch-space spans from the harmonic region’s pitch classes rather than carrying a richer projection contract forward from the engine.
