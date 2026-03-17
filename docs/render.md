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
2. draws a background grid and segment boundaries
3. renders projected field spans as background blocks across the visible pitch range
4. renders projected center material as a narrower nested span treatment across the visible pitch range
5. renders projected grounding as distinct root and ground marks
6. renders events from projected offsets and durations
7. emits a simple SVG score view

In the current implementation, octave-range repetition, region-span expansion, and grounding-mark placement are projection responsibilities. The renderer consumes those pitch-space decisions and focuses on screen geometry and visual legibility.
