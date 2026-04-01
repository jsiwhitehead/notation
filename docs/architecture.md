# Architecture

This document defines the highest-level architecture of the system: what kind of notation system this repository is, which representations organize it, and where the main stage boundaries lie. It is the top-level reference for how authored input, harmonic analysis, projection, and rendering fit together.

## System identity

This repository is a harmony-first notation system.

Its distinguishing architectural choice is that harmonic structure is treated as a first-class derived object rather than as a late-attached annotation or chord symbol label. The system derives harmonic analysis in fifths-space, projects that analysis together with authored events into visible pitch-space, and only then realizes the result visually.

The architecture therefore centers on explicit musical representations and clear stage boundaries rather than on one monolithic notation routine.

## Core commitments

This system is built on the following commitments:

- harmonic structure is relational and spatial, not reduced to a single chord symbol
- pitch-class evidence is primary
- fifth-relations matter structurally, and harmonic analysis is settled in fifths-space before downstream pitch-space placement
- chord symbols contribute local harmonic evidence without replacing sounded evidence
- local harmonic settlement is meaningful even before broader tonal context is resolved
- `center` and `field` are the same kind of harmonic object inferred at different scopes
- `grounding` primarily orients the `center`, distinguishing harmonic root from actual ground support
- authored musical meaning remains separate from visual realization
- shared temporal structure is part of the architectural backbone rather than a renderer-only convenience
- projection is the bridge between analysis-native musical structure and render-facing pitch-space structure
- rendering realizes a completed projection and does not redo musical inference

## Principal representations

The system is organized around three principal representations:

- canonical authored input
- harmonic structure
- projection

These are the main architectural contracts of the repository.

### Canonical authored input

Canonical authored input is the normalized musical input consumed by the harmony stage. It contains authored events, timing, layering, and optional authored harmonic cues such as chord symbols. It does not contain derived harmonic structure.

`docs/authoring.md` defines the authoring boundary and the normalization contract.

### Harmonic structure

Harmonic structure is the output of the harmony stage. It expresses harmonic analysis in analysis-native terms, including `center`, `field`, `grounding`, and segment-local `harmonicSlices`. It remains a musical analysis representation rather than a render-facing geometric one.

`docs/harmony.md` defines the harmony-stage contract.

### Projection

Projection is the unified render-ready musical representation. It combines canonical authored input with harmonic structure, chooses visible pitch-space placement, preserves shared temporal structure, and carries explicit ownership and placement decisions needed by rendering.

`docs/projection.md` defines the projection contract.

## Stage boundaries

The main architectural boundaries are:

- authored input remains separate from harmonic structure
- harmony remains separate from projection
- projection remains separate from rendering
- rendering remains responsible for visual realization rather than musical inference

These boundaries matter more than any particular heuristic used inside a stage.

## Stage pipeline

The system follows this staged pipeline:

1. authored input is provided in some input form
2. authored input is normalized into canonical authored input
3. the harmony stage derives harmonic structure from canonical authored input
4. projection combines canonical authored input and harmonic structure into a unified render-ready projection
5. rendering turns projection into visible output

This pipeline is both a processing order and a contract boundary between representations.

## Layout and realization orientation

Within the downstream visual stages, the architectural direction is:

`music -> graphic objects -> positioned graphic objects -> rendered output`

In repository terms, that means:

- musical meaning stays separate from graphic realization
- layout works on shared intermediate structures rather than guesswork in rendering
- horizontal layout is organized around shared temporal structure
- layout decisions are dependency-ordered
- drawing happens after layout, not during it
- paint order is explicit

The exact internal shape of graphic objects and positioned graphic objects may evolve, but the separation between musical structure, layout decisions, and final output is part of the architecture.

## System-specific orientation

This system does not use a conventional staff as its primary vertical frame.

Vertical reference, rest placement, attachment behavior, and harmonic-span placement are defined against the local pitch-space model of the system rather than against staff-middle assumptions inherited from conventional engraving. Standard notation resources such as SMuFL remain useful inputs for glyphs, metrics, and anchors where they map cleanly onto that pitch-space model.

## Critical contract

The main architectural risk is losing the contract between:

- authored musical ownership
- harmonic analysis
- shared time structure
- pitch-space projection
- visual realization

When those responsibilities blur together, the system becomes harder to reason about, harder to extend, and more likely to re-infer the same decisions in multiple places. The architecture therefore favors explicit representations and stable stage responsibilities.

## Related docs

Detailed contracts and supporting material live in the focused docs:

- `docs/authoring.md`: authoring boundary and normalization
- `docs/harmony.md`: harmony-stage concepts and contract
- `docs/projection.md`: projection-stage concepts and contract
- `docs/render.md`: rendering-stage concepts and contract
- `docs/research.md`: research, adopted lessons, and external references
- `ROADMAP.md`: tentative future directions and open problems
