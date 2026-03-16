# Render

This document defines the downstream stage after the harmonic engine. It takes authored event material from canonical input together with canonical harmonic structure from the engine, places those events into that field, and renders the resulting musical object visibly.

## Inputs

This stage consumes two inputs:

- canonical event material from the authored input model
- canonical harmonic structure from the engine

`engine.md` is authoritative for the harmonic-engine contract. This document only defines how that harmonic output is combined with authored events for placement and rendering.

## Principles

The following aspects of placement and rendering appear stable across the current code and the earlier codebases:

- placement and rendering remain distinct stages
- harmonic structure is the bed into which authored events are placed
- placement produces one unified musical object for rendering
- durations, simultaneity, and rests survive through placement into rendering
- harmonic structure and event material should appear as one musical object
- rendering is projection rather than analysis
- rendering may expand harmonic structure visually without changing the underlying placed object

## Placement

Placement combines authored event material with harmonic structure into one unified placed musical object.

That unified object is represented in the current code as `Placement`.

In the current code, `Placement` contains:

- `minPitch` and `maxPitch` for the visible pitch range
- ordered placed segments
- for each segment: non-wrapping harmonic `regions`, `corePitchClasses`, optional `grounding`, `positionedEvents`, and `totalDuration`

Placement is responsible for:

- preserving authored durations
- preserving explicit offsets when present
- inferring local offsets when they are not authored explicitly
- preserving simultaneity
- preserving rests
- carrying harmonic regions, core material, and grounding forward for projection
- determining the local pitch range used for projection

Placement turns authored events plus harmonic structure into coherent positioned musical material. It is not visual styling.

The current placement stage:

1. derives a visible pitch range from the authored events
2. computes event offsets layer by layer when offsets are not explicitly authored
3. preserves durations and simultaneities in the resulting positioned events
4. assigns a local rest pitch from the middle of the visible range
5. carries forward non-wrapping harmonic regions, core pitch classes, and optional grounding
6. emits `Placement` as the unified structure consumed by the renderer

The current placement stage does not yet perform continuity-aware register choice or leading-based event placement.

## Rendering

Rendering takes the placed musical object and projects it visibly.

The current renderer emits a simple SVG score view.

Rendering is responsible for:

- drawing the harmonic field and event material as one object
- projecting placement into concrete screen geometry
- making duration, silence, and harmonic orientation legible
- choosing a visible notation language without changing the underlying placed structure

Rendering is not harmonic analysis. It is projection.

It currently:

1. establishes score geometry from the placement pitch range and segment count
2. draws a background grid and segment boundaries
3. projects harmonic regions as background blocks across the visible pitch range
4. projects core material as horizontal marks across the visible pitch range
5. projects grounding as distinct root and base marks
6. projects authored events from positioned offsets and durations
7. emits a simple SVG score view

In the current implementation, visible octave-range repetition of harmonic structure is handled in rendering rather than in placement.

## Open areas

The following parts of placement and rendering remain intentionally open:

- how much placement should reflect melodic continuity or nearest-note continuation
- how vertical or register placement should be chosen beyond explicitly authored pitch
- how much visible harmonic repetition belongs to placement versus rendering
- how much cross-segment continuity should be made visible
- how conventional or abstract the rendered notation language should be
- how much visual detail should be used for duration, rests, and harmonic structure
- what alternate projection styles should be supported for the same placed object

Earlier codebases explored richer variants in these areas, including:

- continuity-aware register placement
- stronger leading or nearest-motion behavior
- harmonic shapes that connected across neighboring segments
- block-based, rail-based, strip-based, and more notation-like projections
- color and intensity systems derived from harmonic identity

Durable lessons from those experiments:

- placement and rendering should remain distinct stages
- harmonic structure and authored events should appear as one object, not two diagrams
- duration, simultaneity, and silence should survive through placement into rendering
- rendering may vary widely in style while still projecting the same underlying placed structure
