# Architecture

This document captures the highest-level architecture of the system and the boundaries between its main stages.

## Foundational musical orientation

This system is built on a small set of musical commitments that shape the whole architecture:

- harmonic structure is treated as relational and spatial, not reduced to a single chord symbol
- pitch-class evidence is primary
- fifth-relations matter structurally, and the harmonic engine reasons in circular fifths-space before anything is projected into linear pitch-space
- harmonic guidance contributes evidence without replacing sounded evidence
- harmonic structure may sometimes be completed conservatively when the evidence strongly implies missing support
- local harmonic settlement is meaningful even before larger tonal context is resolved
- the engine derives singular harmonic objects first; downstream projection and rendering decide how those objects appear in visible pitch-space
- `center` and `field` are the same kind of harmonic object inferred at different scopes
- `grounding` primarily orients the `center`, distinguishing harmonic root from actual ground support

## Architectural boundaries

The main architectural boundaries are:

- authored input remains separate from harmonic structure
- harmonic engine remains separate from projection and rendering
- projection remains separate from rendering

## Staged pipeline

The system is organized as a simple staged pipeline:

1. authored input is provided in some input form
2. authored input is normalized into the canonical input
3. the harmonic engine derives harmonic structure from the canonical input
4. projection combines canonical input and harmonic structure into a render-ready projection
5. rendering renders the result of projection

## Related docs

Detailed specifications live in the focused docs:

- `docs/authoring.md`: authored-input approaches and the normalization boundary
- `docs/engine.md`: canonical harmonic-engine input, output, principles, and current process
- `docs/render.md`: projection and rendering principles and current approach
- `ROADMAP.md`: forward-looking work, sequencing, and open directions
