# Render

This document defines the rendering stage. Rendering takes a completed projection and turns it into visible output.

## Inputs

Rendering consumes one input:

- projection

`docs/projection.md` defines the projection contract consumed here.

Rendering consumes one unified projection, turns that projection into graphic objects and positioned graphic objects, and emits visible output. It may choose notation style, screen geometry, and visual emphasis, but it does not redefine harmonic structure, pitch-space placement, ownership, or shared time structure already established upstream.

## Rendering principles

Rendering follows these principles:

- rendering remains distinct from both harmony and projection
- rendering consumes one unified projection rather than separate musical diagrams
- rendering is responsible for visual realization, not musical inference
- rendering may vary in style while still showing the same projection
- rendering builds graphic objects and positioned graphic objects before emitting output
- drawing happens after layout decisions are established
- paint order is explicit

## Graphic and positioned graphic orientation

Within rendering, the architectural direction is:

`projection -> graphic objects -> positioned graphic objects -> output`

That means:

- projection-provided musical structure is turned into graphic objects suitable for layout
- layout turns those graphic objects into positioned graphic objects
- output emission turns positioned graphic objects into a concrete format such as SVG

This separation keeps layout and drawing distinct and prevents guesswork in rendering from becoming part of the musical contract.

## Layout

Rendering owns layout in screen space.

That includes:

- system layout
- segment placement within systems
- final horizontal and vertical geometry in output units
- paint-order grouping
- final placement of graphics derived from projected slices and projected events

Rendering may derive layout-specific spacing and geometry from the projection timing structure, but those are realization decisions built on top of projection rather than replacements for projection.

## Visual realization

Rendering draws harmonic structure and events as one visual object.

It:

- turns projection into screen geometry
- builds and positions region graphics from projected harmonic structure
- builds and positions event graphics from projected events
- makes duration, silence, harmonic orientation, and local ownership legible
- chooses a visible notation language without changing projection
- applies renderer-level styling such as paint order, seam treatment, and color policy
- labels projected segments with bar numbers
- emits the final output format

Rendering does not derive harmonic structure from authored input, choose harmonic slice boundaries, choose visible pitch-space placement, decide projected span ownership for notes, or recompute musical relationships already made explicit in projection.

## Output

The repository may support multiple renderers over time, provided they consume the same projection contract.

The existing renderer emits an SVG score view, including explicit layer paint order, segment seams, bar-number labels, and basic SVG accessibility metadata. SVG is an output choice rather than the architectural definition of rendering itself.
