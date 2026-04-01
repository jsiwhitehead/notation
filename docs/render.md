# Render

This document defines the rendering stage after projection. It takes a completed projection and renders it into the current visual output.

## Input

This stage consumes one input:

- projection

`docs/projection.md` is authoritative for the projection contract. This document only defines rendering.

## Principles

The following aspects of rendering appear stable in this repository:

- rendering remains distinct from both the harmony stage and projection
- rendering consumes one unified projection rather than separate musical diagrams
- rendering is responsible for visual realization, not musical inference
- rendering may vary widely in style while still showing the same projection
- rendering SHOULD build intermediate graphic objects and positioned graphic objects before emitting output

Rendering takes a completed projection and turns it into visible output. Unlike projection, it does not choose musical pitch-space placement.

## Responsibilities

Rendering is responsible for:

- drawing harmonic structure and events as one object
- turning projection into screen geometry
- making duration, silence, and harmonic orientation legible
- choosing a visible notation language without changing projection

Rendering is the final stage. It is not the harmony stage. It is not projection.

## Current implementation

This section describes the current rendering implementation. It is an implementation note, not a permanent architectural guarantee.

The repository currently contains one renderer implementation, which emits a simple SVG score view.

In the current implementation, rendering:

1. establishes notation and system layout from the projection pitch range, segment count, and projected segment widths
2. builds region graphics from projected harmonic slices, including spans, notches, and grounding marks
3. positions those region graphics into SVG-ready geometry and then emits them as SVG paths and rects
4. draws a simple white seam between adjacent segments as a renderer-level visual divider
5. builds event graphics from projected events, including pitched-event notehead geometry, explicit projected field-span ownership bounds, and rest glyph selection
6. positions those event graphics, then emits noteheads, rests, stems, flags, dots, and beam groups
7. renders projection-resolved joins from the rightward `join` metadata carried on each projected span, including joins that connect span bodies across slice and segment boundaries
8. derives harmonic hue from one shared 24-step fifth-color wheel with a matched dark companion palette
9. assembles each system through a focused render-system helper that owns paint-order group setup, region/event emission, and segment seams
10. emits a simple SVG score view through `renderNotationSvg(...)`

In the current implementation, octave-range repetition, whole-span expansion, join determination, grounding-mark placement, harmonic-slice timing, explicit note-to-field-span ownership, basic event x-position spacing demand, and segment width demand are projection responsibilities. Rendering derives final slice-local screen spacing from the projected event timing structure, then turns those pitch-space decisions into screen geometry and visual legibility. Harmonic color, join geometry, and the segment seam are renderer-level styling derived from projected pitch and region content. Pitched notes that do not own a projected field span are rendered with a short ledger-line-style horizontal mark behind the white notehead fill.
