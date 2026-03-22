# Render

This document defines the rendering stage after projection. It takes a completed projection and renders it into the current visual output.

## Input

This stage consumes one input:

- projection

`docs/projection.md` is authoritative for the projection contract. This document only defines rendering.

## Principles

The following aspects of rendering appear stable in this repository:

- rendering remains distinct from both the harmonic engine and projection
- rendering consumes one unified projection rather than separate musical diagrams
- rendering is responsible for visual realization, not musical inference
- rendering may vary widely in style while still showing the same projection

Rendering takes a completed projection and turns it into visible output. Unlike projection, it does not choose musical pitch-space placement.

## Responsibilities

Rendering is responsible for:

- drawing harmonic structure and events as one object
- turning projection into screen geometry
- making duration, silence, and harmonic orientation legible
- choosing a visible notation language without changing projection

Rendering is the final stage. It is not the harmonic engine. It is not projection.

## Current implementation

This section describes the current rendering implementation. It is an implementation note, not a permanent architectural guarantee.

The repository currently contains one renderer implementation, which emits a simple SVG score view.

In the current implementation, rendering:

1. establishes score geometry from the projection pitch range and segment count
2. renders projected field spans as combined SVG path shapes, including any projection-resolved half-joins
3. renders projected center material as combined SVG path shapes, including any projection-resolved half-joins
4. draws a simple white seam between adjacent segments as a renderer-level visual divider
5. renders projection-resolved joins between adjacent field and center spans from the absolute neighboring span geometry carried on each projected span
6. renders projected grounding as uniform short grounding blocks, even though projection still distinguishes `root` and `ground`
7. derives harmonic hue from one shared 24-step fifth-color wheel with a matched dark companion palette
8. uses projection-provided segment-local event x-positions and projected segment width units, and converts those width units into renderer px geometry
9. shapes events from projected durations into duration-aware noteheads, rests, stems, simple chord displacement, and unbeamed up-flags, then draws that geometry into SVG
10. emits a simple SVG score view

In the current implementation, octave-range repetition, whole-span expansion, join determination, grounding-mark placement, simple event x-position spacing, and segment width demand are projection responsibilities. Harmonic color, join geometry, and the segment seam are renderer-level styling derived from projected pitch and region content. The renderer consumes those pitch-space decisions and focuses on screen geometry and visual legibility.
