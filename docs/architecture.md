# Architecture

This document captures the highest-level architecture of the system and the boundaries between its main stages.

## Foundational musical orientation

This system is built on a small set of musical commitments that shape the whole architecture:

- harmonic structure is treated as relational and spatial, not reduced to a single chord symbol
- pitch-class evidence is primary
- fifth-relations matter structurally
- harmonic guidance contributes evidence without replacing sounded evidence
- harmonic structure may sometimes be completed conservatively when the evidence strongly implies missing support
- local harmonic settlement is meaningful even before larger tonal context is resolved

## Architectural boundaries

The main architectural boundaries are:

- authored input remains separate from harmonic structure
- harmonic engine remains separate from placement and rendering
- placement remains separate from rendering

## Staged pipeline

The system is organized as a simple staged pipeline:

1. authored input is provided in some input form
2. authored input is normalized into the canonical input
3. the harmonic engine derives harmonic structure from the canonical input
4. placement combines canonical input and harmonic structure
5. rendering renders the result of placement

## Related docs

Detailed specifications live in the focused docs:

- `docs/authoring.md`: authored-input approaches and the normalization boundary
- `docs/engine.md`: canonical harmonic-engine input, output, principles, and current process
- `docs/render.md`: placement and rendering principles and current approach
- `ROADMAP.md`: forward-looking work, sequencing, and open directions
