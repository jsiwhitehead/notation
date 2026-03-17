# Render

This document defines the downstream stage after the harmonic engine. It takes canonical input together with harmonic structure, builds placement, and renders it.

## Inputs

This stage consumes two inputs:

- canonical input
- harmonic structure

`docs/engine.md` is authoritative for the harmonic-engine contract. This document only defines placement and rendering.

## Principles

The following aspects of placement and rendering appear stable in this repository:

- placement and rendering remain distinct stages
- harmonic structure and events stay together through placement and rendering
- placement produces one placed result
- durations, simultaneity, and rests survive through placement into rendering
- harmonic structure and events should appear together, not as two diagrams
- rendering is not the harmonic engine
- rendering may expand harmonic structure visually without changing placement
- rendering may vary widely in style while still showing the same placement

## Placement

Placement combines canonical input with harmonic structure into a placed result.

In the current code, that shape is `Placement`, which currently contains:

- `minPitch` and `maxPitch` for the visible pitch range
- ordered segments
- for each segment: non-wrapping harmonic `fields`, `centerPitchClasses`, optional `grounding`, `positionedEvents`, and `totalDuration`

Placement is responsible for:

- preserving authored durations
- preserving explicit offsets when present
- inferring local offsets when they are not authored explicitly
- preserving simultaneity
- preserving rests
- carrying fields, center material, and grounding forward for rendering
- determining the local pitch range used for rendering

Placement turns canonical input plus harmonic structure into a placed result. It is not rendering.

The current placement stage:

1. derives a visible pitch range from events
2. computes event offsets layer by layer when offsets are not explicitly authored
3. preserves durations and simultaneities in the resulting positioned events
4. assigns a local rest pitch from the middle of the visible range
5. carries forward non-wrapping harmonic fields, center pitch classes, and optional grounding
6. emits placement as the unified structure consumed by the renderer

## Rendering

Rendering takes placement and renders it.

The current renderer emits a simple SVG score view.

Rendering is responsible for:

- drawing harmonic structure and events as one object
- turning placement into screen geometry
- making duration, silence, and harmonic orientation legible
- choosing a visible notation language without changing placement

Rendering is the final stage. It is not the harmonic engine.

It currently:

1. establishes score geometry from the placement pitch range and segment count
2. draws a background grid and segment boundaries
3. renders fields as background blocks across the visible pitch range
4. renders center material as horizontal marks across the visible pitch range
5. renders grounding as distinct root and ground marks
6. renders events from positioned offsets and durations
7. emits a simple SVG score view

In the current implementation, visible octave-range repetition is handled in rendering rather than in placement.
